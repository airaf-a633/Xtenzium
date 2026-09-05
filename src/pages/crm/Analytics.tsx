import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorState, PageHeader, SegmentedControl, SkeletonTiles, Stat } from '../../components/crm/ui';
import { BarRows, ChartCard, Funnel, LineChart } from '../../components/crm/charts/Charts';

/* Site analytics — first-party, from `page_events` (migration 011).
 *
 * ── Why this page reads views, when Dashboard reads tables ─────────
 *
 * Dashboard fetches raw rows and aggregates in lib/reporting, and that
 * is right for it: deals, projects and tasks are hundreds of rows, and
 * doing the maths in TypeScript keeps the definitions readable and
 * testable next to the page that shows them.
 *
 * Events are a different shape of data. A single visitor produces a
 * pageview, four scroll thresholds and any clicks, so this table grows
 * per interaction rather than per project — thousands of rows a week on
 * a quiet site. Pulling that to the browser to count it would move
 * megabytes to compute five numbers, and it gets worse every week it
 * works.
 *
 * So the aggregation is in SQL, and the deviation from the house pattern
 * is deliberate rather than accidental. The three views are the API:
 * analytics_daily, analytics_pages, analytics_attribution.
 */

type DailyRow = {
  day: string;
  pageviews: number;
  visitors: number;
  form_submits: number;
  estimates_completed: number;
};

type PageRow = {
  path: string;
  pageviews: number;
  visitors: number;
  avg_scroll_percent: number | null;
  form_submits: number;
};

type AttributionRow = {
  referring_host: string | null;
  landing_path: string;
  sessions: number;
  leads: number;
  conversion_percent: number | null;
};

type Range = '7' | '30' | '90';

const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const int = (v: number) => v.toLocaleString('en-GB');
const pct = (v: number) => `${v}%`;

/* Direct traffic arrives with no referrer. "—" in a table reads as
   missing data; this is not missing, it is a category. */
const hostLabel = (h: string | null) => h ?? 'Direct / none';

const Analytics = () => {
  const [range, setRange] = useState<Range>('30');
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [attribution, setAttribution] = useState<AttributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /* The table may not exist yet — the migration is applied by hand — and
     that is a different message from a request that failed. */
  const [notInstalled, setNotInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - Number(range));
    const sinceIso = since.toISOString();

    Promise.all([
      supabase.from('analytics_daily').select('*').gte('day', sinceIso).order('day'),
      supabase.from('analytics_pages').select('*').limit(12),
      supabase.from('analytics_attribution').select('*').limit(12),
    ])
      .then(([dailyResult, pagesResult, attributionResult]) => {
        if (cancelled) return;

        /* Postgres reports an unknown relation as 42P01. Anything else is
           a real failure and should not be dressed up as a setup step.
           All three are checked, not just the first: 011 was applied once
           in a state where the daily view existed and the attribution one
           did not, and that showed an empty chart rather than saying the
           migration was half applied. */
        const results = [dailyResult, pagesResult, attributionResult];
        const missing = results.find(r => r.error?.code === '42P01');
        const broken = results.find(r => r.error && r.error.code !== '42P01');

        if (missing) {
          setNotInstalled(true);
          setLoading(false);
          return;
        }
        if (broken) {
          setFailed(true);
          setLoading(false);
          return;
        }

        setDaily((dailyResult.data ?? []) as DailyRow[]);
        setPages((pagesResult.data ?? []) as PageRow[]);
        setAttribution((attributionResult.data ?? []) as AttributionRow[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const totals = useMemo(() => {
    const sum = (k: keyof DailyRow) =>
      daily.reduce((acc, d) => acc + (Number(d[k]) || 0), 0);
    const visitors = sum('visitors');
    const leads = sum('form_submits') + sum('estimates_completed');
    return {
      pageviews: sum('pageviews'),
      visitors,
      leads,
      /* The number this page exists for. Everything above it is traffic;
         this is whether the traffic did anything. */
      conversion: visitors ? Math.round((leads / visitors) * 1000) / 10 : 0,
    };
  }, [daily]);

  const trend = useMemo(
    () => [
      {
        name: 'Visitors',
        /* Slots assigned in fixed order, never cycled — the kit's rule, so
           visitors is always the same colour on every render. */
        slot: 1 as const,
        points: daily.map(d => ({
          label: new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          value: Number(d.visitors) || 0,
        })),
      },
      {
        name: 'Enquiries',
        slot: 2 as const,
        points: daily.map(d => ({
          label: new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          value: (Number(d.form_submits) || 0) + (Number(d.estimates_completed) || 0),
        })),
      },
    ],
    [daily],
  );

  /* Site-wide funnel. Read depth stands in for "engaged": somebody who
     reached three-quarters of a page did not bounce, whatever else they
     did afterwards. */
  const funnelSteps = useMemo(() => {
    const visitors = totals.visitors;
    const engaged = pages.reduce(
      (acc, p) => acc + (Number(p.avg_scroll_percent) >= 50 ? Number(p.visitors) || 0 : 0),
      0,
    );
    const enquiries = totals.leads;
    const step = (label: string, reached: number, previous: number | null) => ({
      label,
      reached,
      conversion:
        previous === null || previous === 0
          ? null
          : Math.round((reached / previous) * 1000) / 10,
    });
    return [
      step('Visitors', visitors, null),
      step('Read on', Math.min(engaged, visitors), visitors),
      step('Enquired', enquiries, Math.min(engaged, visitors) || visitors),
    ];
  }, [totals, pages]);

  if (failed) {
    return (
      <>
        <PageHeader title="Site analytics" />
        <ErrorState
          title="Could not load analytics"
          body="The request did not complete. Reload, and if it persists check the Supabase project is reachable."
        />
      </>
    );
  }

  if (notInstalled) {
    return (
      <>
        <PageHeader title="Site analytics" />
        <ErrorState
          title="Not installed yet"
          body="Run 011_analytics.sql and then 012_analytics_fixes.sql in the SQL editor. One of the views is missing, which means the migrations are only part applied. Nothing is collected until they are, and the site keeps working either way."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Site analytics"
        actions={
          <SegmentedControl
            label="Date range"
            options={RANGES}
            value={range}
            onChange={setRange}
          />
        }
      />

      {loading ? (
        <SkeletonTiles />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Visitors" value={int(totals.visitors)} />
            <Stat label="Pageviews" value={int(totals.pageviews)} />
            <Stat label="Enquiries" value={int(totals.leads)} />
            <Stat label="Visitor to enquiry" value={pct(totals.conversion)} />
          </div>

          <ChartCard
            title="Visitors and enquiries"
            hint="Enquiries are contact submissions plus completed estimates."
            rows={daily.map(d => [
              new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              `${int(Number(d.visitors) || 0)} visitors, ${int(
                (Number(d.form_submits) || 0) + (Number(d.estimates_completed) || 0),
              )} enquiries`,
            ])}
          >
            <LineChart series={trend} format={int} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Where enquiries come from"
              hint="Sessions joined to the enquiries they produced, by landing page."
              rows={attribution.map(a => [
                `${hostLabel(a.referring_host)} → ${a.landing_path}`,
                `${int(a.sessions)} sessions, ${int(a.leads)} leads`,
              ])}
            >
              <BarRows
                data={attribution
                  .filter(a => a.leads > 0)
                  .slice(0, 8)
                  .map(a => ({ label: `${hostLabel(a.referring_host)} · ${a.landing_path}`, value: a.leads }))}
                format={int}
              />
            </ChartCard>

            <ChartCard
              title="Most read pages"
              hint="Average scroll depth shows whether a page is read or bounced."
              rows={pages.map(p => [
                p.path,
                `${int(p.pageviews)} views, ${
                  p.avg_scroll_percent === null ? 'no depth recorded' : `${p.avg_scroll_percent}% read`
                }`,
              ])}
            >
              <BarRows
                data={pages.slice(0, 8).map(p => ({ label: p.path, value: p.pageviews }))}
                format={int}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Visitor to enquiry"
            hint="Read on counts visitors who passed half of a page — engaged rather than bounced."
            rows={funnelSteps.map(s => [
              s.label,
              `${int(s.reached)}${s.conversion === null ? '' : ` (${s.conversion}%)`}`,
            ])}
          >
            <Funnel steps={funnelSteps} />
          </ChartCard>
        </div>
      )}
    </>
  );
};

export default Analytics;
