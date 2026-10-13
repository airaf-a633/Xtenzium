/* The email outreach worklist — the parts that need no browser.

   Leads we can't phone (no number, or a non-US one the dialer never
   offers) are worked by email instead, on a widening schedule. The
   rules for the schedule live in the database (log_outreach, migration
   024); this file names the tabs and actions and builds the links. */

export type OutreachTab = 'to_email' | 'find_email' | 'due' | 'after_call' | 'waiting';

export interface TabDef {
  key: OutreachTab;
  label: string;
  /** One line telling the person what this list is and what to do with it. */
  hint: string;
}

export const OUTREACH_TABS: TabDef[] = [
  { key: 'to_email', label: 'To email', hint: 'No phone to call, and we have an address. Send the first email.' },
  { key: 'find_email', label: 'Find an email', hint: 'No address yet. Look on their site or use their contact form, then save what you find.' },
  { key: 'due', label: 'Follow-ups due', hint: 'Already emailed, and the next touch is due. Send the follow-up.' },
  { key: 'after_call', label: 'After a call', hint: 'We phoned and didn’t reach them, and we have their email. A short email often lands where the call didn’t.' },
  { key: 'waiting', label: 'Waiting', hint: 'In the sequence, not due yet. Nothing to do.' },
];

export type OutreachAction =
  | 'emailed' | 'followed_up' | 'form_sent' | 'email_found'
  | 'replied' | 'not_interested' | 'bad_contact' | 'opted_out' | 'note';

export const ACTION_LABEL: Record<OutreachAction, string> = {
  emailed: 'Emailed',
  followed_up: 'Followed up',
  form_sent: 'Contact form sent',
  email_found: 'Email found',
  replied: 'They replied',
  not_interested: 'Not interested',
  bad_contact: 'Bad address',
  opted_out: 'Asked to stop',
  note: 'Note',
};

/** The sequence is four touches: the first email and three follow-ups (migration 024). */
export const MAX_TOUCHES = 4;

/** Which template to start from: the first email, or a follow-up once anything has been sent. */
export const templateFor = (touches: number): 'outreach_first' | 'outreach_followup' =>
  touches > 0 ? 'outreach_followup' : 'outreach_first';

/** What marking it sent should record. */
export const sendActionFor = (touches: number): 'emailed' | 'followed_up' => (touches > 0 ? 'followed_up' : 'emailed');

export const touchLabel = (touches: number): string =>
  touches === 0 ? 'Not contacted' : touches >= MAX_TOUCHES ? 'Sequence finished' : `Touch ${touches} of ${MAX_TOUCHES} sent`;

/* ─── Opening a compose window ─────────────────────────────

   The domain mailbox is on Zoho, which has no documented link for
   pre-filling a message. `mailto:` is the one thing every mail setup
   understands — set Zoho (or anything) as the browser's mail handler
   and it opens pre-filled — so that is the default, with Gmail and
   plain copy as alternatives. */

/** RFC 6068: line breaks in a mailto body are CRLF. */
export const mailtoCompose = (to: string | null, subject: string, body: string): string =>
  `mailto:${encodeURIComponent(to ?? '').replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`;

/** Some mail clients and browsers refuse very long links. Past this, copying is the reliable route. */
export const MAILTO_SAFE_LENGTH = 1800;
