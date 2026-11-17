import dayjs from 'dayjs';
import 'dayjs/locale/es.js';

dayjs.locale('es');

export function money(value, { decimals = 2, sign = false } = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  if (sign) return `${n < 0 ? '-' : n > 0 ? '+' : ''}${abs}`;
  return abs;
}

export function moneyWithCurrency(value, opts = {}) {
  return `$ ${money(value, opts)}`;
}

export const fmtDate = (iso) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '—');
export const fmtMonthLabel = (ym) =>
  ym ? dayjs(`${ym}-01`).format('MMMM YYYY') : '—';
export const fmtMonthShort = (ym) =>
  ym ? dayjs(`${ym}-01`).format('MMM YY') : '—';

export const monthOptions = () => {
  const out = [];
  const now = dayjs();
  for (let i = 5; i >= 0; i--) out.push(now.subtract(i, 'month').format('YYYY-MM'));
  for (let i = 1; i <= 3; i++) out.push(now.add(i, 'month').format('YYYY-MM'));
  return out;
};

export function pct(value) {
  const n = Number(value) || 0;
  return `${n.toFixed(1)}%`;
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const todayISO = () => dayjs().format('YYYY-MM-DD');