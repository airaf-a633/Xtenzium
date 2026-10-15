/* Outreach helper checks. The schedule itself is tested in the database
   (migration 024); this covers naming, template choice and the links. */

import {
  ACTION_LABEL, MAILTO_SAFE_LENGTH, MAX_TOUCHES, OUTREACH_TABS, mailtoCompose, sendActionFor, templateFor, touchLabel,
} from '../src/lib/outreach';
import { gmailCompose, renderTemplate } from '../src/lib/dialer-calls';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

/* The tab keys and action names must match the database's. */
eq('tabs', OUTREACH_TABS.map(t => t.key), ['to_email', 'find_email', 'due', 'after_call', 'waiting']);
eq('every action has a label', Object.keys(ACTION_LABEL).sort(), [
  'bad_contact', 'email_found', 'emailed', 'followed_up', 'form_sent', 'not_interested', 'note', 'opted_out', 'replied',
]);
eq('every tab explains itself', OUTREACH_TABS.every(t => t.hint.length > 20), true);

/* Template and action choice follow the number of touches. */
eq('untouched → first email', [templateFor(0), sendActionFor(0)], ['outreach_first', 'emailed']);
eq('touched → follow-up', [templateFor(1), sendActionFor(1)], ['outreach_followup', 'followed_up']);
eq('late in the sequence → still a follow-up', [templateFor(3), sendActionFor(3)], ['outreach_followup', 'followed_up']);
eq('touch labels', [touchLabel(0), touchLabel(2), touchLabel(MAX_TOUCHES)], ['Not contacted', 'Touch 2 of 4 sent', 'Sequence finished']);

/* mailto: */
const m = mailtoCompose('dana@acme.io', 'Hello & welcome', 'Line one\nLine two');
eq('mailto prefix and recipient', m.startsWith('mailto:dana@acme.io?'), true);
eq('subject is encoded', m.includes('subject=Hello%20%26%20welcome'), true);
eq('line breaks are CRLF', m.includes('Line%20one%0D%0ALine%20two'), true);
eq('no address is allowed (the person types it)', mailtoCompose(null, 's', 'b').startsWith('mailto:?subject='), true);
eq('plus signs and unicode survive', mailtoCompose('a+b@x.io', 'Café', 'ok').includes('mailto:a%2Bb@x.io'), true);
eq('unicode subject', mailtoCompose('a@x.io', 'Café', 'ok').includes('subject=Caf%C3%A9'), true);
eq('an already-CRLF body is not doubled', mailtoCompose('a@x.io', 's', 'a\r\nb').includes('a%0D%0Ab') && !mailtoCompose('a@x.io', 's', 'a\r\nb').includes('%0D%0D'), true);

/* The seeded templates fit in a link; a very long one does not, and the page falls back to copying. */
const body = renderTemplate(
  'Hi {{contact_name}},\n\nI’ll keep this short. We help agencies like {{company_name}} take on more work without hiring: for what you’d pay to bring on one person, you get an entire design and development team — and you only ever deal with one project manager.\n\nWould a 15-minute call be worth it?\n\n{{sender_name}}\nXtenzium · contact@xtenzium.com\n[Your business postal address]\n\nIf you’d rather not hear from us, just reply “no thanks” and I won’t contact you again.',
  { contact_name: 'there', company_name: 'Acme Agency', sender_name: 'Airaf Adil' },
);
eq('merged body has no leftover fields', body.includes('{{'), false);
eq('a normal cold email is a safe length for mailto', mailtoCompose('dana@acme.io', 'Design and development capacity for Acme Agency', body).length < MAILTO_SAFE_LENGTH, true);
eq('a huge body is flagged unsafe', mailtoCompose('a@x.io', 's', 'x'.repeat(2000)).length > MAILTO_SAFE_LENGTH, true);
eq('gmail link still builds', gmailCompose('a@x.io', 's', 'b').startsWith('https://mail.google.com/mail/'), true);

if (failures) {
  console.error(`${failures} outreach check(s) failed`);
  process.exit(1);
}
console.log('outreach: all checks passed');
