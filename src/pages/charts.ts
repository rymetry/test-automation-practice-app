import { api } from '../api';
import { esc, html, q } from '../dom';
import type { Page } from '../router';
import type { Metrics } from '../types';
import { page } from '../ui/page';

const PIE_COLORS = ['var(--accent)', 'var(--warning)', 'var(--success)'];

function barChart(data: { label: string; value: number }[], titleId: string): string {
  const width = 480;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 36, left: 36 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const bars = data
    .map((d, i) => {
      const h = (d.value / max) * innerH;
      const x = pad.left + i * slot + slot * 0.15;
      const y = pad.top + innerH - h;
      return `
        <g>
          <title>${esc(d.label)}: ${d.value}</title>
          <rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(slot * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="4" />
          <text x="${(x + slot * 0.35).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${d.value}</text>
          <text x="${(x + slot * 0.35).toFixed(1)}" y="${height - 12}" text-anchor="middle">${esc(d.label)}</text>
        </g>
      `;
    })
    .join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId}">
      <line class="axis" x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" />
      ${bars}
    </svg>
  `;
}

function pieChart(data: { label: string; value: number }[], titleId: string): string {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const r = 80;
  const cx = 120;
  const cy = 120;
  let angle = -Math.PI / 2;
  const slices = data
    .map((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += sweep;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const path =
        d.value === total
          ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
          : `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
      return `<path d="${path}" fill="${PIE_COLORS[i % PIE_COLORS.length]}" stroke="var(--surface)" stroke-width="2"><title>${esc(d.label)}: ${d.value}</title></path>`;
    })
    .join('');
  const legend = data
    .map(
      (d, i) => `
        <g transform="translate(240 ${70 + i * 28})">
          <rect width="14" height="14" rx="3" fill="${PIE_COLORS[i % PIE_COLORS.length]}" />
          <text x="22" y="12">${esc(d.label)} (${d.value})</text>
        </g>
      `,
    )
    .join('');
  return `<svg viewBox="0 0 420 240" role="img" aria-labelledby="${titleId}">${slices}${legend}</svg>`;
}

function dataTable(label: string, head: [string, string], rows: [string, number][]): string {
  return `
    <table aria-label="${esc(label)}">
      <thead><tr><th scope="col">${esc(head[0])}</th><th scope="col">${esc(head[1])}</th></tr></thead>
      <tbody>${rows.map(([name, value]) => `<tr><td>${esc(name)}</td><td>${value}</td></tr>`).join('')}</tbody>
    </table>
  `;
}

/** Two SVG charts fed by GET /api/metrics, each followed by a table with the same numbers. */
export const chartsPage: Page = async (root) => {
  const view = page(
    'Charts',
    'グラフは SVG で描いています。棒の位置や長さをテストで読むのは大変なので、同じ値の table を下に置き、テストはそちらか API（GET /api/metrics）で確かめます。値は Smart table の連絡先と Board のカードから集計しています。',
    `
      <div class="row" style="margin-bottom: var(--space-3)">
        <button type="button" data-testid="reload-charts">Reload</button>
      </div>
      <div class="grid-2" data-slot="charts"></div>
    `,
  );
  root.append(view);
  const slot = q(view, '[data-slot="charts"]');

  function draw(metrics: Metrics): void {
    const ages = metrics.contactsByAgeGroup.map((d) => ({ label: d.group, value: d.count }));
    const columns = metrics.cardsByColumn.map((d) => ({ label: d.name, value: d.count }));
    slot.innerHTML = '';
    slot.append(
      html(`
        <figure class="card chart" data-testid="age-chart">
          <figcaption id="age-chart-title">Contacts by age group</figcaption>
          ${barChart(ages, 'age-chart-title')}
          ${dataTable('Contacts by age group', ['Age group', 'Contacts'], ages.map((d) => [d.label, d.value]))}
        </figure>
      `),
      html(`
        <figure class="card chart" data-testid="column-chart">
          <figcaption id="column-chart-title">Cards by column</figcaption>
          ${pieChart(columns, 'column-chart-title')}
          ${dataTable('Cards by column', ['Column', 'Cards'], columns.map((d) => [d.label, d.value]))}
        </figure>
      `),
    );
  }

  async function load(): Promise<void> {
    const result = await api.metrics();
    if (result.data) draw(result.data);
  }

  q(view, '[data-testid="reload-charts"]').addEventListener('click', () => void load());
  await load();
};
