import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/* ────────────────────────────────────────────────────────────────
   Chart primitives.

   Hand-rolled SVG rather than a charting library: four chart shapes
   don't justify 40kB and a theming layer that fights the token system.
   Everything here reads the validated chart tokens and nothing writes
   a colour.

   Shared rules, applied by construction rather than remembered:
     · marks are thin, with 4px rounded ends anchored to the baseline
     · a 2px surface gap separates adjacent fills
     · grid and axes are recessive
     · values wear ink tokens, never the series colour
     · every chart has a hover layer and a table fallback
   ──────────────────────────────────────────────────────────────── */

export interface Datum {
  label: string;
  value: number;
  /* Optional second measure, shown in the tooltip only — a count
     beside a total, for instance. */
  meta?: string;
}

/* Referenced as CSS variables rather than Tailwind classes: Tailwind
   scans source statically, so `bg-${ramp}` would never generate a rule.
   Reading the var also means the ramp re-steps itself in light mode
   with no second class list. */
const RAMP = [
  'var(--color-crm-ramp-1)',
  'var(--color-crm-ramp-2)',
  'var(--color-crm-ramp-3)',
  'var(--color-crm-ramp-4)',
  'var(--color-crm-ramp-5)',
] as const;

const rampAt = (i: number) => RAMP[Math.min(i, RAMP.length - 1)];

/* ── Frame ─────────────────────────────────────────────────────── */

export const ChartCard = ({
  title,
  hint,
  action,
  rows,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  /* The table view. Not optional — a chart without one is unreadable
     for anyone using a screen reader, and useful to everyone else when
     they want the actual number. */
  rows: Array<[string, string]>;
  children: ReactNode;
}) => {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <section className="rounded-crm-lg border border-crm-line bg-crm-surface p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 font-crm-display text-[13.5px] font-bold tracking-[-0.01em] text-crm-ink">
            {title}
          </h3>
          {hint && <p className="m-0 mt-0.5 text-[11.5px] text-crm-ink-3">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button
            type="button"
            onClick={() => setShowTable(v => !v)}
            aria-expanded={showTable}
            aria-controls={id}
            className="font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint transition-colors duration-150 ease-crm hover:text-crm-ink-2"
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>

      {showTable ? (
        <div id={id} className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="border-b border-crm-line py-1.5 pr-3 text-crm-ink-2">{label}</td>
                  <td className="crm-num border-b border-crm-line py-1.5 text-right font-crm-mono text-crm-ink">
                    {value}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-3 text-crm-ink-3">Nothing to show yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
};

/* ── Horizontal bars ───────────────────────────────────────────────
   The default for "magnitude across a handful of named things".
   Horizontal because the names are words, and words read badly
   rotated or truncated under a vertical bar. */
export const BarRows = ({
  data,
  format,
  ordinal = false,
}: {
  data: Datum[];
  format: (v: number) => string;
  /* True when the categories have an inherent order — funnel stages,
     ageing buckets — which takes the one-hue ramp so the sequence is
     visible in the colour. Otherwise every bar is slot 1, because one
     measure is one series however many bars it has. */
  ordinal?: boolean;
}) => {
  const max = Math.max(...data.map(d => d.value), 1);

  if (data.every(d => d.value === 0)) {
    return <p className="m-0 py-6 text-center text-[12.5px] text-crm-ink-3">Nothing recorded yet.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {data.map((d, i) => (
        <li key={d.label} className="group grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-3">
          <span className="truncate text-[12px] text-crm-ink-2" title={d.label}>
            {d.label}
          </span>
          <span className="relative h-2.5 overflow-hidden rounded-crm-sm bg-crm-raised">
            <span
              className="block h-full rounded-crm-sm transition-[width] duration-500 ease-crm"
              style={{
                width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                background: ordinal ? rampAt(i) : 'var(--color-crm-chart-2)',
              }}
              title={d.meta ? `${format(d.value)} · ${d.meta}` : format(d.value)}
            />
          </span>
          <span className="crm-num w-[92px] text-right font-crm-mono text-[11.5px] text-crm-ink">
            {format(d.value)}
          </span>
        </li>
      ))}
    </ul>
  );
};

/* ── Funnel ────────────────────────────────────────────────────────
   Ordinal by definition. Conversion is labelled between steps rather
   than encoded, because the number is the point. */
export const Funnel = ({
  steps,
}: {
  steps: Array<{ label: string; reached: number; conversion: number | null }>;
}) => {
  const max = Math.max(...steps.map(s => s.reached), 1);

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {steps.map((step, i) => (
        <li key={step.label}>
          {i > 0 && (
            <div className="flex items-center gap-2 py-0.5 pl-[88px]">
              <span className="h-3 w-px bg-crm-line-hi" aria-hidden="true" />
              <span className="crm-num font-crm-mono text-[10px] text-crm-faint">
                {step.conversion === null ? '—' : `${step.conversion}%`}
              </span>
            </div>
          )}
          <div className="grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-3">
            <span className="truncate text-[12px] text-crm-ink-2">{step.label}</span>
            <span className="relative h-2.5 overflow-hidden rounded-crm-sm bg-crm-raised">
              <span
                className="block h-full rounded-crm-sm"
                style={{
                  width: `${Math.max((step.reached / max) * 100, step.reached > 0 ? 2 : 0)}%`,
                  background: rampAt(i),
                }}
              />
            </span>
            <span className="crm-num w-[92px] text-right font-crm-mono text-[11.5px] text-crm-ink">
              {step.reached}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};

/* ── Time series ───────────────────────────────────────────────────
   Two series maximum here — won and lost. A legend is present because
   there are two, and both are direct-labelled at their last point, so
   identity never rests on colour alone. */
export interface Series {
  name: string;
  /* Slot index into the validated categorical order. Assigned by the
     caller in fixed order and never cycled. */
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  points: Array<{ label: string; value: number }>;
}

const SLOT = {
  1: 'var(--color-crm-chart-1)',
  2: 'var(--color-crm-chart-2)',
  3: 'var(--color-crm-chart-3)',
  4: 'var(--color-crm-chart-4)',
  5: 'var(--color-crm-chart-5)',
  6: 'var(--color-crm-chart-6)',
} as const;

export const LineChart = ({
  series,
  format,
  height = 148,
}: {
  series: Series[];
  format: (v: number) => string;
  height?: number;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const labels = series[0]?.points.map(p => p.label) ?? [];
  const max = Math.max(...series.flatMap(s => s.points.map(p => p.value)), 1);

  /* The SVG stretches horizontally (preserveAspectRatio="none") so the
     line fills whatever width it gets. That is fine for a path with a
     non-scaling stroke — and fatal for anything with a shape. A
     <circle r=3> in this box renders 28px wide and 6px tall: an
     ellipse, not a point.

     So the line lives in the SVG and every *marker* is HTML positioned
     over it. The viewBox height matches the rendered height exactly,
     which makes the y scale 1:1 with pixels and lets both agree. */
  const padTop = 8;
  const padBottom = 20;
  const plotH = height - padTop - padBottom;

  /* The scale is inset rather than the layers being padded. Padding
     the plot but not the marker layer made the two boxes 10px apart —
     measured, not guessed. With one coordinate space over one box they
     cannot drift, and the line stops short of the edge too, which it
     should. */
  const INSET = 2;
  const xPct = (i: number) =>
    labels.length <= 1 ? 50 : INSET + (i / (labels.length - 1)) * (100 - INSET * 2);
  const y = (v: number) => padTop + plotH - (v / max) * plotH;

  if (labels.length === 0) {
    return <p className="m-0 py-6 text-center text-[12.5px] text-crm-ink-3">Nothing recorded yet.</p>;
  }

  return (
    <div>
      {/* Two layers over one box: the plot, and the markers on top. */}
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          style={{ height }}
          className="w-full"
          role="img"
          aria-label={`${series.map(s => s.name).join(' and ')} by month`}
        >
          {[0, 0.5, 1].map(t => (
            <line
              key={t}
              x1={0}
              x2={100}
              y1={padTop + plotH * t}
              y2={padTop + plotH * t}
              stroke="var(--color-crm-grid)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {series.map(s => (
            <polyline
              key={s.name}
              points={s.points.map((p, i) => `${xPct(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={SLOT[s.slot]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Marker layer — same box, same 0–100 scale. */}
        <div className="pointer-events-none absolute inset-0">
          {hover !== null && (
            <span
              aria-hidden="true"
              className="absolute w-px bg-crm-line-hi"
              style={{ left: `${xPct(hover)}%`, top: padTop, height: plotH }}
            />
          )}

          {/* Round, because they are HTML rather than SVG shapes in a
              non-uniformly scaled viewBox. */}
          {series.map(s => {
            const last = s.points.length - 1;
            return (
              <span
                key={s.name}
                aria-hidden="true"
                className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-crm-surface"
                style={{
                  left: `${xPct(last)}%`,
                  top: y(s.points[last]?.value ?? 0),
                  background: SLOT[s.slot],
                }}
              />
            );
          })}
        </div>

        {/* Hit targets span the full column height, so catching the
            tooltip is not a pixel hunt along the line. */}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={`${label}: ${series.map(s => `${s.name} ${format(s.points[i]?.value ?? 0)}`).join(', ')}`}
              className="flex-1 cursor-default"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
            />
          ))}
        </div>
      </div>

      <div className="mt-1 flex justify-between">
        {labels.map((label, i) => (
          <span
            key={label}
            className={cn('font-crm-mono text-[10px]', hover === i ? 'text-crm-ink' : 'text-crm-faint')}
          >
            {label}
          </span>
        ))}
      </div>

      {hover !== null && (
        <div className="mt-2 rounded-crm-sm border border-crm-line-hi bg-crm-raised px-2.5 py-1.5">
          <div className="font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint">
            {labels[hover]}
          </div>
          {series.map(s => (
            <div key={s.name} className="mt-0.5 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: SLOT[s.slot] }}
                aria-hidden="true"
              />
              <span className="text-[11.5px] text-crm-ink-2">{s.name}</span>
              <span className="crm-num ml-auto font-crm-mono text-[11.5px] text-crm-ink">
                {format(s.points[hover]?.value ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {series.map(s => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-4 rounded-full"
                style={{ background: SLOT[s.slot] }}
                aria-hidden="true"
              />
              <span className="text-[11.5px] text-crm-ink-3">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
