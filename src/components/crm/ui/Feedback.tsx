import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/* Space is reserved before data arrives, so nothing jumps when it
   lands. Skeletons match the shape of what replaces them — a row
   skeleton is row-height, a tile skeleton is tile-height. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn('animate-pulse rounded-crm-sm bg-crm-raised', className)}
    aria-hidden="true"
  />
);

export const SkeletonRows = ({ rows = 5, className }: { rows?: number; className?: string }) => (
  <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);

export const SkeletonTiles = ({ count = 5 }: { count?: number }) => (
  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-[108px]" />
    ))}
  </div>
);

export const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    role="status"
    aria-label="Loading"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* An empty state says what would be here and how to put something
   here. "No data" tells you nothing you didn't already know. */
export const EmptyState = ({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-2 rounded-crm-lg border border-dashed',
      'border-crm-line px-6 py-12 text-center',
      className,
    )}
  >
    <p className="m-0 font-crm-display text-[14.5px] font-bold text-crm-ink">{title}</p>
    {body && <p className="m-0 max-w-[42ch] text-[13px] text-crm-ink-3">{body}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* Errors name what failed and what to do next — never an apology,
   never a raw exception string. */
export const ErrorState = ({
  title = 'That didn’t load',
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) => (
  <div
    role="alert"
    className="flex flex-col items-start gap-2 rounded-crm-lg border border-crm-danger/30 bg-crm-danger-quiet px-4 py-3.5"
  >
    <p className="m-0 text-[13.5px] font-medium text-crm-danger">{title}</p>
    {body && <p className="m-0 text-[13px] text-crm-ink-2">{body}</p>}
    {action}
  </div>
);
