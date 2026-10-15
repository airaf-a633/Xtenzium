/* Meeting slot checks. The timezone rules here are the part most likely
   to be quietly wrong, so they are pinned to explicit instants. */

import { computeSlots, groupByDay, hourInWindow, type SlotRequest } from '../src/lib/meeting-slots';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const NY = 'America/New_York';
/* Tue 13 Oct 2026, 04:00Z = 09:00 PKT, 00:00 EDT — long before any slot. */
const NOW = new Date('2026-10-13T04:00:00Z');
const base: SlotRequest = {
  now: NOW, businessDays: 3, durationMin: 30, prospectTz: NY,
  ownerTz: 'Asia/Karachi', ownerFrom: 18, ownerTo: 2, busy: [],
};

const hm = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const dayOf = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));

/* Owner 18:00–02:00 PKT covers the whole New York business day while clocks are on EDT. */
const a = computeSlots(base);
eq('first slot is 09:00 New York', hm(a[0].start, NY), '09:00');
eq('first slot is 18:00 Karachi', hm(a[0].start, 'Asia/Karachi'), '18:00');
eq('last slot of day one starts 16:30 NY', hm(a.filter(s => dayOf(s.start, NY) === '2026-10-13').at(-1)!.start, NY), '16:30');
eq('16 half-hour slots a day', a.filter(s => dayOf(s.start, NY) === '2026-10-13').length, 16);
eq('three business days asked, three covered', new Set(a.map(s => dayOf(s.start, NY))).size, 3);
eq('days are consecutive weekdays', [...new Set(a.map(s => dayOf(s.start, NY)))], ['2026-10-13', '2026-10-14', '2026-10-15']);

/* Weekends are skipped, even if the owner is free. */
const fri = computeSlots({ ...base, now: new Date('2026-10-16T04:00:00Z'), businessDays: 2 });
eq('Friday then Monday', [...new Set(fri.map(s => dayOf(s.start, NY)))], ['2026-10-16', '2026-10-19']);

/* A narrower owner window removes the early slots. 20:00 PKT = 11:00 EDT. */
const late = computeSlots({ ...base, ownerFrom: 20 });
eq('owner starts at 20:00 PKT → first slot 11:00 NY', hm(late[0].start, NY), '11:00');

/* An early-ending owner window removes the late slots. 23 PKT = 14:00 EDT. */
const early = computeSlots({ ...base, ownerFrom: 18, ownerTo: 23 });
eq('owner stops at 23:00 PKT → last slot ends by 14:00 NY', hm(early.filter(s => dayOf(s.start, NY) === '2026-10-13').at(-1)!.end, NY), '14:00');

/* A window that ends at midnight (24) does not wrap. */
const toMidnight = computeSlots({ ...base, ownerFrom: 18, ownerTo: 24 });
eq('ends at midnight PKT = 15:00 EDT', hm(toMidnight.filter(s => dayOf(s.start, NY) === '2026-10-13').at(-1)!.end, NY), '15:00');

/* Durations: a 60-minute meeting can't start at 16:30. */
const hour = computeSlots({ ...base, durationMin: 60 });
eq('60-min last start is 16:00', hm(hour.filter(s => dayOf(s.start, NY) === '2026-10-13').at(-1)!.start, NY), '16:00');
eq('slot length', (new Date(hour[0].end).getTime() - new Date(hour[0].start).getTime()) / 60000, 60);

/* Busy time removes only what it overlaps. 10:00–11:00 NY = 14:00–15:00Z. */
const busy = computeSlots({ ...base, busy: [{ start: '2026-10-13T14:00:00Z', end: '2026-10-13T15:00:00Z' }] });
const day1 = busy.filter(s => dayOf(s.start, NY) === '2026-10-13').map(s => hm(s.start, NY));
eq('10:00 and 10:30 are gone', [day1.includes('10:00'), day1.includes('10:30')], [false, false]);
eq('09:30 stays (ends exactly at 10:00)', day1.includes('09:30'), true);
eq('11:00 stays (starts exactly when busy ends)', day1.includes('11:00'), true);
eq('overlapping from the left is caught', computeSlots({ ...base, busy: [{ start: '2026-10-13T13:15:00Z', end: '2026-10-13T13:45:00Z' }] })
  .some(s => hm(s.start, NY) === '09:00' && dayOf(s.start, NY) === '2026-10-13'), false);

/* Too soon: now is 08:30 EDT with a 2h lead → nothing before 10:30. */
const soon = computeSlots({ ...base, now: new Date('2026-10-13T12:30:00Z') });
eq('lead time pushes the first slot to 10:30 NY', hm(soon[0].start, NY), '10:30');
eq('custom lead time', hm(computeSlots({ ...base, now: new Date('2026-10-13T12:30:00Z'), minLeadMin: 30 })[0].start, NY), '09:00');

/* Unknown zone: only the Eastern 12:00–17:00 overlap. */
const unk = computeSlots({ ...base, prospectTz: null });
eq('unknown zone starts at 12:00 Eastern', hm(unk[0].start, NY), '12:00');
eq('unknown zone: 10 slots a day', unk.filter(s => dayOf(s.start, NY) === '2026-10-13').length, 10);

/* West coast prospect: 09:00 PDT = 12:00 EDT = 21:00 PKT. */
const pt = computeSlots({ ...base, prospectTz: 'America/Los_Angeles' });
eq('Pacific 09:00 is 21:00 Karachi', hm(pt[0].start, 'Asia/Karachi'), '21:00');
eq('Pacific day ends 17:00 PT = 05:00 PKT, past the owner window → last slot 01:30 PKT', hm(pt.filter(s => dayOf(s.start, 'America/Los_Angeles') === '2026-10-13').at(-1)!.start, 'Asia/Karachi'), '01:30');

/* DST: after 1 Nov New York is on EST, so 09:00 NY is 19:00 PKT. */
const nov = computeSlots({ ...base, now: new Date('2026-11-03T04:00:00Z'), businessDays: 1 });
eq('after clocks go back, 09:00 NY = 19:00 Karachi', [hm(nov[0].start, NY), hm(nov[0].start, 'Asia/Karachi')], ['09:00', '19:00']);

/* Nothing available. */
eq('fully booked owner offers nothing', computeSlots({ ...base, busy: [{ start: '2026-10-13T00:00:00Z', end: '2026-11-30T00:00:00Z' }] }), []);
eq('owner window that never meets the prospect day', computeSlots({ ...base, ownerFrom: 3, ownerTo: 6 }), []);

/* Window helper */
eq('window: plain', [hourInWindow(10, 9, 17), hourInWindow(17, 9, 17), hourInWindow(8, 9, 17)], [true, false, false]);
eq('window: wraps midnight', [hourInWindow(23, 18, 2), hourInWindow(1, 18, 2), hourInWindow(2, 18, 2), hourInWindow(12, 18, 2)], [true, true, false, false]);
eq('window: from == to means always', hourInWindow(5, 0, 0), true);

/* Grouping for the picker */
const groups = groupByDay(a, NY);
eq('grouped into three days', groups.map(g => g.key), ['2026-10-13', '2026-10-14', '2026-10-15']);
eq('every slot lands in exactly one group', groups.reduce((n, g) => n + g.slots.length, 0), a.length);

if (failures) {
  console.error(`${failures} meeting-slots check(s) failed`);
  process.exit(1);
}
console.log('meeting-slots: all checks passed');
