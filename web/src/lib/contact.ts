import { submitLead } from './supabase';

/**
 * Contact form.
 *
 * A public insert endpoint will be found by bots, so there are two cheap
 * guards before anything reaches the database:
 *
 *  1. A honeypot field, hidden from people and from screen readers, that
 *     automated form-fillers populate because they see it in the DOM.
 *  2. A minimum time on form. A human cannot read the labels, think, and
 *     type a real message in under three seconds; a script can.
 *
 * Neither stops a determined attacker. If real spam starts arriving, add
 * Cloudflare Turnstile — it is free and does not ask the user to do
 * anything. These two catch the volume without that dependency.
 */

const MIN_FILL_MS = 3000;

export function initContact() {
  if (typeof window === 'undefined') return;

  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');

  // Carry the service through from the page they came from.
  //
  // Each service page now asks in its own words and links here with
  // ?service=. Without this the reader arrives having just clicked
  // "tell us what the device has to do" and finds an empty dropdown
  // asking the same question again — the link would be making a promise
  // the form immediately breaks.
  //
  // Matched by value against the options the page already rendered, so an
  // unrecognised or hand-edited parameter simply leaves the field alone
  // rather than injecting anything.
  if (form) {
    const wanted = new URLSearchParams(window.location.search).get('service');
    if (wanted) {
      const select = form.querySelector<HTMLSelectElement>('select[name="service"]');
      const match = select
        && Array.from(select.options).find((o) => o.value === wanted);
      if (select && match) select.value = match.value;
    }
  }
  if (!form) return;

  const statusEl = form.querySelector<HTMLElement>('[data-contact-status]');
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const honeypot = form.querySelector<HTMLInputElement>('[data-contact-hp]');
  const mountedAt = Date.now();

  function setStatus(text: string, state: 'pending' | 'ok' | 'error') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.state = state;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn) return;

    // Bots fill everything they can see, including what people cannot.
    // Report success so the bot does not retry with a different shape.
    if (honeypot?.value) {
      setStatus('Thanks — we will be in touch shortly.', 'ok');
      form.reset();
      return;
    }

    if (Date.now() - mountedAt < MIN_FILL_MS) {
      setStatus('That was quick. Give it a moment and try again.', 'error');
      return;
    }

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const company = String(data.get('company') || '').trim();
    const message = String(data.get('message') || '').trim();
    const budget = String(data.get('budget') || '').trim();
    const service = String(data.get('service') || '').trim();

    if (!name || !email || !message) {
      setStatus('Name, email and a message are needed before we can help.', 'error');
      return;
    }

    submitBtn.disabled = true;
    setStatus('Sending…', 'pending');

    const res = await submitLead({
      name,
      email,
      company: company || null,
      message,
      source: 'contact',
      payload: { budget: budget || null, service: service || null },
    });

    if (res.ok) {
      setStatus(
        'Sent. You will hear back within one working day — usually sooner.',
        'ok',
      );
      form.reset();
      return;
    }

    submitBtn.disabled = false;
    setStatus(
      res.reason === 'not-configured'
        ? 'This form is not connected yet. Email contact@xtenzium.com and it will reach the same people.'
        : 'That did not send. Email contact@xtenzium.com and we will pick it up there.',
      'error',
    );
  });
}
