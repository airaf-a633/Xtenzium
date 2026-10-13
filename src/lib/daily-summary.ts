/* The owner's daily summary: what the rep did, and what is waiting on you.

   The numbers come from one database function (dialer_summary, migration
   025); this turns them into a subject, plain text and HTML. It is used
   by the cron email and by the Summary page, so the two can never
   disagree. Plain text is the primary form — it reads fine in any
   client and survives being pasted into a chat. */

export interface SummaryData {
  from: string;
  to: string;
  calls: { dials: number; conversations: number; interested: number; meetings: number };
  by_outcome: { outcome: string; n: number }[];
  outreach: { sent: number; replies: number; opted_out: number };
  hot: { company: string; outcome: string; note: string | null }[];
  needs_you: {
    followups: { company: string; type: string; assignee: string | null; note: string | null; age_hours: number }[];
    flagged: { company: string; outcome: string; note: string | null }[];
    meetings: { company: string; at: string; contact: string | null; email: string | null }[];
    callbacks_due: number;
    retries_due: number;
    outreach_due: number;
  };
}

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const OUTCOME: Record<string, string> = {
  no_answer: 'No answer', voicemail: 'Voicemail', gatekeeper_name: 'Gatekeeper (got a name)', gatekeeper_blocked: 'Gatekeeper (blocked)',
  callback: 'Callback requested', interested_info: 'Wants info', interested_proposal: 'Wants a proposal', interested_call: 'Wants a call',
  meeting_booked: 'Meeting agreed', not_interested_inhouse: 'Has in-house devs', not_interested_outsources: 'Already outsources',
  not_interested_timing: 'Bad timing', not_fit: 'Not a fit', wrong_number: 'Wrong number', dnc: 'Do not call',
};
const FOLLOWUP: Record<string, string> = { email_info: 'send info', email_proposal: 'send a proposal', admin_call: 'call them', linkedin: 'LinkedIn', };

const label = (o: string) => OUTCOME[o] ?? o.replace(/_/g, ' ');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const when = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const day = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));

const age = (hours: number) => (hours < 1 ? 'just now' : hours < 36 ? `${hours}h` : `${Math.round(hours / 24)}d`);

const quote = (s: string | null) => (s ? ` — “${s.length > 160 ? `${s.slice(0, 157)}…` : s}”` : '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Section {
  title: string;
  lines: string[];
}

export function renderSummary(d: SummaryData, opts: { tz?: string; crmUrl?: string } = {}): Rendered {
  const tz = opts.tz ?? 'Asia/Karachi';
  const crm = opts.crmUrl ?? 'https://www.xtenzium.com/crm';
  const c = d.calls;
  const n = d.needs_you;

  const waiting = n.followups.length + n.flagged.length + n.meetings.length;

  const subject =
    `Xtenzium dialer — ${day(d.to, tz)}: ${plural(c.dials, 'dial')}, ${plural(c.conversations, 'conversation')}` +
    `${c.meetings ? `, ${plural(c.meetings, 'meeting')}` : ''}${waiting ? ` · ${waiting} waiting on you` : ''}`;

  const sections: Section[] = [];

  sections.push({
    title: 'The last 24 hours',
    lines:
      c.dials === 0 && d.outreach.sent === 0
        ? ['No calls or emails were logged.']
        : [
            `${plural(c.dials, 'dial')} · ${plural(c.conversations, 'conversation')} · ${c.interested} interested · ${plural(c.meetings, 'meeting')} agreed`,
            ...(d.by_outcome.length ? [`Outcomes: ${d.by_outcome.map(o => `${label(o.outcome)} ${o.n}`).join(', ')}`] : []),
            `Email: ${plural(d.outreach.sent, 'email')} sent · ${plural(d.outreach.replies, 'reply', 'replies')}${d.outreach.opted_out ? ` · ${d.outreach.opted_out} asked to stop` : ''}`,
          ],
  });

  if (d.hot.length) {
    sections.push({
      title: 'Worth reading',
      lines: d.hot.map(h => `${h.company} — ${label(h.outcome)}${quote(h.note)}`),
    });
  }

  const needLines: string[] = [];
  for (const f of n.followups) {
    needLines.push(`${f.company} — ${FOLLOWUP[f.type] ?? f.type}${f.assignee ? ` (${f.assignee})` : ' (unassigned)'}, waiting ${age(f.age_hours)}${quote(f.note)}`);
  }
  for (const f of n.flagged) needLines.push(`Flagged: ${f.company} — ${label(f.outcome)}${quote(f.note)}`);
  for (const m of n.meetings) {
    needLines.push(`Meeting: ${m.company} — ${when(m.at, tz)}${m.contact ? ` with ${m.contact}` : ''}${m.email ? ` (${m.email})` : ' (no email yet — get it before sending the invite)'}`);
  }
  sections.push({ title: 'Waiting on you', lines: needLines.length ? needLines : ['Nothing is waiting on you.'] });

  const queue: string[] = [];
  if (n.callbacks_due) queue.push(plural(n.callbacks_due, 'callback'));
  if (n.retries_due) queue.push(`${n.retries_due} due to retry`);
  if (n.outreach_due) queue.push(`${plural(n.outreach_due, 'email follow-up')}`);
  if (queue.length) sections.push({ title: 'In the rep’s queue', lines: [queue.join(' · ')] });

  const text =
    sections.map(s => `${s.title.toUpperCase()}\n${s.lines.map(l => `• ${l}`).join('\n')}`).join('\n\n') +
    `\n\nOpen the inbox: ${crm}/inbox\n`;

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;line-height:1.5">` +
    `<h2 style="font-size:18px;margin:0 0 4px">Xtenzium dialer — ${esc(day(d.to, tz))}</h2>` +
    sections.map(s =>
      `<h3 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin:22px 0 6px">${esc(s.title)}</h3>` +
      `<ul style="margin:0;padding-left:18px">${s.lines.map(l => `<li style="margin:3px 0">${esc(l)}</li>`).join('')}</ul>`).join('') +
    `<p style="margin:24px 0 0"><a href="${esc(crm)}/inbox" style="color:#c2410c">Open the inbox →</a></p></div>`;

  return { subject, text, html };
}
