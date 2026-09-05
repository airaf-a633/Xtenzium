import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ErrorState, PageHeader, SegmentedControl, SkeletonTiles, Stat } from '../../components/crm/ui';
import { BarRows, ChartCard, Funnel, LineChart } from '../../components/crm/charts/Charts';
import type { Datum } from '../../components/crm/charts/Charts';

/* Site analytics — first-party, from `page_events` (migrations 011–013).
 *
 * ── Why this page reads views, when Dashboard reads tables ─────────
 *
 * Dashboard fetches raw rows and aggregates in lib/reporting, and that
 * is right for it: deals, projects and tasks are hundreds of rows, and
 * doing the maths in TypeScript keeps the definitions readable and
 * testable next to the page that shows them.
 *
 * Events are a different shape. A single visitor produces a pageview,
 * four scroll thresholds and any clicks, so this table grows per
 * interaction rather than per project — thousands of rows a week on a
 * quiet site. Pulling that to the browser to count it would move
 * megabytes to compute five numbers, and it gets worse every week it
 * works.
 *
 * So the first aggregation is in SQL: every view returns grouped counts
 * per day, keyed by one dimension. The second — summing those days into
 * whichever range is selected — is here, because it is addition, and
 * because it lets one fetch serve all three ranges.
 *
 * ── Local time ─────────────────────────────────────────────────────
 *
 * Days and hours are bucketed Asia/Karachi in SQL. "Busiest hour" is a
 * claim about when people are awake; in UTC it is a claim about nothing.
 */

type Row = Record<string, unknown>;

type DailyRow = { day: string; pageviews: number; visitors: number; form_submits: number; estimates_completed: number };
type PageRow = { day: string; path: string; pageviews: number; visitors: number; avg_scroll_percent: number | null; form_submits: number };
type WhenRow = { day: string; dow: number; hour: number; sessions: number; pageviews: number };
type ReferrerRow = { day: string; referring_host: string | null; sessions: number; pageviews: number };
type DeviceRow = { day: string; device: string | null; browser: string | null; os: string | null; sessions: number };
type GeoRow = { day: string; country: string | null; city: string | null; sessions: number };
type QualityRow = { day: string; sessions: number; bounced: number; avg_pageviews: number | null; avg_seconds: number | null };
type OutboundRow = { day: string; host: string | null; clicks: number };
type AttributionRow = { referring_host: string | null; landing_path: string; sessions: number; leads: number; conversion_percent: number | null };
type RealtimeRow = { path: string; visitors: number; last_seen: string };

type SearchQueryRow = { day: string; query: string; clicks: number; impressions: number; position: number | null };
type SearchPageRow = { day: string; page: string; clicks: number; impressions: number; position: number | null };
type SearchDailyRow = { day: string; clicks: number; impressions: number; queries: number; ctr_percent: number | null; position: number | null };

type Range = '7' | '30' | '90';

const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

/* Every view except realtime carries `day`, so one fetch per range and
   the same list drives the loader, the 42P01 check and the state. */
const VIEWS = [
  'analytics_daily',
  'analytics_pages',
  'analytics_when',
  'analytics_referrers',
  'analytics_devices',
  'analytics_geo',
  'analytics_quality',
  'analytics_outbound',
] as const;

const int = (v: number) => v.toLocaleString('en-GB');
const pct = (v: number) => `${v}%`;
const num = (v: unknown) => Number(v) || 0;

const duration = (s: number) =>
  s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;

/* Direct traffic arrives with no referrer. "—" in a table reads as
   missing data; this is not missing, it is a category. And an unknown
   country is a request the edge could not place, not a country. */
const hostLabel = (h: string | null) => h ?? 'Direct / none';
const orUnknown = (v: string | null) => v ?? 'Unknown';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Sum `value` per key, then order by size. The shape every panel wants. */
function rank<T extends Row>(
  rows: T[],
  key: (r: T) => string,
  value: (r: T) => number,
  limit = 10,
): Datum[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(key(r), (totals.get(key(r)) ?? 0) + value(r));
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, val]) => ({ label, value: val }));
}

const Analytics = () => {
  const [range, setRange] = useState<Range>('30');
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [when, setWhen] = useState<WhenRow[]>([]);
  const [referrers, setReferrers] = useState<ReferrerRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [outbound, setOutbound] = useState<OutboundRow[]>([]);
  const [attribution, setAttribution] = useState<AttributionRow[]>([]);
  const [realtime, setRealtime] = useState<RealtimeRow[]>([]);
  /* Search Console lives in its own request and its own state.
     It is a separate migration with a separate manual setup in Google
     Cloud, so it will be absent for a while after the rest works — and
     folding it into the check above would take the whole page down to a
     "not installed" screen for a panel that is merely pending. */
  const [queries, setQueries] = useState<SearchQueryRow[]>([]);
  const [searchPages, setSearchPages] = useState<SearchPageRow[]>([]);
  const [searchDaily, setSearchDaily] = useState<SearchDailyRow[]>([]);
  const [searchReady, setSearchReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /* The views may not exist yet — migrations are applied by hand — and
     that is a different message from a request that failed. */
  const [notInstalled, setNotInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - Number(range));
    const day = since.toISOString().slice(0, 10);

    Promise.all([
      ...VIEWS.map(v => supabase.from(v).select('*').gte('day', day)),
      supabase.from('analytics_attribution').select('*').limit(40),
      supabase.from('analytics_realtime').select('*').limit(10),
    ])
      .then(results => {
        if (cancelled) return;

        /* Postgres reports an unknown relation as 42P01. Anything else is
           a real failure and should not be dressed up as a setup step.
           Every result is checked, not just the first: 011 was once
           applied in a state where some views existed and others did not,
           and that showed empty charts rather than saying so. */
        if (results.some(r => r.error?.code === '42P01')) {
          setNotInstalled(true);
          setLoading(false);
          return;
        }
        if (results.some(r => r.error)) {
          setFailed(true);
          setLoading(false);
          return;
        }

        const [d, p, w, rf, dv, g, q, ob, at, rt] = results.map(r => r.data ?? []);
        setDaily(d as unknown as DailyRow[]);
        setPages(p as unknown as PageRow[]);
        setWhen(w as unknown as WhenRow[]);
        setReferrers(rf as unknown as ReferrerRow[]);
        setDevices(dv as unknown as DeviceRow[]);
        setGeo(g as unknown as GeoRow[]);
        setQuality(q as unknown as QualityRow[]);
        setOutbound(ob as unknown as OutboundRow[]);
        setAttribution(at as unknown as AttributionRow[]);
        setRealtime(rt as unknown as RealtimeRow[]);
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

  useEffect(() => {
    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - Number(range));
    const day = since.toISOString().slice(0, 10);

    Promise.all([
      supabase.from('search_console_queries').select('*').gte('day', day),
      supabase.from('search_console_pages').select('*').gte('day', day),
      supabase.from('search_console_daily').select('*').gte('day', day).order('day'),
    ]).then(([q, p, d]) => {
      if (cancelled) return;
      /* Absent is the expected state until the sync has run once, and it
         is not an error worth showing. */
      if (q.error || p.error || d.error) {
        setSearchReady(false);
        return;
      }
      setQueries((q.data ?? []) as unknown as SearchQueryRow[]);
      setSearchPages((p.data ?? []) as unknown as SearchPageRow[]);
      setSearchDaily((d.data ?? []) as unknown as SearchDailyRow[]);
      setSearchReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const search = useMemo(() => {
    const clicks = searchDaily.reduce((a, r) => a + num(r.clicks), 0);
    const impressions = searchDaily.reduce((a, r) => a + num(r.impressions), 0);
    /* Position averaged over impressions, not over days: ranking 3rd for
       a query nobody searches should not outweigh ranking 30th for one
       that hundreds do. */
    const posWeight = searchDaily.reduce((a, r) => a + num(r.position) * num(r.impressions), 0);
    return {
      clicks,
      impressions,
      ctr: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
      position: impressions ? Math.round((posWeight / impressions) * 10) / 10 : 0,
    };
  }, [searchDaily]);

  const topQueries = useMemo(
    () => rank(queries, r => r.query, r => num(r.impressions), 12),
    [queries],
  );
  const topSearchPages = useMemo(
    () => rank(searchPages, r => r.page, r => num(r.impressions), 10),
    [searchPages],
  );

  const totals = useMemo(() => {
    const sum = (k: keyof DailyRow) => daily.reduce((acc, r) => acc + num(r[k]), 0);
    const visitors = sum('visitors');
    const leads = sum('form_submits') + sum('estimates_completed');

    const sessions = quality.reduce((a, r) => a + num(r.sessions), 0);
    const bounced = quality.reduce((a, r) => a + num(r.bounced), 0);
    /* Averages weighted by sessions, not a mean of daily means — a day
       with four visitors would otherwise count as much as a day with
       four hundred. */
    const secondsTotal = quality.reduce((a, r) => a + num(r.avg_seconds) * num(r.sessions), 0);

    return {
      pageviews: sum('pageviews'),
      visitors,
      leads,
      /* The number this page exists for. Everything above it is traffic;
         this is whether the traffic did anything. */
      conversion: visitors ? Math.round((leads / visitors) * 1000) / 10 : 0,
      bounce: sessions ? Math.round((bounced / sessions) * 1000) / 10 : 0,
      avgSeconds: sessions ? secondsTotal / sessions : 0,
    };
  }, [daily, quality]);

  const trend = useMemo(
    () => [
      {
        name: 'Visitors',
        /* Slots assigned in fixed order, never cycled — the kit's rule, so
           visitors is always the same colour on every render. */
        slot: 1 as const,
        points: daily.map(d => ({
          label: new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          value: num(d.visitors),
        })),
      },
      {
        name: 'Enquiries',
        slot: 2 as const,
        points: daily.map(d => ({
          label: new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          value: num(d.form_submits) + num(d.estimates_completed),
        })),
      },
    ],
    [daily],
  );

  /* Days and hours keep their natural order rather than being ranked:
     the shape of a week and the shape of a day are the information, and
     sorting by size destroys both. Hours are trimmed to the range that
     actually saw traffic, so a quiet site is not eighteen empty rows. */
  const byWeekday = useMemo(() => {
    const totals = new Array(7).fill(0);
    for (const r of when) totals[r.dow] += num(r.sessions);
    return DAYS.map((label, i) => ({ label, value: totals[i] }));
  }, [when]);

  const byHour = useMemo(() => {
    const totals = new Array(24).fill(0);
    for (const r of when) totals[r.hour] += num(r.sessions);
    const first = totals.findIndex(v => v > 0);
    const last = totals.length - 1 - [...totals].reverse().findIndex(v => v > 0);
    if (first < 0) return [];
    return totals
      .slice(first, last + 1)
      .map((value, i) => ({ label: `${String(first + i).padStart(2, '0')}:00`, value }));
  }, [when]);

  const topPages = useMemo(() => {
    const totals = new Map<string, { views: number; scroll: number; weight: number }>();
    for (const r of pages) {
      const t = totals.get(r.path) ?? { views: 0, scroll: 0, weight: 0 };
      t.views += num(r.pageviews);
      /* Scroll depth is a per-day average, so re-averaging it needs the
         day's weight or a quiet Tuesday counts as much as a busy Monday. */
      if (r.avg_scroll_percent !== null) {
        t.scroll += num(r.avg_scroll_percent) * num(r.pageviews);
        t.weight += num(r.pageviews);
      }
      totals.set(r.path, t);
    }
    return [...totals]
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .map(([path, t]) => ({
        path,
        views: t.views,
        scroll: t.weight ? Math.round((t.scroll / t.weight) * 10) / 10 : null,
      }));
  }, [pages]);

  const byReferrer = useMemo(
    () => rank(referrers, r => hostLabel(r.referring_host), r => num(r.sessions)),
    [referrers],
  );
  const byDevice = useMemo(
    () => rank(devices, r => orUnknown(r.device), r => num(r.sessions), 3),
    [devices],
  );
  const byBrowser = useMemo(
    () => rank(devices, r => orUnknown(r.browser), r => num(r.sessions), 6),
    [devices],
  );
  const byOs = useMemo(() => rank(devices, r => orUnknown(r.os), r => num(r.sessions), 6), [devices]);
  const byCountry = useMemo(
    () => rank(geo, r => orUnknown(r.country), r => num(r.sessions)),
    [geo],
  );
  const byCity = useMemo(
    () => rank(geo.filter(r => r.city), r => r.city as string, r => num(r.sessions)),
    [geo],
  );
  const byOutbound = useMemo(
    () => rank(outbound, r => orUnknown(r.host), r => num(r.clicks)),
    [outbound],
  );

  const deviceShare = useMemo(() => {
    const total = byDevice.reduce((a, d) => a + d.value, 0);
    return byDevice.map(d => ({
      ...d,
      meta: total ? `${Math.round((d.value / total) * 100)}%` : '0%',
    }));
  }, [byDevice]);

  /* Site-wide funnel. Read depth stands in for "engaged": somebody who
     reached half a page did not bounce, whatever else they did after. */
  const funnelSteps = useMemo(() => {
    const sessions = quality.reduce((a, r) => a + num(r.sessions), 0);
    const bounced = quality.reduce((a, r) => a + num(r.bounced), 0);
    const engaged = Math.max(sessions - bounced, 0);
    const step = (label: string, reached: number, previous: number | null) => ({
      label,
      reached,
      conversion: previous === null || previous === 0 ? null : Math.round((reached / previous) * 1000) / 10,
    });
    return [
      step('Sessions', sessions, null),
      step('Read on', engaged, sessions),
      step('Enquired', totals.leads, engaged || sessions),
    ];
  }, [quality, totals.leads]);

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
          body="Run 011_analytics.sql, 012_analytics_fixes.sql and 013_analytics_dimensions.sql in the SQL editor. At least one view is missing, which means the migrations are only part applied. Nothing is collected until they are, and the site keeps working either way."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Site analytics"
        actions={
          <SegmentedControl label="Date range" options={RANGES} value={range} onChange={setRange} />
        }
      />

      {loading ? (
        <SkeletonTiles />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Visitors" value={int(totals.visitors)} />
            <Stat label="Pageviews" value={int(totals.pageviews)} />
            <Stat label="Enquiries" value={int(totals.leads)} />
            <Stat label="Visitor to enquiry" value={pct(totals.conversion)} />
            <Stat label="Bounce rate" value={pct(totals.bounce)} />
            <Stat label="Avg session" value={duration(totals.avgSeconds)} />
          </div>

          <ChartCard
            title="Visitors and enquiries"
            hint="Enquiries are contact submissions plus completed estimates."
            rows={daily.map(d => [
              new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              `${int(num(d.visitors))} visitors, ${int(num(d.form_submits) + num(d.estimates_completed))} enquiries`,
            ])}
          >
            <LineChart series={trend} format={int} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Busiest days of week"
              hint="Sessions by the day they started, Karachi time."
              rows={byWeekday.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byWeekday} format={int} ordinal />
            </ChartCard>

            <ChartCard
              title="Busiest hours of day"
              hint="Sessions by starting hour, Karachi time. Hours with no traffic at either end are trimmed."
              rows={byHour.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byHour} format={int} ordinal />
            </ChartCard>

            <ChartCard
              title="Top pages"
              hint="Average scroll depth shows whether a page is read or bounced."
              rows={topPages.map(p => [
                p.path,
                `${int(p.views)} views, ${p.scroll === null ? 'no depth recorded' : `${p.scroll}% read`}`,
              ])}
            >
              <BarRows
                data={topPages.map(p => ({
                  label: p.path,
                  value: p.views,
                  meta: p.scroll === null ? undefined : `${p.scroll}% read`,
                }))}
                format={int}
              />
            </ChartCard>

            <ChartCard
              title="Where visitors come from"
              hint="Referring host of the first page in each session."
              rows={byReferrer.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byReferrer} format={int} />
            </ChartCard>

            <ChartCard
              title="Devices"
              hint="From viewport width at first event — three buckets, not a fingerprint."
              rows={deviceShare.map(d => [d.label, `${int(d.value)} sessions, ${d.meta}`])}
            >
              <BarRows data={deviceShare} format={int} />
            </ChartCard>

            <ChartCard
              title="Browsers"
              hint="Family only. Versions are the fingerprinting half of a user agent and are not stored."
              rows={byBrowser.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byBrowser} format={int} />
            </ChartCard>

            <ChartCard
              title="Operating systems"
              rows={byOs.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byOs} format={int} />
            </ChartCard>

            <ChartCard
              title="Top countries"
              hint="Derived at the edge from the request address, which is never stored."
              rows={byCountry.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byCountry} format={int} />
            </ChartCard>

            <ChartCard
              title="Top cities"
              rows={byCity.map(d => [d.label, `${int(d.value)} sessions`])}
            >
              <BarRows data={byCity} format={int} />
            </ChartCard>

            <ChartCard
              title="Clicked away to"
              hint="Outbound clicks — the live sites and repos on the work pages are the ones worth watching."
              rows={byOutbound.map(d => [d.label, `${int(d.value)} clicks`])}
            >
              <BarRows data={byOutbound} format={int} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Where enquiries come from"
              hint="Sessions joined to the enquiries they produced. This is the panel Google Analytics cannot build, because it cannot see the leads table."
              rows={attribution.map(a => [
                `${hostLabel(a.referring_host)} → ${a.landing_path}`,
                `${int(a.sessions)} sessions, ${int(a.leads)} leads`,
              ])}
            >
              <BarRows
                data={attribution
                  .filter(a => a.leads > 0)
                  .slice(0, 8)
                  .map(a => ({
                    label: `${hostLabel(a.referring_host)} · ${a.landing_path}`,
                    value: a.leads,
                    meta: `${int(a.sessions)} sessions`,
                  }))}
                format={int}
              />
            </ChartCard>

            <ChartCard
              title="Session to enquiry"
              hint="Read on counts sessions that passed half a page or opened a second one — engaged rather than bounced."
              rows={funnelSteps.map(s => [
                s.label,
                `${int(s.reached)}${s.conversion === null ? '' : ` (${s.conversion}%)`}`,
              ])}
            >
              <Funnel steps={funnelSteps} />
            </ChartCard>
          </div>

          {searchReady && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Search impressions" value={int(search.impressions)} />
                <Stat label="Search clicks" value={int(search.clicks)} />
                <Stat label="Search CTR" value={pct(search.ctr)} />
                <Stat label="Avg position" value={search.position ? search.position.toFixed(1) : '—'} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="What visitors search for"
                  hint="From Search Console, by impressions. Google withholds rare queries to protect the people who typed them, so these totals run slightly under the Performance report."
                  rows={topQueries.map(d => [d.label, `${int(d.value)} impressions`])}
                >
                  <BarRows data={topQueries} format={int} />
                </ChartCard>

                <ChartCard
                  title="Pages that appear in search"
                  hint="Which of your pages Google is actually putting in front of people."
                  rows={topSearchPages.map(d => [d.label, `${int(d.value)} impressions`])}
                >
                  <BarRows data={topSearchPages} format={int} />
                </ChartCard>
              </div>
            </>
          )}

          <ChartCard
            title="On the site now"
            hint="Distinct visitors in the last 30 minutes. Not affected by the date range."
            rows={realtime.map(r => [r.path, `${int(num(r.visitors))} now`])}
          >
            <BarRows
              data={realtime.map(r => ({ label: r.path, value: num(r.visitors) }))}
              format={int}
            />
          </ChartCard>
        </div>
      )}
    </>
  );
};

export default Analytics;
