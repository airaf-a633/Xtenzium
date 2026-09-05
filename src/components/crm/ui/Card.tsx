import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
  /* Cards that are links or drag handles get a hover state; static
     containers don't, so hover keeps meaning "this responds". */
  interactive?: boolean;
}

export const Card = ({ className, children, interactive = false }: CardProps) => (
  <div
    className={cn(
      'rounded-crm-lg border border-crm-line bg-crm-surface',
      interactive && 'transition-colors duration-150 ease-crm hover:border-crm-line-hi hover:bg-crm-raised',
      className,
    )}
  >
    {children}
  </div>
);

export const CardHeader = ({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex items-center justify-between gap-3 border-b border-crm-line px-4 py-3', className)}>
    <h2 className="m-0 font-crm-display text-[14.5px] font-bold tracking-[-0.01em] text-crm-ink">{title}</h2>
    {action}
  </div>
);

/* The uppercase mono label used above groups, in column headers and on
   stat tiles. Letter-spacing is non-negotiable at this size — set
   tight, uppercase mono reads as a serial number. */
export const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      'font-crm-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-crm-ink-3',
      className,
    )}
  >
    {children}
  </span>
);

/* A number and what it counts. `sub` carries the breakdown line —
   currency splits, deltas, "3 overdue" — in the quiet ink. */
export const Stat = ({
  label,
  value,
  sub,
  tone,
  to,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'ink' | 'copper' | 'success' | 'warning' | 'danger' | 'info' | 'violet';
  to?: ReactNode;
}) => (
  <div className="rounded-crm-lg border border-crm-line bg-crm-surface p-4">
    <div className="flex items-start justify-between gap-2">
      <Label>{label}</Label>
      {to}
    </div>
    <div
      className={cn(
        'crm-num mt-3 font-crm-display text-[26px] font-bold leading-none tracking-[-0.03em]',
        tone === 'copper' && 'text-crm-copper',
        tone === 'success' && 'text-crm-success',
        tone === 'warning' && 'text-crm-warning',
        tone === 'danger' && 'text-crm-danger',
        tone === 'info' && 'text-crm-info',
        tone === 'violet' && 'text-crm-violet',
        (!tone || tone === 'ink') && 'text-crm-ink',
      )}
    >
      {value}
    </div>
    {sub && <div className="crm-num mt-2 font-crm-mono text-[11px] text-crm-ink-3">{sub}</div>}
  </div>
);
