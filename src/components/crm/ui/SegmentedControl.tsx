import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/* The board/list/calendar switcher, and anything else that picks one
   of a few views. Rendered as real radios so arrow keys move between
   options and screen readers announce it as one group with a
   selection, not three unrelated buttons. */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<Segment<T>>;
  label: string;
  className?: string;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn(
      'inline-flex items-center gap-0.5 rounded-crm-md border border-crm-line bg-crm-surface p-0.5',
      className,
    )}
  >
    {options.map(o => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-crm-sm px-2.5 text-[12.5px] font-medium',
            'transition-colors duration-150 ease-crm',
            active
              ? 'bg-crm-raised text-crm-ink'
              : 'text-crm-ink-3 hover:bg-crm-raised/60 hover:text-crm-ink-2',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      );
    })}
  </div>
);
