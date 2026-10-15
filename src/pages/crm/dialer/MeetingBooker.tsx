import { useCallback, useEffect, useState } from 'react';
import { callGoogle, CALENDAR_DOWN, type SlotsResponse } from '../../../lib/google-api';
import { groupByDay, type Slot } from '../../../lib/meeting-slots';
import { Button, Input, Skeleton } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

const DURATIONS = [15, 20, 30, 45, 60];
const ET = 'America/New_York';
const DAYS_AT_FIRST = 3;

const clock = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

const dayLabel = (key: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' })
    .format(new Date(`${key}T12:00:00Z`));

export interface BookerState {
  slot: Slot | null;
  duration: number;
  email: string;
  name: string;
}

/* Picks a real time from the owner's calendar, for a prospect in a
   specific timezone. Every slot is shown in both clocks — theirs (what
   the prospect will say yes to) and the owner's (what has to fit a
   day). Times are computed by the server against live free/busy, so
   what's listed is what will actually go through; if two people grab
   the same slot the second booking is refused and the list refreshes. */
const MeetingBooker = ({
  leadId, state, onChange, onUnavailable, ownerLabelTz,
}: {
  leadId: string;
  state: BookerState;
  onChange: (next: Partial<BookerState>) => void;
  /** The calendar can't be used (not connected, revoked, offline): fall back to typing a time. */
  onUnavailable: (message: string) => void;
  /** The rep's own zone, shown as the second clock. */
  ownerLabelTz: string;
}) => {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysShown, setDaysShown] = useState(DAYS_AT_FIRST);
  const [reload, setReload] = useState(0);
  const { duration } = state;

  useEffect(() => {
    let cancelled = false;
    callGoogle<SlotsResponse>({ action: 'slots', lead_id: leadId, duration }).then(r => {
      if (cancelled) return;
      if (r.error || !r.data) {
        if (r.code && CALENDAR_DOWN.has(r.code)) onUnavailable(r.error ?? 'Calendar unavailable');
        else setError(r.error);
      } else {
        setData(r.data);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, duration, reload, onUnavailable]);

  const refresh = useCallback(() => {
    setLoading(true);
    onChange({ slot: null });
    setReload(n => n + 1);
  }, [onChange]);

  const prospectTz = data?.prospect_tz ?? null;
  const zone = prospectTz ?? ET;
  const groups = data ? groupByDay(data.slots, prospectTz) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-crm-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-crm-ink-3">Length</span>
          <select
            value={duration}
            onChange={e => {
              setLoading(true);
              onChange({ duration: Number(e.target.value), slot: null });
            }}
            className="h-9 rounded-crm-md border border-crm-line bg-crm-ground px-2.5 text-[13px] text-crm-ink"
          >
            {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
        <Input className="min-w-[160px] flex-1" label="Their name" value={state.name} onChange={e => onChange({ name: e.target.value })} />
        <Input
          className="min-w-[200px] flex-1"
          label="Their email (for the invite)"
          type="email"
          required
          value={state.email}
          onChange={e => onChange({ email: e.target.value })}
        />
      </div>

      {data && !data.known_zone && (
        <p className="m-0 text-[12.5px] text-crm-warning">
          Their timezone is unknown, so only times that are business hours across the US are offered.
        </p>
      )}

      {loading && <Skeleton className="h-[120px] w-full" />}
      {!loading && error && <p className="m-0 text-[13px] text-crm-danger">{error}</p>}
      {!loading && !error && data && groups.length === 0 && (
        <p className="m-0 text-[13px] text-crm-ink-2">
          No free time in the next two weeks that suits both of you. Try a shorter meeting, or ask the owner to open up more hours in Dialer settings.
        </p>
      )}

      {!loading && groups.slice(0, daysShown).map(g => (
        <div key={g.key}>
          <p className="m-0 mb-1.5 text-[12.5px] font-medium text-crm-ink">{dayLabel(g.key, zone)}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.slots.map(s => {
              const on = state.slot?.start === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onChange({ slot: s })}
                  aria-pressed={on}
                  className={cn(
                    'cursor-pointer rounded-crm-md border px-2.5 py-1.5 text-left text-[12px] transition-colors',
                    on ? 'border-crm-copper bg-crm-copper/10 text-crm-ink' : 'border-crm-line bg-crm-surface text-crm-ink-2 hover:border-crm-line-hi',
                  )}
                >
                  <span className="block font-medium text-crm-ink">{clock(s.start, zone)}</span>
                  <span className="block text-crm-ink-3">{clock(s.start, ownerLabelTz)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!loading && (
        <div className="flex flex-wrap items-center gap-2">
          {groups.length > daysShown && (
            <Button size="sm" onClick={() => setDaysShown(n => n + 3)}>Show more days</Button>
          )}
          <Button size="sm" variant="ghost" onClick={refresh}>Refresh times</Button>
          {state.slot && data && (
            <span className="text-[12.5px] text-crm-ink-2">
              Selected: {clock(state.slot.start, zone)} their time · {clock(state.slot.start, ownerLabelTz)} yours
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MeetingBooker;
