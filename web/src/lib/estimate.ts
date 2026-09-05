import gsap from 'gsap';
import { track, currentVisitor } from './analytics';
import { submitLead } from './supabase';

/**
 * Project estimator.
 *
 * Four questions, then an email capture. The point is not precision — it is
 * to give a researcher a defensible number to take to whoever holds the
 * budget, without making them book a call first.
 *
 * Design decisions worth keeping:
 *
 *  - One question per screen. Four questions shown at once reads as a form;
 *    one at a time reads as a conversation and finishes far more often.
 *  - The range is visible from question one and updates as you answer, so
 *    there is a reason to keep going.
 *  - Nothing is asked for until the number has already been given. The email
 *    field buys a written breakdown, not the estimate itself.
 *  - Ranges are wide on purpose and labelled as indicative. A tight number
 *    from four questions would be a lie.
 */

interface Choice {
  label: string;
  hint?: string;
  /** Multiplier applied to the running base. */
  factor: number;
  /** Flat addition in USD before multipliers. */
  add?: number;
}

interface Question {
  id: string;
  prompt: string;
  help: string;
  choices: Choice[];
}

export const QUESTIONS: Question[] = [
  {
    id: 'type',
    prompt: 'What are we building?',
    help: 'Pick the closest. We will scope the detail properly on a call.',
    choices: [
      { label: 'Marketing website', hint: 'Brochure, landing, content site', factor: 1, add: 6000 },
      { label: 'Web application', hint: 'Dashboards, portals, SaaS', factor: 1, add: 18000 },
      { label: 'Mobile app', hint: 'iOS and Android', factor: 1, add: 22000 },
      { label: 'Connected hardware', hint: 'PCB, firmware, IoT fleet', factor: 1, add: 34000 },
    ],
  },
  {
    id: 'scope',
    prompt: 'How much of it exists already?',
    help: 'Rebuilding on something solid costs far less than starting cold.',
    choices: [
      { label: 'Nothing yet', hint: 'Blank page, no designs', factor: 1.35 },
      { label: 'Designs are done', hint: 'Figma ready to build', factor: 1 },
      { label: 'Rebuilding something live', hint: 'Migration or overhaul', factor: 1.15 },
      { label: 'Extending what we have', hint: 'Adding to a working product', factor: 0.7 },
    ],
  },
  {
    id: 'integrations',
    prompt: 'What does it need to talk to?',
    help: 'Integrations are usually where estimates go wrong, so we ask early.',
    choices: [
      { label: 'Nothing external', factor: 1 },
      { label: 'Payments and auth', hint: 'Stripe, SSO, the usual', factor: 1.2 },
      { label: 'Existing internal systems', hint: 'ERP, CRM, legacy APIs', factor: 1.45 },
      { label: 'Physical devices', hint: 'Sensors, machines, fleets', factor: 1.6 },
    ],
  },
  {
    id: 'timing',
    prompt: 'When does it need to be live?',
    help: 'Compressed timelines mean more people in parallel, which costs more.',
    choices: [
      { label: 'No fixed date', hint: 'We can pace it sensibly', factor: 0.95 },
      { label: 'Within six months', factor: 1 },
      { label: 'Within three months', factor: 1.2 },
      { label: 'Yesterday', hint: 'Hard external deadline', factor: 1.45 },
    ],
  },
];

const RANGE_SPREAD = 0.3; // ±30% — honest for four questions

function money(n: number) {
  return '$' + Math.round(n / 500) * 500 / 1000 + 'k';
}

export function initEstimate() {
  if (typeof window === 'undefined') return;

  const root = document.querySelector<HTMLElement>('[data-estimate]');
  if (!root) return;

  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-estimate-step]'));
  const bar = root.querySelector<HTMLElement>('[data-estimate-bar]');
  const stepLabel = root.querySelector<HTMLElement>('[data-estimate-steplabel]');
  const lowEl = root.querySelector<HTMLElement>('[data-estimate-low]');
  const highEl = root.querySelector<HTMLElement>('[data-estimate-high]');
  const backBtn = root.querySelector<HTMLButtonElement>('[data-estimate-back]');
  const form = root.querySelector<HTMLFormElement>('[data-estimate-form]');
  const statusEl = root.querySelector<HTMLElement>('[data-estimate-status]');
  const summaryEl = root.querySelector<HTMLElement>('[data-estimate-summary]');

  const answers: Record<string, Choice> = {};
  let index = 0;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function total() {
    let base = 0;
    let mult = 1;
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (!a) continue;
      base += a.add ?? 0;
      mult *= a.factor;
    }
    return base * mult;
  }

  function paint() {
    const t = total();
    const answered = Object.keys(answers).length;

    if (lowEl && highEl) {
      if (answered === 0) {
        lowEl.textContent = '—';
        highEl.textContent = '—';
      } else {
        lowEl.textContent = money(t * (1 - RANGE_SPREAD));
        highEl.textContent = money(t * (1 + RANGE_SPREAD));
      }
    }

    // Tailwind 4 emits the standalone `scale` property, which is applied
    // after `transform` and would silently win over it. Drive `scale`.
    if (bar) bar.style.scale = `${(index / steps.length).toFixed(3)} 1`;
    if (stepLabel) {
      stepLabel.textContent =
        index < QUESTIONS.length
          ? `Question ${index + 1} of ${QUESTIONS.length}`
          : 'Your estimate';
    }
    if (backBtn) backBtn.hidden = index === 0;
  }

  function show(next: number) {
    const from = steps[index];
    const to = steps[next];
    if (!to) return;
    index = next;

    steps.forEach((s) => {
      s.hidden = s !== to;
    });

    if (!reduced && from !== to) {
      gsap.fromTo(
        to,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      );
    }

    paint();
    // Move focus to the new question so keyboard and screen-reader users
    // are not left behind on a step that is now hidden.
    to.querySelector<HTMLElement>('h2, [data-estimate-focus]')?.focus?.();
  }

  root.querySelectorAll<HTMLButtonElement>('[data-estimate-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.estimateQ!;
      // Read the *index* attribute, not the boolean marker. `data-estimate-choice`
      // is present with an empty value on every button, so reading it would
      // give Number('') === 0 and register every answer as the first choice.
      const ci = Number(btn.dataset.estimateChoiceIndex);
      const q = QUESTIONS.find((x) => x.id === qid);
      if (!q) return;

      answers[qid] = q.choices[ci];

      // Reflect selection for anyone navigating by keyboard or AT.
      btn
        .closest('[data-estimate-step]')
        ?.querySelectorAll('[data-estimate-choice]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

      if (summaryEl) {
        summaryEl.textContent = QUESTIONS.filter((x) => answers[x.id])
          .map((x) => answers[x.id].label)
          .join(' · ');
      }

      show(index + 1);
    });
  });

  backBtn?.addEventListener('click', () => show(Math.max(0, index - 1)));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!statusEl || !btn) return;

    const email = String(new FormData(form).get('email') || '').trim();
    if (!email) {
      statusEl.textContent = 'We need an email to send the breakdown to.';
      statusEl.dataset.state = 'error';
      return;
    }

    btn.disabled = true;
    statusEl.textContent = 'Sending your breakdown…';
    statusEl.dataset.state = 'pending';

    const picked = QUESTIONS.filter((q) => answers[q.id]).map(
      (q) => `${q.prompt} ${answers[q.id].label}`,
    );
    const low = lowEl?.textContent ?? '';
    const high = highEl?.textContent ?? '';

    // The `leads` table requires a name and a message, and the estimator
    // asks for neither. Rather than loosen the schema — which the CRM and
    // admin both read — synthesise both so the lead is readable in the
    // existing inbox with no changes anywhere else.
    const res = await submitLead({
      name: email.split('@')[0] || 'Estimate enquiry',
      email,
      message: [`Estimator range: ${low} – ${high}`, '', ...picked].join('\n'),
      source: 'estimate',
      payload: {
        visitor: currentVisitor(),
        low,
        high,
        answers: Object.fromEntries(
          Object.entries(answers).map(([k, v]) => [k, v.label]),
        ),
      },
    });

    if (res.ok) {
      track('estimate_complete', { low, high });
      // Swap the spent form for the next step rather than leaving a line of
      // text under it. This is the one moment in the funnel where somebody
      // has just raised their hand, and it used to be a dead end.
      const done = root.querySelector<HTMLElement>('[data-estimate-done]');
      const sentTo = done?.querySelector<HTMLElement>('[data-estimate-sentto]');
      if (sentTo) sentTo.textContent = email;

      if (done) {
        const capture = form.closest<HTMLElement>('[data-estimate-step]');
        if (capture) capture.hidden = true;
        done.hidden = false;
        // Move focus to the new heading so a screen reader lands on the
        // outcome instead of being left on a button that no longer exists.
        done.querySelector<HTMLElement>('h2')?.focus();
      } else {
        statusEl.textContent = 'Sent. Check your inbox in the next few minutes.';
        statusEl.dataset.state = 'ok';
      }
      form.reset();
      return;
    }

    btn.disabled = false;
    statusEl.textContent =
      res.reason === 'not-configured'
        ? 'This form is not connected yet. Email contact@xtenzium.com and we will send the breakdown.'
        : 'That did not send. Email contact@xtenzium.com and we will get it to you.';
    statusEl.dataset.state = 'error';
  });

  paint();
}

export function destroyEstimate() {
  /* Listeners live on elements that are replaced wholesale on navigation. */
}
