import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'url';
import dayjs from 'dayjs';
import { userRepository } from '../repositories/user.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { accountRepository } from '../repositories/account.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { budgetRepository } from '../repositories/budget.repository.js';
import { authService } from '../services/auth.service.js';
import '../config/database.js';

const today = dayjs();

/* ---------- Helpers reutilizables ---------- */

const getOrCreateCategory = async (userId, { name, type, color }) => {
  const existing = (await categoryRepository.listUserCategories(userId))
    .find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type);
  return existing || (await categoryRepository.create({ userId, name, type, color }));
};

const getOrCreateAccount = async (userId, { name, type, initialBalance }) => {
  const existing = (await accountRepository.listByUser(userId))
    .find((a) => a.name.toLowerCase() === name.toLowerCase());
  return existing || (await accountRepository.create({ userId, name, type, initialBalance }));
};

/** Devuelve el dayjs del día `day` del mes, o null si la fecha cae en el futuro. */
const dayInMonth = (month, day) => {
  const d = month.date(Math.min(day, month.daysInMonth()));
  return d.isAfter(today) ? null : d;
};

/** Cache de fechas existentes por usuario: una sola consulta en lugar de una por movimiento. */
const datesCache = new Map();
const loadDates = (userId) => {
  if (!datesCache.has(userId)) {
    datesCache.set(
      userId,
      transactionRepository
        .list({ userId, limit: 100000 })
        .then((r) => new Set(r.rows.map((t) => t.date)))
    );
  }
  return datesCache.get(userId);
};

const addTx = (userId, { accountId, categoryId, type, amount, description, date }) =>
  transactionRepository.create({
    userId,
    accountId,
    categoryId,
    type,
    amount,
    description,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`
  });

const addTxIfMissing = async (userId, tx) => {
  const dates = await loadDates(userId);
  if (dates.has(tx.date)) return null;
  dates.add(tx.date);
  return addTx(userId, tx);
};

const addBudget = (userId, categoryId, month, amount) =>
  budgetRepository.createOrUpdate({ userId, categoryId, month, amount });

/* ---------- Dataset de demostración ---------- */

/* Ingresos mensuales (viejo → nuevo) — demuestran picos y valles reales */
const SALARIO_MONTHLY = [3800, 4200, 4000, 4450, 3900, 4200, 4100, 4500, 4000, 4300, 4150, 4650];
const FREELANCE_MONTHLY = [0, 720, 1150, 0, 480, 1380, 0, 390, 860, 0, 640, 220];
const INVERSIONES_MONTHLY = [0, 0, 0, 0, 0, 220, 0, 180, 0, 0, 320, 460];
const BONO_MONTHLY = [0, 0, 0, 180, 0, 0, 0, 250, 0, 0, 0, 320];

/* Gastos mensuales (viejo → nuevo) */
const VIVIENDA_MONTHLY = [850, 850, 880, 850, 900, 920, 850, 850, 870, 850, 880, 950];
const TRANSPORTE_MONTHLY = [140, 160, 130, 180, 120, 150, 175, 145, 165, 155, 190, 200];
const SERVICIOS_MONTHLY = [95, 88, 110, 120, 95, 105, 92, 98, 115, 100, 108, 130];
const ALIMENTACION_MONTHLY = [430, 470, 510, 445, 480, 530, 465, 490, 520, 455, 545, 580];
const EDUCACION_MONTHLY = [180, 180, 180, 220, 180, 180, 260, 180, 180, 190, 180, 220];
const SALUD_MONTHLY = [60, 70, 85, 40, 90, 65, 55, 80, 70, 95, 60, 110];
const OCIO_MONTHLY = [180, 240, 190, 320, 260, 380, 210, 300, 340, 250, 460, 520];
const VIAJES_MONTHLY = [0, 280, 220, 0, 0, 480, 260, 0, 0, 310, 420, 380];
const EXTRA_MONTHLY = [0, 120, 0, 180, 90, 0, 250, 110, 0, 200, 0, 380];

/** Dataset completo del usuario demo: 12 meses, 4 cuentas, presupuestos mensuales. */
async function buildDemoDataset(user) {
  const pendingTx = [];
  const pendingBudgets = [];
  const queueTx = (tx) => pendingTx.push(addTxIfMissing(user.id, tx));
  const queueBudget = (categoryId, month, amount) =>
    pendingBudgets.push(addBudget(user.id, categoryId, month, amount));
  const cats = {};
  const extra = [
    { name: 'Servicios', type: 'expense', color: '#3A3A3A' },
    { name: 'Suscripciones', type: 'expense', color: '#1E5400' },
    { name: 'Viajes', type: 'expense', color: '#B9F505' },
    { name: 'Bonos', type: 'income', color: '#A8E10B' }
  ];
  for (const c of extra) cats[c.name] = await getOrCreateCategory(user.id, c);
  for (const c of await categoryRepository.listUserCategories(user.id)) cats[c.name] = c;

  const banco = await getOrCreateAccount(user.id, { name: 'Banco Principal', type: 'bank', initialBalance: 5000 });
  const ahorro = await getOrCreateAccount(user.id, { name: 'Ahorro', type: 'savings', initialBalance: 12000 });
  const tarjeta = await getOrCreateAccount(user.id, { name: 'Tarjeta Crédito', type: 'credit', initialBalance: 0 });
  const efectivo = await getOrCreateAccount(user.id, { name: 'Efectivo', type: 'cash', initialBalance: 0 });
  await accountRepository.setDefault(user.id, banco.id);

  const budgetPlan = [
    [cats['Vivienda'], 850],
    [cats['Alimentación'], 580],
    [cats['Transporte'], 150],
    [cats['Ocio'], 200],
    [cats['Salud'], 80],
    [cats['Educación'], 200],
    [cats['Servicios'], 110]
  ];

  const start = today.subtract(11, 'month').startOf('month');
  for (let i = 0; i < 12; i++) {
    const m = start.add(i, 'month');
    const ym = m.format('YYYY-MM');
    const esFijo = (cat) => ['Vivienda', 'Suscripciones', 'Educación', 'Servicios'].includes(cat.name);

    // Ingresos
    const d1 = dayInMonth(m, 1);
    if (d1) queueTx({ accountId: banco.id, categoryId: cats['Salario'].id, type: 'income', amount: SALARIO_MONTHLY[i], description: `Nómina — ${ym}`, date: d1.format('YYYY-MM-DD') });
    if (FREELANCE_MONTHLY[i]) {
      const d15 = dayInMonth(m, 15);
      if (d15) queueTx({ accountId: efectivo.id, categoryId: cats['Freelance'].id, type: 'income', amount: FREELANCE_MONTHLY[i], description: `Proyecto freelance — ${ym}`, date: d15.format('YYYY-MM-DD') });
    }
    if (INVERSIONES_MONTHLY[i]) {
      const d16 = dayInMonth(m, 16);
      if (d16) queueTx({ accountId: ahorro.id, categoryId: cats['Inversiones'].id, type: 'income', amount: INVERSIONES_MONTHLY[i], description: `Dividendos / ahorro — ${ym}`, date: d16.format('YYYY-MM-DD') });
    }
    if (BONO_MONTHLY[i]) {
      const d21 = dayInMonth(m, 21);
      if (d21) queueTx({ accountId: banco.id, categoryId: cats['Bonos'].id, type: 'income', amount: BONO_MONTHLY[i], description: `Bono — ${ym}`, date: d21.format('YYYY-MM-DD') });
    }

    // Gastos recurrentes
    const plan = [
      [2, cats['Suscripciones'], 14.99, 'Spotify + Netflix'],
      [3, cats['Vivienda'], VIVIENDA_MONTHLY[i], 'Renta / hipoteca'],
      [5, cats['Transporte'], TRANSPORTE_MONTHLY[i], 'Transporte'],
      [8, cats['Servicios'], SERVICIOS_MONTHLY[i], 'Luz e internet'],
      [10, cats['Alimentación'], ALIMENTACION_MONTHLY[i], 'Supermercado'],
      [12, cats['Educación'], EDUCACION_MONTHLY[i], 'Curso online'],
      [18, cats['Salud'], SALUD_MONTHLY[i], 'Farmacia'],
      [20, cats['Ocio'], OCIO_MONTHLY[i], 'Cine y salidas']
    ];
    for (const [day, cat, amount, desc] of plan) {
      const d = dayInMonth(m, day);
      if (d) queueTx({ accountId: esFijo(cat) ? banco.id : efectivo.id, categoryId: cat.id, type: 'expense', amount, description: `${desc} — ${ym}`, date: d.format('YYYY-MM-DD') });
    }

    // Gastos variables
    if (VIAJES_MONTHLY[i]) {
      const d = dayInMonth(m, 22);
      if (d) queueTx({ accountId: tarjeta.id, categoryId: cats['Viajes'].id, type: 'expense', amount: VIAJES_MONTHLY[i], description: `Viaje / fin de semana — ${ym}`, date: d.format('YYYY-MM-DD') });
    }
    if (EXTRA_MONTHLY[i]) {
      const d = dayInMonth(m, 25);
      if (d) queueTx({ accountId: efectivo.id, categoryId: cats['Alimentación'].id, type: 'expense', amount: EXTRA_MONTHLY[i], description: `Compras extra — ${ym}`, date: d.format('YYYY-MM-DD') });
    }

    // Presupuestos mensuales
    for (const [cat, amount] of budgetPlan) queueBudget(cat.id, ym, amount);
  }
  await Promise.all([...pendingTx, ...pendingBudgets]);
}

/** Dataset de 12 meses del administrador (con sus propias cuentas/categorías). */
async function buildAdminDataset(user) {
  const pendingTx = [];
  const pendingBudgets = [];
  const queueTx = (tx) => pendingTx.push(addTxIfMissing(user.id, tx));
  const queueBudget = (categoryId, month, amount) =>
    pendingBudgets.push(addBudget(user.id, categoryId, month, amount));
  const cats = {};
  const extras = [
    { name: 'Gastos', type: 'expense', color: '#F5F5F5' },
    { name: 'Servicios', type: 'expense', color: '#3A3A3A' },
    { name: 'Viajes', type: 'expense', color: '#B9F505' }
  ];
  for (const c of extras) cats[c.name] = await getOrCreateCategory(user.id, c);
  for (const c of await categoryRepository.listUserCategories(user.id)) cats[c.name] = c;

  const principal = await getOrCreateAccount(user.id, { name: 'Principal', type: 'bank', initialBalance: 1000 });
  const caja = await getOrCreateAccount(user.id, { name: 'Caja', type: 'cash', initialBalance: 200 });
  const inversiones = await getOrCreateAccount(user.id, { name: 'Inversiones', type: 'savings', initialBalance: 8000 });
  await accountRepository.setDefault(user.id, principal.id);

  const start = today.subtract(11, 'month').startOf('month');
  const salaries = [3200, 3100, 3400, 3300, 3200, 3500, 3300, 3600, 3400, 3300, 3500, 4200];
  const gastosGen = [900, 820, 950, 880, 930, 1020, 890, 910, 980, 850, 1040, 1150];
  const cajaVar = [120, 90, 150, 110, 140, 160, 130, 145, 125, 155, 110, 175];
  const serviciosVar = [300, 290, 320, 310, 305, 340, 295, 330, 310, 325, 305, 360];
  const alimHogar = [400, 380, 420, 395, 410, 440, 385, 430, 405, 415, 390, 470];
  const viajesVar = [250, 0, 280, 0, 320, 0, 0, 300, 0, 350, 0, 420];
  const ocioVar = [180, 160, 200, 175, 190, 220, 170, 210, 195, 205, 180, 260];
  for (let i = 0; i < 12; i++) {
    const m = start.add(i, 'month');
    const ym = m.format('YYYY-MM');

    const plan = [
      [1, cats['Salario'], salaries[i], 'Nómina', principal, 'income'],
      [3, cats['Gastos'], gastosGen[i], 'Gastos generales', principal, 'expense'],
      [5, cats['Gastos'], cajaVar[i], 'Caja / efectivo', caja, 'expense'],
      [8, cats['Servicios'], serviciosVar[i], 'Servicios', principal, 'expense'],
      [10, cats['Gastos'], alimHogar[i], 'Alimentación y hogar', caja, 'expense'],
      [15, cats['Viajes'], viajesVar[i], 'Viajes', inversiones, 'expense'],
      [20, cats['Gastos'], ocioVar[i], 'Ocio', caja, 'expense']
    ];
    for (const [day, cat, amount, desc, account, type] of plan) {
      const d = dayInMonth(m, day);
      if (d && amount) queueTx({ accountId: account.id, categoryId: cat.id, type, amount, description: `${desc} — ${ym}`, date: d.format('YYYY-MM-DD') });
    }

    queueBudget(cats['Gastos'].id, ym, 1500);
    queueBudget(cats['Servicios'].id, ym, 320);
    queueBudget(cats['Viajes'].id, ym, 260);
  }
  await Promise.all([...pendingTx, ...pendingBudgets]);
}

/** Dataset de 12 meses para el segundo usuario demo (demuestra multiinquilino). */
async function buildValenDataset(user) {
  const pendingTx = [];
  const pendingBudgets = [];
  const queueTx = (tx) => pendingTx.push(addTxIfMissing(user.id, tx));
  const queueBudget = (categoryId, month, amount) =>
    pendingBudgets.push(addBudget(user.id, categoryId, month, amount));
  await getOrCreateAccount(user.id, { name: 'Banco', type: 'bank', initialBalance: 2500 });
  const cats = {};
  for (const c of await categoryRepository.listUserCategories(user.id)) cats[c.name] = c;
  const banco = await getOrCreateAccount(user.id, { name: 'Banco', type: 'bank', initialBalance: 2500 });
  const efectivo = await getOrCreateAccount(user.id, { name: 'Efectivo', type: 'cash', initialBalance: 0 });

  const start = today.subtract(11, 'month').startOf('month');
  for (let i = 0; i < 12; i++) {
    const m = start.add(i, 'month');
    const ym = m.format('YYYY-MM');
    const plan = [
      [27, cats['Salario'], 2100, 'Nómina', banco, 'income'],
      [5, cats['Vivienda'], 700, 'Renta', banco, 'expense'],
      [8, cats['Transporte'], 90, 'Transporte', efectivo, 'expense'],
      [10, cats['Alimentación'], 380, 'Supermercado', efectivo, 'expense'],
      [18, cats['Ocio'], 100, 'Ocio', efectivo, 'expense']
    ];
    for (const [day, cat, amount, desc, account, type] of plan) {
      const d = dayInMonth(m, day);
      if (d) queueTx({ accountId: account.id, categoryId: cat.id, type, amount, description: `${desc} — ${ym}`, date: d.format('YYYY-MM-DD') });
    }
    queueBudget(cats['Alimentación'].id, ym, 420);
  }
  await Promise.all([...pendingTx, ...pendingBudgets]);
}

/* ---------- Orquestador de seed ---------- */

export async function seedDatabase() {
  // 1) Admin (dataset completo del año, si está vacío)
  let admin = await userRepository.findByEmail('admin@finance.person');
  if (!admin) {
    admin = await userRepository.create({
      firstName: 'Admin',
      lastName: 'Finance Person',
      email: 'admin@finance.person',
      passwordHash: await bcrypt.hash('Admin12345', 10),
      role: 'admin'
    });
    await getOrCreateCategory(admin.id, { name: 'Salario', type: 'income', color: '#C7F13A' });
    console.log('  Admin creado: admin@finance.person / Admin12345');
    await buildAdminDataset(admin);
    console.log('  Admin: dataset de 12 meses generado.');
  } else if ((await transactionRepository.listByUserAll(admin.id)).length === 0) {
    await buildAdminDataset(admin);
    console.log('  Admin existente enriquecido con dataset anual.');
  }

  // 2) Demo (dataset completo, auto-reparable para BD existentes)
  let demo = await userRepository.findByEmail('demo@finance.person');
  if (!demo) {
    const { user } = await authService.register({ firstName: 'Demo', lastName: 'User', email: 'demo@finance.person', password: 'Demo12345' });
    demo = user;
    await buildDemoDataset(demo);
    console.log('  Demo creado: demo@finance.person / Demo12345');
  } else {
    const enriched = (await accountRepository.listByUser(demo.id)).some((a) => a.name === 'Banco Principal');
    if (!enriched) {
      await buildDemoDataset(demo);
      console.log('  Demo existente enriquecido con dataset completo.');
    }
  }

  // 3) Valen (12 meses; additive para quien ya tenía menos)
  let valen = await userRepository.findByEmail('valen@finance.person');
  if (!valen) {
    const { user } = await authService.register({ firstName: 'Valen', lastName: 'Pérez', email: 'valen@finance.person', password: 'Valen12345' });
    valen = user;
    console.log('  Valen creado: valen@finance.person / Valen12345');
  }
  await buildValenDataset(valen); // idempotente: solo agrega lo que falta
}

export default seedDatabase;

// Ejecución directa: npm run seed
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { connect, close } = await import('../config/database.js');
  connect()
    .then(() => seedDatabase())
    .then(async () => {
      await close();
      console.log('✓ Seed completado.');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Error al sembrar:', err);
      process.exit(1);
    });
}
