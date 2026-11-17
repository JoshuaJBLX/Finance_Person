import { Chart, registerables } from 'chart.js';
import dayjs from 'dayjs';

Chart.register(...registerables);
Chart.defaults.color = '#7a7a7a';
Chart.defaults.font.family = "'Space Mono', monospace";
Chart.defaults.font.size = 11;
Chart.defaults.borderColor = '#1f1f1f';

const charts = new Map();
let counter = 0;

const isHeadless = () => typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export function createChart(id, config) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return null;
  if (isHeadless()) { // en pruebas headless (jsdom) no se puede dibujar canvas
    charts.set(id, { chart: { destroy() {} }, el });
    counter += 1;
    return charts.get(id).chart;
  }
  const chart = new Chart(el, config);
  charts.set(id, { chart, el });
  return chart;
}

export function destroyChart(id) {
  const entry = charts.get(id);
  if (entry) {
    entry.chart.destroy();
    charts.delete(id);
    counter -= 1;
  }
}

export function destroyAll() {
  charts.forEach((entry, id) => {
    entry.chart.destroy();
    charts.delete(id);
  });
}

const grid = { color: '#1c1c1c' };
const ticks = { color: '#7a7a7a' };

const tooltipStyle = {
  backgroundColor: '#161616',
  borderColor: '#2b2b2b',
  borderWidth: 1,
  titleFont: { family: "'Space Grotesk', sans-serif", weight: '600' },
  bodyFont: { family: "'Space Mono', monospace" },
  padding: 12,
  cornerRadius: 2
};

export function lineChart(id, labels, income, expenses) {
  return createChart(id, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: income,
          borderColor: '#c7f13a',
          backgroundColor: 'rgba(199,241,58,0.20)',
          fill: true,
          tension: 0.32,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#c7f13a',
          pointBorderColor: '#0a0a0a',
          pointBorderWidth: 1,
          borderWidth: 3
        },
        {
          label: 'Gastos',
          data: expenses,
          borderColor: '#ff5c57',
          backgroundColor: 'rgba(255,92,87,0.18)',
          fill: true,
          tension: 0.32,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ff5c57',
          pointBorderColor: '#0a0a0a',
          pointBorderWidth: 1,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: tooltipStyle, legend: { labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { grid: { display: false }, ticks }, y: { grid, ticks, beginAtZero: true } }
    }
  });
}

export function doughnutChart(id, labels, data, colors) {
  return createChart(id, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: '#0a0a0a',
          borderWidth: 3,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        tooltip: tooltipStyle,
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 7, color: '#d9d9d9', padding: 14 }
        }
      }
    }
  });
}

export function barChart(id, labels, values, { color = '#c7f13a', horizontal = false, second = null } = {}) {
  const datasets = [
    {
      label: 'Gastos',
      data: values,
      backgroundColor: color,
      borderRadius: 2,
      borderSkipped: false,
      maxBarThickness: 26
    }
  ];
  if (second) {
    datasets.push({
      label: 'Ingresos',
      data: second,
      backgroundColor: '#7a7a7a',
      borderRadius: 2,
      borderSkipped: false,
      maxBarThickness: 26
    });
  }
  return createChart(id, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: tooltipStyle, legend: { display: !!second, labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { grid, ticks, ...(!horizontal && { beginAtZero: true }) }, y: { grid: { color: '#161616' }, ticks } }
    }
  });
}

export const PALETTE = [
  '#c7f13a', '#f5f5f5', '#d9d9d9', '#9dd102', '#7a7a7a',
  '#ff5c57', '#2b2b2b', '#5fd0ff', '#ffd05f', '#7dff9a',
  '#c78bff', '#ff8b7d'
];