import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { apiClient, makeQuery } from '../api.js';
import { moneyWithCurrency, fmtDate, fmtMonthShort, pct, todayISO } from '../utils/format.js';
import { destroyAll, lineChart, doughnutChart, barChart, PALETTE } from '../utils/charts.js';
import { toast, notifyError } from '../utils/ui.js';

// En Node/CJS el paquete expone la función en `default.default`; en el bundle del
// navegador la importación ya entrega la función. Normalizamos ambos casos.
const autoTable = autoTableModule.default || autoTableModule;

export const ReportsView = {
  async mount(root) {
    destroyAll();
    const from = dayjs().subtract(5, 'month').startOf('month').format('YYYY-MM-DD');
    const to = dayjs().endOf('month').format('YYYY-MM-DD');

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Analítica</div>
          <h1 class="display">Reportes</h1>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" id="exportPdf">Exportar PDF</button>
          <button class="btn" id="exportExcel">Exportar Excel</button>
        </div>
      </header>

      <form class="filters" id="rangeForm">
        <div class="field"><label>Desde</label><input class="input input--mono" type="date" id="r-from" value="${from}" /></div>
        <div class="field"><label>Hasta</label><input class="input input--mono" type="date" id="r-to" value="${to}" /></div>
        <div class="field field--auto"><label>&nbsp;</label><button class="btn" type="submit">Aplicar</button></div>
      </form>

      <div class="grid grid--stats" style="margin-bottom:20px">
        <div class="stat stat--accent"><div class="stat__label">Ingresos</div><div class="stat__value" id="rIncome">—</div></div>
        <div class="stat"><div class="stat__label">Gastos</div><div class="stat__value" id="rExpenses">—</div></div>
        <div class="stat"><div class="stat__label">Balance</div><div class="stat__value" id="rBalance">—</div></div>
        <div class="stat"><div class="stat__label">Tasa de ahorro</div><div class="stat__value" id="rRate">—</div></div>
      </div>

      <div class="grid grid--asym">
        <div class="panel">
          <div class="panel__head"><div class="panel__title">Ingresos vs gastos por mes</div></div>
          <div class="chart-holder"><canvas id="monthlyChart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel__head"><div class="panel__title">Distribución de gastos</div></div>
          <div class="chart-holder chart-holder--sm"><canvas id="expenseDoughnut"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel__head"><div class="panel__title">Distribución de ingresos</div></div>
          <div class="chart-holder chart-holder--sm"><canvas id="incomeDoughnut"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel__head"><div class="panel__title">Movimientos</div><div class="eyebrow" id="rCount">—</div></div>
          <div class="chart-holder chart-holder--sm"><canvas id="trendChart"></canvas></div>
        </div>
      </div>
    `;

    root.querySelector('#rangeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.load(root, root.querySelector('#r-from').value, root.querySelector('#r-to').value);
    });
    root.querySelector('#exportPdf').addEventListener('click', () => this.exportPdf(root));
    root.querySelector('#exportExcel').addEventListener('click', () => this.exportExcel(root));

    this.report = await this.load(root, from, to);
  },

  async load(root, from, to) {
    try {
      const report = await apiClient.get(`/reports/full${makeQuery({ from, to })}`);

      root.querySelector('#rIncome').textContent = moneyWithCurrency(report.summary.income);
      root.querySelector('#rExpenses').textContent = moneyWithCurrency(report.summary.expenses);
      root.querySelector('#rBalance').textContent = moneyWithCurrency(report.summary.balance);
      root.querySelector('#rRate').textContent =
        report.summary.income > 0 ? pct(report.summary.savingsRate) : '—';
      root.querySelector('#rCount').textContent = `${report.transactions.length} mov.`;

      const monthly = report.monthly || [];
      lineChart(
        'monthlyChart',
        monthly.map((m) => fmtMonthShort(m.month)),
        monthly.map((m) => m.income),
        monthly.map((m) => m.expenses)
      );

      const empty = [{ name: 'Sin registros', color: '#1c1c1c', total: 1 }];
      const expenseCat = report.byCategoryExpense?.length ? report.byCategoryExpense : empty;
      const incomeCat = report.byCategoryIncome?.length ? report.byCategoryIncome : empty;

      doughnutChart(
        'expenseDoughnut',
        expenseCat.map((c) => c.name),
        expenseCat.map((c) => c.total),
        expenseCat.map((c, i) => c.color || PALETTE[i % PALETTE.length])
      );
      doughnutChart(
        'incomeDoughnut',
        incomeCat.map((c) => c.name),
        incomeCat.map((c) => c.total),
        incomeCat.map((c, i) => c.color || PALETTE[i % PALETTE.length])
      );

      barChart('trendChart', monthly.map((m) => fmtMonthShort(m.month)), monthly.map((m) => m.expenses), {
        color: '#c7f13a',
        second: monthly.map((m) => m.income)
      });

      root.chartData = report;
      return report;
    } catch (err) {
      notifyError(err.message);
      return null;
    }
  },

  buildMatrix() {
    const report = this.report;
    if (!report) throw new Error('Carga primero el reporte.');
    const headers = ['Fecha', 'Descripción', 'Tipo', 'Cuenta', 'Categoría', 'Monto'];
    const rows = report.transactions.map((t) => [
      fmtDate(t.date),
      t.description || '—',
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.accountName,
      t.categoryName || '—',
      t.type === 'income' ? t.amount : -t.amount
    ]);
    return { headers, rows, report };
  },

  exportExcel(root) {
    try {
      const { headers, rows, report } = this.buildMatrix();
      const summaryRows = [
        ['Finance Person — Reporte financiero'],
        ['Generado', dayjs(report.generatedAt).format('DD/MM/YYYY HH:mm')],
        ['Período', `${report.range.from || 'inicio'} → ${report.range.to || 'hoy'}`],
        [''],
        ['Ingresos', report.summary.income],
        ['Gastos', report.summary.expenses],
        ['Balance', report.summary.balance],
        ['Tasa de ahorro', `${report.summary.savingsRate.toFixed(2)}%`],
        [''],
        headers,
        ...rows
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(summaryRows);
      ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
      XLSX.writeFile(wb, `finance-person_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
      toast('Excel exportado.');
    } catch (err) {
      notifyError(err.message);
    }
  },

  exportPdf(root) {
    try {
      const { headers, rows, report } = this.buildMatrix();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const lime = '#0a0a0a';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('FINANCE PERSON', 40, 46);
      doc.setFontSize(10);
      doc.setTextColor('#7a7a7a');
      doc.setFont('helvetica', 'normal');
      doc.text(`Reporte financiero · ${report.user.name} · ${report.user.email}`, 40, 62);
      doc.text(`Período: ${report.range.from || 'inicio'} → ${report.range.to || 'hoy'}`, 40, 76);
      doc.text(`Generado: ${dayjs(report.generatedAt).format('DD/MM/YYYY HH:mm')}`, 40, 88);

      doc.setFontSize(11);
      doc.setTextColor('#0a0a0a');
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen', 40, 116);
      doc.setDrawColor('#2b2b2b');
      doc.line(40, 120, 550, 120);

      autoTable(doc, {
        startY: 128,
        head: [['Concepto', 'Valor']],
        body: [
          ['Ingresos', `$${report.summary.income.toLocaleString('es-AR')}`],
          ['Gastos', `$${report.summary.expenses.toLocaleString('es-AR')}`],
          ['Balance', `$${report.summary.balance.toLocaleString('es-AR')}`],
          ['Tasa de ahorro', `${report.summary.savingsRate.toFixed(2)}%`],
          ['Movimientos', String(report.transactions.length)]
        ],
        theme: 'grid',
        styles: { fontSize: 9, textColor: '#101010' },
        headStyles: { fillColor: '#0a0a0a', textColor: '#c7f13a', fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } }
      });

      doc.text('Detalle de movimientos', 40, doc.lastAutoTable.finalY + 40);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 48,
        head: [headers],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8, textColor: '#222' },
        headStyles: { fillColor: '#c7f13a', textColor: '#0a0a0a', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: '#f5f5f5' },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            data.cell.styles.halign = 'right';
            const val = data.cell.raw;
            data.cell.text = [`$${Math.abs(Number(val) || 0).toLocaleString('es-AR')}`];
          }
        }
      });

      doc.save(`finance-person_${dayjs().format('YYYYMMDD_HHmm')}.pdf`);
      toast('PDF exportado.');
    } catch (err) {
      notifyError(err.message);
    }
  }
};