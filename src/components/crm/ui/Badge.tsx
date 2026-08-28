import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/* Tones are semantic, never decorative. A caller picks the tone that
   describes the state — `mapper` helpers below own the state→tone
   decision so `active` looks the same everywhere it appears. */
export type Tone = 'neutral' | 'copper' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

const TONES: Record<Tone, { fill: string; text: string; dot: string }> = {
  neutral: { fill: 'bg-crm-raised', text: 'text-crm-ink-2', dot: 'bg-crm-ink-3' },
  copper: { fill: 'bg-crm-copper-quiet', text: 'text-crm-copper', dot: 'bg-crm-copper' },
  success: { fill: 'bg-crm-success-quiet', text: 'text-crm-success', dot: 'bg-crm-success' },
  warning: { fill: 'bg-crm-warning-quiet', text: 'text-crm-warning', dot: 'bg-crm-warning' },
  danger: { fill: 'bg-crm-danger-quiet', text: 'text-crm-danger', dot: 'bg-crm-danger' },
  info: { fill: 'bg-crm-info-quiet', text: 'text-crm-info', dot: 'bg-crm-info' },
  violet: { fill: 'bg-crm-violet-quiet', text: 'text-crm-violet', dot: 'bg-crm-violet' },
};

interface BadgeProps {
  tone?: Tone;
  /* A dot alongside the label means state survives for anyone who
     can't separate the hues — colour never carries meaning alone. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export const Badge = ({ tone = 'neutral', dot = false, className, children }: BadgeProps) => {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-crm-sm',
        'px-2 py-0.5 text-[11.5px] font-medium leading-5',
        t.fill,
        t.text,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden="true" />}
      {children}
    </span>
  );
};

/* A bare dot for tight rows — board column headers, list gutters.
   Always paired with adjacent text, never used as the only signal. */
export const Dot = ({ tone = 'neutral', className }: { tone?: Tone; className?: string }) => (
  <span className={cn('h-2 w-2 shrink-0 rounded-full', TONES[tone].dot, className)} aria-hidden="true" />
);

/* ── State → tone, in one place ─────────────────────────────────
   Project status keeps the meaning it already had in the app:
   proposal is in-flight, active is good, on_hold needs attention,
   cancelled is a loss, completed is closed and therefore quiet. */
export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  proposal: 'info',
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  proposal: 'Proposal',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
