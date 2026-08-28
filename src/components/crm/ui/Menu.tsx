import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/* A small dropdown for row actions and status pickers. Deliberately
   not a full menubar implementation — it handles the one case this
   app has: a trigger, a short list, keyboard and outside-click. */
export const Menu = ({
  trigger,
  items,
  align = 'end',
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  label: string;
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        setActive(prev => {
          let next = prev;
          for (let i = 0; i < items.length; i += 1) {
            next = (next + dir + items.length) % items.length;
            if (!items[next].disabled) return next;
          }
          return prev;
        });
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[active];
        if (item && !item.disabled) {
          item.onSelect();
          setOpen(false);
        }
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, items, active]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger({
        open,
        toggle: () => {
          setActive(0);
          setOpen(o => !o);
        },
      })}

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-[calc(100%+4px)] z-40 min-w-[176px] overflow-hidden rounded-crm-md',
            'border border-crm-line-hi bg-crm-surface p-1 shadow-crm-pop',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-crm-sm px-2.5 py-1.5 text-left',
                'text-[13px] transition-colors duration-100 ease-crm',
                'disabled:cursor-not-allowed disabled:opacity-45',
                item.tone === 'danger' ? 'text-crm-danger' : 'text-crm-ink-2',
                i === active && !item.disabled && (item.tone === 'danger' ? 'bg-crm-danger-quiet' : 'bg-crm-raised'),
                i === active && !item.disabled && item.tone !== 'danger' && 'text-crm-ink',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
