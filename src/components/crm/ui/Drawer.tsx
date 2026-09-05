import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* A side panel rather than a modal, because a deal is something you
   read *against* the board — you want to see which column it came from
   while you're editing it. Same focus contract as Dialog: trapped
   while open, returned where it came from on close. */
export const Drawer = ({
  open,
  onClose,
  title,
  eyebrow,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="crm-root fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Details'}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col',
          'border-l border-crm-line bg-crm-surface shadow-crm-pop',
          'motion-safe:animate-[crm-drawer-in_220ms_cubic-bezier(0.16,1,0.3,1)]',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-crm-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
            <h2 className="m-0 font-crm-display text-[16.5px] font-bold leading-snug tracking-[-0.015em] text-crm-ink">
              {title}
            </h2>
          </div>
          <IconButton
            label="Close"
            size="sm"
            onClick={onClose}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            }
          />
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-between gap-2 border-t border-crm-line px-5 py-3.5">
            {footer}
          </footer>
        )}

        <style>{`@keyframes crm-drawer-in{from{transform:translateX(16px);opacity:0}to{transform:none;opacity:1}}`}</style>
      </div>
    </div>,
    document.body,
  );
};
