/* A calendar file (.ics) for a meeting.

   The calendar integration with Google is switched off — the domain
   mailbox and calendar are on Zoho — so the way to put a meeting on a
   calendar is a file any calendar can import: Zoho, Google, Outlook,
   Apple. Written to RFC 5545: CRLF line ends, text escaped, lines
   folded at 75 bytes, times in UTC so there is no time-zone table to
   get wrong. */

export interface IcsAttendee {
  email: string;
  name?: string | null;
}

export interface IcsEvent {
  /** Stable, so importing the same meeting twice updates it rather than duplicating it. */
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string | null;
  location?: string | null;
  organizer?: IcsAttendee | null;
  attendees?: IcsAttendee[];
  /** For DTSTAMP; injectable so the output is deterministic in checks. */
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 20261014T140000Z */
export const icsDate = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Backslash, semicolon, comma and newlines are special in iCalendar text. */
export const icsEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Parameter values containing : ; , must be quoted, and may not contain a double quote. */
const param = (s: string) => `"${s.replace(/"/g, "'")}"`;

const encoder = new TextEncoder();

/** Fold at 75 octets (not characters — a multi-byte letter must not be split). */
export function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  // The first physical line holds 75 octets; continuation lines start with a space, so 74 more.
  let limit = 75;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (bytes + n > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n');
}

export function buildIcs(e: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Xtenzium//CRM//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now ?? new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.organizer) lines.push(`ORGANIZER${e.organizer.name ? `;CN=${param(e.organizer.name)}` : ''}:mailto:${e.organizer.email}`);
  for (const a of e.attendees ?? []) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT${a.name ? `;CN=${param(a.name)}` : ''}:mailto:${a.email}`);
  }
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A meeting the rep agreed on, as an event. */
export function meetingIcs(
  lead: { id: string; company_name: string; contact_name: string | null; email: string | null; phone_raw: string | null; website: string | null },
  start: Date,
  minutes: number,
  note: string | null,
  crmUrl: string,
  now?: Date,
): string {
  const description = [
    `Intro call with ${lead.company_name}.`,
    lead.contact_name ? `Contact: ${lead.contact_name}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone_raw ? `Phone: ${lead.phone_raw}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    note ? `From the call: ${note}` : null,
    `CRM: ${crmUrl}`,
  ].filter((l): l is string => l !== null).join('\n');

  return buildIcs({
    uid: `meeting-${lead.id}@xtenzium.com`,
    title: `Xtenzium × ${lead.company_name}`,
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    description,
    attendees: lead.email ? [{ email: lead.email, name: lead.contact_name }] : [],
    now,
  });
}

/** A file name that is safe on every system. */
export const icsFileName = (company: string): string =>
  `${company.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'meeting'}-meeting.ics`;
