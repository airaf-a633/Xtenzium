import type { Deal, DealSource, DealStage } from '../types/database';
import type { Tone } from '../components/crm/ui';
import { toPkr } from './money';
import { daysBetween, parseDateOnly, today } from './date';

/* ── Stages ────────────────────────────────────────────────────
   Open stages only. Won and Lost are terminal — they're reached
   through the close strip under the board or from the deal panel, and
   they don't get columns. Seven columns on a laptop means every one of
   them is too narrow to read, and the five that matter are the ones
   where work is still possible.

   `defaultProbability` seeds a new deal's weighting when it lands in a
   stage. It's a starting point, not a lock — the number stays editable
   per deal, because a 60% average across all proposals says nothing
   about the proposal in front of you. */
export interface StageConfig {
  value: DealStage;
  label: string;
  tone: Tone;
  defaultProbability: number;
  /* Days a deal can sit here before it counts as stale. Later stages
     get shorter fuses: a proposal that's been out three weeks is a
     much louder problem than an enquiry that's a fortnight old. */
  staleAfterDays: number;
}

export const OPEN_STAGES: StageConfig[] = [
  { value: 'new', label: 'New', tone: 'neutral', defaultProbability: 10, staleAfterDays: 5 },
  { value: 'contacted', label: 'Contacted', tone: 'info', defaultProbability: 25, staleAfterDays: 7 },
  { value: 'qualified', label: 'Qualified', tone: 'violet', defaultProbability: 45, staleAfterDays: 14 },
  { value: 'proposal_sent', label: 'Proposal Sent', tone: 'warning', defaultProbability: 65, staleAfterDays: 10 },
  { value: 'negotiation', label: 'Negotiation', tone: 'copper', defaultProbability: 85, staleAfterDays: 7 },
];

export const STAGE_LABEL: Record<DealStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const STAGE_TONE: Record<DealStage, Tone> = {
  new: 'neutral',
  contacted: 'info',
  qualified: 'violet',
  proposal_sent: 'warning',
  negotiation: 'copper',
  won: 'success',
  lost: 'danger',
};

export const SOURCE_LABEL: Record<DealSource, string> = {
  contact: 'Contact form',
  estimate: 'Estimator',
  referral: 'Referral',
  outbound: 'Outbound',
  repeat: 'Repeat client',
  manual: 'Added manually',
};

export const isOpen = (stage: DealStage) => stage !== 'won' && stage !== 'lost';

export const stageConfig = (stage: DealStage) => OPEN_STAGES.find(s => s.value === stage);

/* ── Forecast ──────────────────────────────────────────────────
   Two numbers, always shown together and never conflated:

     total     — what's on the table if everything lands
     weighted  — value × probability, which is the number you can
                 actually plan against

   Both normalise to PKR through the same rate the rest of the app
   uses, so a mixed-currency pipeline is still one figure. */
export interface Forecast {
  count: number;
  total: number;
  weighted: number;
}

export const forecastOf = (deals: Deal[], usdRate: number): Forecast =>
  deals.reduce<Forecast>(
    (acc, d) => {
      const pkr = toPkr(Number(d.value), d.currency, usdRate);
      acc.count += 1;
      acc.total += pkr;
      acc.weighted += pkr * (d.probability / 100);
      return acc;
    },
    { count: 0, total: 0, weighted: 0 },
  );

/* ── Attention ─────────────────────────────────────────────────
   Three states, in priority order, because a card can only carry one
   flag before the board turns into noise:

     no-action  — nothing agreed to do next. The worst state, and the
                  one that's invisible in every spreadsheet pipeline.
     overdue    — the next action's date has passed.
     stale      — untouched longer than the stage allows.

   Phase 05 turns exactly these into notifications; for now they're
   visible on the card, which is most of the value. */
export type Attention = 'none' | 'stale' | 'overdue' | 'no-action';

export const attentionOf = (deal: Deal, now = today()): Attention => {
  if (!isOpen(deal.stage)) return 'none';

  if (!deal.next_action_date) return 'no-action';

  /* Due today is not late. parseDateOnly keeps the column's calendar
     date a calendar date rather than a UTC instant. */
  if (parseDateOnly(deal.next_action_date) < now) return 'overdue';

  const cfg = stageConfig(deal.stage);
  /* stage_changed_at is a timestamptz, so it parses correctly on its
     own — only the date-only columns need the local-parse treatment. */
  if (cfg && daysBetween(new Date(deal.stage_changed_at), now) > cfg.staleAfterDays) {
    return 'stale';
  }

  return 'none';
};

export const ATTENTION_LABEL: Record<Exclude<Attention, 'none'>, string> = {
  'no-action': 'No next step',
  overdue: 'Action overdue',
  stale: 'Going cold',
};

export const ATTENTION_TONE: Record<Exclude<Attention, 'none'>, Tone> = {
  'no-action': 'danger',
  overdue: 'danger',
  stale: 'warning',
};

/* ── Ranking ───────────────────────────────────────────────────
   Fractional ranks so dropping a card between two others is a single
   UPDATE of one row, rather than renumbering a column. Gaps shrink by
   half each time; at the point they'd stop being representable the
   column is renormalised, which in practice never happens. */
export const rankBetween = (before: number | null, after: number | null): number => {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
};
