import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { api } from '../api';
import type { Metrics } from '../types';
import { PageLayout } from '../ui/PageLayout';

interface ChartDatum {
  label: string;
  value: number;
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const;

function BarChart({ data, titleId }: { data: ChartDatum[]; titleId: string }): JSX.Element {
  const width = 480;
  const height = 240;
  const pad = { top: 24, right: 16, bottom: 36, left: 36 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = data.length > 0 ? innerW / data.length : innerW;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = (pad.top + innerH * (1 - ratio)).toFixed(1);
        return <line key={ratio} className="grid-line" x1={pad.left} y1={y} x2={width - pad.right} y2={y} />;
      })}
      <line className="axis" x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} />
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = pad.left + i * slot + slot * 0.15;
        const y = pad.top + innerH - h;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value}`}</title>
            <rect
              className="bar"
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              width={(slot * 0.7).toFixed(1)}
              height={h.toFixed(1)}
              rx="4"
            />
            <text x={(x + slot * 0.35).toFixed(1)} y={(y - 6).toFixed(1)} textAnchor="middle">
              {d.value}
            </text>
            <text x={(x + slot * 0.35).toFixed(1)} y={height - 10} textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data, titleId }: { data: ChartDatum[]; titleId: string }): JSX.Element {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const r = 80;
  const cx = 120;
  const cy = 120;
  let angle = -Math.PI / 2;

  const slices = data.map((d, i) => {
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
    return {
      label: d.label,
      value: d.value,
      path,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    };
  });

  return (
    <svg viewBox="0 0 420 240" role="img" aria-labelledby={titleId}>
      {slices.map((slice) => (
        <path key={slice.label} d={slice.path} fill={slice.fill} stroke="var(--surface)" strokeWidth="2">
          <title>{`${slice.label}: ${slice.value}`}</title>
        </path>
      ))}
      {data.map((d, i) => (
        <g key={d.label} transform={`translate(240 ${70 + i * 28})`}>
          <rect width="14" height="14" rx="3" fill={PIE_COLORS[i % PIE_COLORS.length]} />
          <text x="22" y="12">{`${d.label} (${d.value})`}</text>
        </g>
      ))}
    </svg>
  );
}

function DataTable({
  label,
  head,
  rows,
}: {
  label: string;
  head: [string, string];
  rows: [string, number][];
}): JSX.Element {
  return (
    <table aria-label={label}>
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col" className="num">
            {head[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, value]) => (
          <tr key={name}>
            <td>{name}</td>
            <td className="num">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** GET /api/metrics の集計を 2 つの SVG グラフと直下の同値テーブルで描画するページ。 */
export function ChartsPage(): JSX.Element {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    const result = await api.metrics();
    if (requestId !== requestIdRef.current) return;
    if (result.data) setMetrics(result.data);
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const ages: ChartDatum[] = metrics
    ? metrics.contactsByAgeGroup.map((d) => ({ label: d.group, value: d.count }))
    : [];
  const columns: ChartDatum[] = metrics
    ? metrics.cardsByColumn.map((d) => ({ label: d.name, value: d.count }))
    : [];

  return (
    <PageLayout
      title="Charts"
      intro="グラフは SVG で描いています。棒の位置や長さをテストで読むのは大変なので、同じ値の table を下に置き、テストはそちらか API（GET /api/metrics）で確かめます。値は Smart table の連絡先と Board のカードから集計しています。"
    >
      <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
        <button
          type="button"
          data-testid="reload-charts"
          onClick={() => {
            void load();
          }}
        >
          Reload
        </button>
      </div>
      <div className="grid-2 grid-2-stretch" data-slot="charts">
        {metrics ? (
          <>
            <figure className="card chart" data-testid="age-chart">
              <figcaption id="age-chart-title">Contacts by age group</figcaption>
              <BarChart data={ages} titleId="age-chart-title" />
              <DataTable
                label="Contacts by age group"
                head={['Age group', 'Contacts']}
                rows={ages.map((d) => [d.label, d.value])}
              />
            </figure>
            <figure className="card chart" data-testid="column-chart">
              <figcaption id="column-chart-title">Cards by column</figcaption>
              <PieChart data={columns} titleId="column-chart-title" />
              <DataTable
                label="Cards by column"
                head={['Column', 'Cards']}
                rows={columns.map((d) => [d.label, d.value])}
              />
            </figure>
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}

