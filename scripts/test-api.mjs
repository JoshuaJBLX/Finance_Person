/**
 * Suite de pruebas detallada de la API de Finance Person.
 *
 * Levanta el servidor real contra una base MongoDB de pruebas aislada (finance_person_test)
 * y ejercita TODAS las funcionalidades: autenticación, recuperación, perfil,
 * categorías, cuentas, movimientos, presupuestos, reportes, admin/RBAC y
 * aislamiento multiinquilino.
 *
 * Uso:  npm test
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import dayjs from 'dayjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4199;
const TMP = join(os.tmpdir(), 'opencode', `fp-api-test-${Date.now()}`);
mkdirSync(TMP, { recursive: true });
const DB_PATH = join(TMP, 'finance-test.db');
const BASE = `http://127.0.0.1:${PORT}`;

/* ---------- Reportero ---------- */
const results = { passed: 0, failed: 0, failures: [] };
const check = (name, cond, extra = '') => {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; results.failures.push(name); console.log(`  ✗ ${name}${extra ? `  [${extra}]` : ''}`); }
};
const section = (t) => console.log(`\n▸ ${t}`);

const req = async (method, path, { body, token } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};
const login = async (email, password) =>
  (await req('POST', '/api/auth/login', { body: { email, password } })).json;

/* ---------- Arranque del servidor ---------- */
const child = spawn(process.execPath, ['server/app.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (d) => (logs += d));
child.stderr.on('data', (d) => (logs += d));

const waitUp = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El servidor no arrancó:\n' + logs.slice(-3000));
};

/* ================================================================ */
(async () => {
  try {
    await waitUp();

    /* ---- Sesiones ---- */
    const adminUser = await login('admin@finance.person', 'Admin12345');
    const adminT = adminUser.token;
    const demoUser = await login('demo@finance.person', 'Demo12345');
    const demoT = demoUser.token;
    const demoId = demoUser.user.id;
    const valenT = (await login('valen@finance.person', 'Valen12345')).token;

    /* =1= AUTH ==================================================== */
    section('1. Autenticación y registro');
    {
      const r = await req('POST', '/api/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'test@fn.test', password: 'Test12345' } });
      check('registro de usuario nuevo → 201 con token', r.status === 201 && r.json.user.role === 'user' && !!r.json.token, `status=${r.status}`);
      const testId = r.json.user.id;

      const dup = await req('POST', '/api/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'test@fn.test', password: 'Test12345' } });
      check('registro con email duplicado → 409', dup.status === 409);

      const weak = await req('POST', '/api/auth/register', { body: { firstName: 'A', lastName: 'B', email: 'weak@fn.test', password: 'ab' } });
      check('registro con contraseña débil → 400', weak.status === 400);

      const badMail = await req('POST', '/api/auth/register', { body: { firstName: 'A', lastName: 'B', email: 'sin-formato', password: 'Valid12345' } });
      check('registro con email inválido → 400', badMail.status === 400);

      check('login correcto → 200 con token', (await login('test@fn.test', 'Test12345')).token);
      check('login con contraseña incorrecta → 401', (await req('POST', '/api/auth/login', { body: { email: 'test@fn.test', password: 'incorrecta' } })).status === 401);

      const me = await req('GET', '/api/auth/me', { token: (await login('test@fn.test', 'Test12345')).token });
      check('GET /auth/me devuelve el usuario autenticado', me.status === 200 && me.json.email === 'test@fn.test');

      const noAuth = await req('GET', '/api/transactions');
      check('sin token, /api/transactions → 401', noAuth.status === 401);
    }

    /* =2= RECUPERACIÓN ============================================= */
    section('2. Recuperación de contraseña (flujo demo sin SMTP)');
    let testT;
    {
      const forgot = await req('POST', '/api/auth/forgot-password', { body: { email: 'test@fn.test' } });
      check('forgot-password para cuenta existente → 200 y token', forgot.status === 200 && !!forgot.json.token);
      const token = forgot.json.token;

      const forgotUnknown = await req('POST', '/api/auth/forgot-password', { body: { email: 'nadie@fn.test' } });
      check('forgot-password para cuenta inexistente → 404', forgotUnknown.status === 404);

      const verify = await req('GET', `/api/auth/verify-reset?token=${token}`);
      check('verify-reset con token válido → {valid:true}', verify.status === 200 && verify.json.valid === true);

      const reset = await req('POST', '/api/auth/reset-password', { body: { token, password: 'NuevaClave123' } });
      check('reset-password → 200', reset.status === 200);

      check('login con la nueva contraseña → 200', (await login('test@fn.test', 'NuevaClave123')).token);
      check('login con la contraseña anterior → 401', (await req('POST', '/api/auth/login', { body: { email: 'test@fn.test', password: 'Test12345' } })).status === 401);
      testT = (await login('test@fn.test', 'NuevaClave123')).token;
    }

    /* =3= PERFIL ==================================================== */
    section('3. Perfil de usuario');
    {
      const up = await req('PUT', '/api/users/me', { token: testT, body: { firstName: 'Prueba', lastName: 'Gómez' } });
      check('actualizar nombre y apellido → 200', up.status === 200);
      const meAfter = await req('GET', '/api/users/me', { token: testT });
      check('perfil persistido (Prueba Gómez)', meAfter.status === 200 && meAfter.json.firstName === 'Prueba' && meAfter.json.lastName === 'Gómez');

      const emptyName = await req('PUT', '/api/users/me', { token: testT, body: { firstName: '   ' } });
      check('nombre vacío → 400', emptyName.status === 400);

      const badCurr = await req('PUT', '/api/users/me', { token: testT, body: { currentPassword: 'mal', newPassword: 'NuevaClave999' } });
      check('cambio de clave con actual incorrecta → 400', badCurr.status === 400);

      const noCurr = await req('PUT', '/api/users/me', { token: testT, body: { newPassword: 'NuevaClave999' } });
      check('cambio de clave sin clave actual → 400', noCurr.status === 400);

      await req('PUT', '/api/users/me', { token: testT, body: { currentPassword: 'NuevaClave123', newPassword: 'ClaveFinal123' } });
      check('cambio de clave correcto → login con la nueva funciona', (await login('test@fn.test', 'ClaveFinal123')).token);
      testT = (await login('test@fn.test', 'ClaveFinal123')).token;
    }

    /* =4= CATEGORÍAS ================================================ */
    section('4. Categorías (CRUD + sistema)');
    let customCat;
    {
      const list0 = await req('GET', '/api/categories', { token: testT });
      check('bootstrap: lista con ≥ 10 categorías', list0.status === 200 && list0.json.length >= 10, `len=${list0.json?.length}`);

      const created = await req('POST', '/api/categories', { token: testT, body: { name: 'Casa', type: 'expense', color: '#123456' } });
      check('crear categoría → 201', created.status === 201 && created.json.isSystem === false);
      customCat = created.json;

      const dupCat = await req('POST', '/api/categories', { token: testT, body: { name: 'casa', type: 'expense' } });
      check('nombre duplicado (sin distinción de mayúsculas) → 409', dupCat.status === 409);

      const badType = await req('POST', '/api/categories', { token: testT, body: { name: 'Rara', type: 'transfer' } });
      check('tipo inválido → 400', badType.status === 400);

      const badColor = await req('POST', '/api/categories', { token: testT, body: { name: 'Rara2', type: 'expense', color: 'rojo' } });
      check('color inválido → 400', badColor.status === 400);

      const updCat = await req('PUT', `/api/categories/${customCat.id}`, { token: testT, body: { name: 'Casa y Hogar', color: '#ABC123' } });
      check('renombrar y recolorear → 200', updCat.status === 200 && updCat.json.name === 'Casa y Hogar');
      customCat = updCat.json;

      // Categoría de sistema (solo admin) y visibilidad para todos
      const sys = await req('POST', '/api/admin/categories/system', { token: adminT, body: { name: 'Impuesto Global', type: 'expense', color: '#000000' } });
      check('admin crea categoría de sistema → 201', sys.status === 201, `status=${sys.status} ${JSON.stringify(sys.json)}`);
      const sysId = sys.json.id;
      const visible = await req('GET', '/api/categories', { token: testT });
      check('la categoría de sistema es visible para un usuario normal', visible.json.some((c) => c.id === sysId && c.isSystem === true));

      const userSysUpd = await req('PUT', `/api/categories/${sysId}`, { token: testT, body: { name: 'X' } });
      check('usuario NO puede editar una categoría de sistema → 403', userSysUpd.status === 403);
      const userSysDel = await req('DELETE', `/api/categories/${sysId}`, { token: testT });
      check('usuario NO puede borrar una categoría de sistema → 403', userSysDel.status === 403);

      const sysRenamed = await req('PUT', `/api/admin/categories/system/${sysId}`, { token: adminT, body: { name: 'Impuestos Globales' } });
      check('admin renombra categoría de sistema → 200', sysRenamed.status === 200 && sysRenamed.json.name === 'Impuestos Globales');

      const delCat = await req('DELETE', `/api/categories/${customCat.id}`, { token: testT });
      check('eliminar categoría propia → 200', delCat.status === 200);
    }

    /* =5= CUENTAS =================================================== */
    section('5. Cuentas (CRUD + balance + por defecto)');
    let ahorroTest;
    {
      const accList = await req('GET', '/api/accounts', { token: testT });
      check('bootstrap: cuenta Efectivo por defecto presente', accList.status === 200 && accList.json.some((a) => a.name === 'Efectivo' && a.isDefault && a.type === 'cash'));

      const created = await req('POST', '/api/accounts', { token: testT, body: { name: 'Ahorro Test', type: 'savings', initialBalance: 100 } });
      check('crear cuenta → 201 con saldo inicial registrado', created.status === 201 && created.json.initialBalance === 100);
      ahorroTest = created.json;

      const dupAcc = await req('POST', '/api/accounts', { token: testT, body: { name: 'ahorro test', type: 'bank' } });
      check('nombre duplicado → 409', dupAcc.status === 409);

      const badTypeAcc = await req('POST', '/api/accounts', { token: testT, body: { name: 'Cripto', type: 'bitcoin' } });
      check('tipo de cuenta inválido → 400', badTypeAcc.status === 400);

      const badBalance = await req('POST', '/api/accounts', { token: testT, body: { name: 'Cripto', type: 'other', initialBalance: -5 } });
      check('saldo inicial negativo → 400', badBalance.status === 400);

      const def = await req('PUT', `/api/accounts/${ahorroTest.id}/default`, { token: testT });
      check('marcar cuenta como predeterminada → 200', def.status === 200);
      const accAfter = await req('GET', '/api/accounts', { token: testT });
      check('solo una cuenta queda marcada como predeterminada', accAfter.json.filter((a) => a.isDefault).length === 1 && accAfter.json.find((a) => a.id === ahorroTest.id).isDefault === true);
    }

    /* =6= MOVIMIENTOS =============================================== */
    section('6. Movimientos (CRUD, validación y filtros)');
    let txIncome, txExpense;
    {
      const cats = await req('GET', '/api/categories', { token: testT });
      const salario = cats.json.find((c) => c.name === 'Salario');
      const hogar = cats.json.find((c) => c.name === 'Transporte');
      const efectivo = (await req('GET', '/api/accounts', { token: testT })).json.find((a) => a.name === 'Efectivo');

      txIncome = await req('POST', '/api/transactions', { token: testT, body: { accountId: ahorroTest.id, categoryId: salario.id, type: 'income', amount: 1000, description: 'Sueldo de prueba', date: '2026-09-01' } });
      check('crear ingreso → 201', txIncome.status === 201 && txIncome.json.amount === 1000);

      txExpense = await req('POST', '/api/transactions', { token: testT, body: { accountId: efectivo.id, categoryId: hogar.id, type: 'expense', amount: 250, description: 'Compra hogar', date: '2026-09-05' } });
      check('crear egreso → 201', txExpense.status === 201);

      const neg = await req('POST', '/api/transactions', { token: testT, body: { accountId: efectivo.id, categoryId: hogar.id, type: 'expense', amount: -5, description: 'mal', date: '2026-09-01' } });
      check('monto negativo → 400', neg.status === 400);

      const badDate = await req('POST', '/api/transactions', { token: testT, body: { accountId: efectivo.id, categoryId: hogar.id, type: 'expense', amount: 5, description: 'mal', date: '2026-13-40' } });
      check('fecha inválida → 400', badDate.status === 400);

      const badTypeTx = await req('POST', '/api/transactions', { token: testT, body: { accountId: efectivo.id, categoryId: hogar.id, type: 'transfer', amount: 5, description: 'mal', date: '2026-09-01' } });
      check('tipo inválido → 400', badTypeTx.status === 400);

      // Aislación de tenant: cuentas y categorías de OTRO usuario
      const demoAcc = (await req('GET', '/api/accounts', { token: demoT })).json[0];
      const demoCat = (await req('GET', '/api/categories', { token: demoT })).json.find((c) => c.type === 'expense');
      const crossAcc = await req('POST', '/api/transactions', { token: testT, body: { accountId: demoAcc.id, categoryId: hogar.id, type: 'expense', amount: 10, description: 'intrusión', date: '2026-09-02' } });
      check('usar cuenta de otro usuario → 400', crossAcc.status === 400);
      const crossCat = await req('POST', '/api/transactions', { token: testT, body: { accountId: efectivo.id, categoryId: demoCat.id, type: 'expense', amount: 10, description: 'intrusión', date: '2026-09-02' } });
      check('usar categoría de otro usuario → 400', crossCat.status === 400);

      // El saldo de la cuenta refleja el ingreso: 100 + 1000 = 1100
      const accState = await req('GET', '/api/accounts', { token: testT });
      check('balance de cuenta actualizado tras ingreso (1100)', accState.json.find((a) => a.id === ahorroTest.id).balance === 1100);

      // Filtros con dataset rico del demo
      const exp = await req('GET', '/api/transactions?type=expense&limit=500', { token: demoT });
      check('filtro type=expense: todos los resultados son egresos', exp.status === 200 && exp.json.rows.length > 0 && exp.json.rows.every((t) => t.type === 'expense'));

      const search = await req('GET', '/api/transactions?search=Nómina&limit=500', { token: demoT });
      check('búsqueda "Nómina": 12 resultados (12 salarios)', search.status === 200 && search.json.total === 12 && search.json.rows.every((t) => t.description.includes('Nómina')), `total=${search.json.total}`);

      const from = dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD');
      const to = dayjs().format('YYYY-MM-DD');
      const ranged = await req('GET', `/api/transactions?from=${from}&to=${to}&limit=500`, { token: demoT });
      check('filtro por rango de fechas respetado', ranged.status === 200 && ranged.json.rows.every((t) => t.date >= from && t.date <= to));

      const catFilter = await req('GET', `/api/transactions?categoryId=${demoCat.id}&limit=500`, { token: demoT });
      check('filtro por categoría aplicado', catFilter.status === 200 && catFilter.json.rows.every((t) => t.categoryId === demoCat.id));

      // Actualización y borrado
      const upd = await req('PUT', `/api/transactions/${txIncome.json.id}`, { token: testT, body: { description: 'Sueldo editado', amount: 1100 } });
      check('actualizar monto/descripción → 200', upd.status === 200 && upd.json.amount === 1100);
      const updCheck = await req('GET', `/api/transactions?search=Sueldo editado`, { token: testT });
      check('cambio visible en el listado', updCheck.json.total === 1);
      txIncome = upd;

      const beforeDel = await req('GET', '/api/transactions', { token: testT });
      const del = await req('DELETE', `/api/transactions/${txExpense.json.id}`, { token: testT });
      check('eliminar movimiento → 200', del.status === 200);
      const afterDel = await req('GET', '/api/transactions', { token: testT });
      check('el movimiento desaparece tras eliminarse', afterDel.json.total === beforeDel.json.total - 1);

      // Borrado de cuenta con movimientos → rechazado
      const delUsedAcc = await req('DELETE', `/api/accounts/${ahorroTest.id}`, { token: testT });
      check('no se puede borrar cuenta con movimientos → 400', delUsedAcc.status === 400);

      const tempAcc = await req('POST', '/api/accounts', { token: testT, body: { name: 'Temporal', type: 'other', initialBalance: 0 } });
      const delEmptyAcc = await req('DELETE', `/api/accounts/${tempAcc.json.id}`, { token: testT });
      check('se puede borrar cuenta sin movimientos → 200', delEmptyAcc.status === 200);
    }

    /* =7= PRESUPUESTOS ============================================== */
    section('7. Presupuestos (upsert idempotente, progreso y resumen)');
    {
      const month = dayjs().format('YYYY-MM');
      const budgets = await req('GET', `/api/budgets?month=${month}`, { token: demoT });
      check('demo: 7 presupuestos generados para el mes actual', budgets.status === 200 && budgets.json.length === 7, `len=${budgets.json?.length}`);
      check('cada presupuesto trae progreso y restante numérico', budgets.json.every((b) => Number.isFinite(b.amount) && Number.isFinite(b.spent) && Number.isFinite(b.remaining) && Number.isFinite(b.progress)));

      const summary = await req('GET', `/api/budgets/summary?month=${month}`, { token: demoT });
      check('resumen del mes: total presupuestado = suma y count = 7', summary.status === 200 && summary.json.count === 7 && summary.json.totalBudget === budgets.json.reduce((s, b) => s + b.amount, 0));

      const invalidMonth = await req('GET', '/api/budgets?month=2026-99', { token: demoT });
      check('mes inválido → 400', invalidMonth.status === 400);

      // Upsert idempotente por (categoría, mes)
      const cats = await req('GET', '/api/categories', { token: testT });
      const hogar = cats.json.find((c) => c.name === 'Transporte');
      const first = await req('POST', '/api/budgets', { token: testT, body: { categoryId: hogar.id, month: '2026-11', amount: 500 } });
      const second = await req('POST', '/api/budgets', { token: testT, body: { categoryId: hogar.id, month: '2026-11', amount: 650 } });
      check('upsert crea y luego actualiza el mismo presupuesto', first.status === 200 && second.status === 200 && first.json.id === second.json.id && second.json.amount === 650);

      const crossBudget = await req('POST', '/api/budgets', { token: testT, body: { categoryId: (await req('GET', '/api/categories', { token: demoT })).json[0].id, month: '2026-11', amount: 10 } });
      check('presupuesto con categoría ajena → 400', crossBudget.status === 400);

      await req('DELETE', `/api/budgets/${first.json.id}`, { token: testT });
      const gone = await req('GET', `/api/budgets?month=2026-11`, { token: testT });
      check('presupuesto eliminado ya no aparece', gone.status === 200 && !gone.json.some((b) => b.id === first.json.id));
    }

    /* =8= REPORTES ================================================== */
    section('8. Reportes (summary, por categoría, por cuenta, mensual, full)');
    {
      const summary = await req('GET', '/api/reports/summary', { token: demoT });
      check('summary: income − expenses = balance', summary.status === 200 && Math.abs(summary.json.income - summary.json.expenses - summary.json.balance) < 0.01 && summary.json.income > 0);
      const countList = await req('GET', '/api/transactions?limit=1', { token: demoT });
      check('summary.count coincide con el total de movimientos', summary.json.count === countList.json.total, `count=${summary.json.count} vs total=${countList.json.total}`);

      const byCatExp = await req('GET', '/api/reports/by-category?type=expense', { token: demoT });
      check('by-category expense: filas con nombre/color/total', byCatExp.status === 200 && byCatExp.json.data.length > 0 && byCatExp.json.data.every((d) => d.name && d.total > 0));
      const byCatInc = await req('GET', '/api/reports/by-category?type=income', { token: demoT });
      check('by-category income: filas con totales', byCatInc.status === 200 && byCatInc.json.data.length > 0);
      check('by-category con tipo inválido → 400', (await req('GET', '/api/reports/by-category?type=total', { token: demoT })).status === 400);

      const byAcc = await req('GET', '/api/reports/by-account', { token: demoT });
      check('by-account: cuenta, ingresos y egresos numéricos por cada cuenta', byAcc.status === 200 && Array.isArray(byAcc.json) && byAcc.json.length >= 4 && byAcc.json.every((a) => String(a.accountName).length > 0 && Number.isFinite(a.income) && Number.isFinite(a.expenses) && a.income + a.expenses > 0));

      const monthly = await req('GET', '/api/reports/monthly', { token: demoT });
      const months = monthly.json.map((m) => m.month);
      check('monthly: 12 meses ordenados ascendentemente', monthly.status === 200 && months.length === 12 && months.every((m, i) => i === 0 || m > months[i - 1]), `len=${months.length}`);
      check('monthly: totales numéricos no negativos', monthly.json.every((m) => m.income >= 0 && m.expenses >= 0));

      const full = await req('GET', '/api/reports/full', { token: demoT });
      check('full: bundle completo consistente', full.status === 200 && full.json.summary.count === full.json.transactions.length && full.json.monthly.length === 12 && full.json.byCategoryExpense.length > 0 && full.json.accounts.length > 0);

      const badRange = await req('GET', '/api/reports/monthly?from=2026-12-01&to=2026-01-01', { token: demoT });
      check('rango from>to → 400', badRange.status === 400);
    }

    /* =9= ADMIN & RBAC ============================================== */
    section('9. Administración (RBAC, estadísticas, usuarios)');
    {
      check('usuario normal: /admin/users → 403', (await req('GET', '/api/admin/users', { token: testT })).status === 403);
      check('usuario normal: /admin/stats → 403', (await req('GET', '/api/admin/stats', { token: testT })).status === 403);

      const users = await req('GET', '/api/admin/users', { token: adminT });
      const emails = users.json.rows.map((u) => u.email);
      check('admin: lista de usuarios incluye demo, valen y test', users.status === 200 && emails.includes('demo@finance.person') && emails.includes('valen@finance.person') && emails.includes('test@fn.test'));

      const stats = await req('GET', '/api/admin/stats', { token: adminT });
      check('admin: estadísticas globales (usuarios ≥ 3, movimientos ≥ 148)', stats.status === 200 && stats.json.users >= 3 && stats.json.transactions >= 148, JSON.stringify(stats.json));

      const overview = await req('GET', '/api/admin/overview', { token: adminT });
      check('admin: overview devuelve los mismos totales globales', overview.status === 200 && overview.json.users === stats.json.users);

      const demoMoves = await req('GET', `/api/admin/users/${demoId}/transactions?limit=500`, { token: adminT });
      check('admin: movimientos de un usuario específico (demo ≥ 100)', demoMoves.status === 200 && demoMoves.json.transactions.length >= 100, `len=${demoMoves.json.transactions?.length}`);
      const valenMoves = await req('GET', `/api/admin/users/${(await req('GET', '/api/admin/users?search=valen', { token: adminT })).json.rows[0].id}/transactions`, { token: adminT });
      check('admin: los movimientos de valen son visibles (multiinquilino global)', valenMoves.status === 200 && valenMoves.json.transactions.length >= 15);

      // Eliminar usuario: solo admin
      const regTmp = await req('POST', '/api/auth/register', { body: { firstName: 'Temp', lastName: 'User', email: 'baja@fn.test', password: 'Baja12345' } });
      const removed = await req('DELETE', `/api/admin/users/${regTmp.json.user.id}`, { token: adminT });
      check('admin puede eliminar un usuario → 200', removed.status === 200);
      const regAgain = await req('POST', '/api/auth/register', { body: { firstName: 'Temp', lastName: 'User', email: 'baja@fn.test', password: 'Baja12345' } });
      check('el email liberado puede registrarse de nuevo → 201', regAgain.status === 201);
    }

    /* =10= AISLAMIENTO MULTIINQUILINO =============================== */
    section('10. Aislamiento multiinquilino (RBAC por datos)');
    {
      const tAccs = (await req('GET', '/api/accounts', { token: testT })).json.map((a) => a.id);
      const dAccs = (await req('GET', '/api/accounts', { token: demoT })).json.map((a) => a.id);
      check('las cuentas de cada usuario son disjuntas', tAccs.some((id) => dAccs.includes(id)) === false);

      const demoTx = (await req('GET', '/api/transactions?limit=1', { token: demoT })).json.rows[0];
      const demoAcc = dAccs[0];
      check('actualizar cuenta ajena → 404', (await req('PUT', `/api/accounts/${demoAcc}`, { token: testT, body: { name: 'Robado' } })).status === 404);
      check('actualizar movimiento ajeno → 404', (await req('PUT', `/api/transactions/${demoTx.id}`, { token: testT, body: { amount: 1 } })).status === 404);
      check('eliminar movimiento ajeno → 404', (await req('DELETE', `/api/transactions/${demoTx.id}`, { token: testT })).status === 404);
      check('editar categoría ajena → 403', (await req('PUT', `/api/categories/${demoTx.categoryId}`, { token: testT, body: { name: 'X' } })).status === 403);

      // El admin ve el total global (demo + valen + test + admin)
      const adminAll = await req('GET', '/api/admin/overview', { token: adminT });
      check('admin: vista global con movimientos de todos los tenants', adminAll.status === 200 && adminAll.json.transactions >= 148);
    }

    /* ---------- Resumen ---------- */
    console.log('\n========================================');
    console.log(`RESUMEN: ${results.passed} pasadas · ${results.failed} fallidas`);
    if (results.failed) {
      console.log('\nFallos:');
      results.failures.forEach((f) => console.log(`  - ${f}`));
    } else {
      console.log('TODAS LAS PRUEBAS PASARON ✔');
    }
  } catch (err) {
    console.error('\nERROR en la suite:', err.message);
    console.error(logs.slice(-2500));
    results.failed++;
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 300));
    rmSync(TMP, { recursive: true, force: true });
  }
  process.exitCode = results.failed ? 1 : 0;
})();