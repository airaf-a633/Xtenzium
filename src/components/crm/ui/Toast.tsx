import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';

type ToastTone = 'success' | 'danger' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  /* A toast says what happened, in the past tense: "Project moved to
     Active", not "Moving project…". If it's still happening it isn't
     a toast, it's a loading state. */
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-crm-success/35 bg-crm-success-quiet text-crm-success',
  danger: 'border-crm-danger/35 bg-crm-danger-quiet text-crm-danger',
  info: 'border-crm-line-hi bg-crm-raised text-crm-ink',
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts(prev => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="crm-root pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2"
          role="status"
          aria-live="polite"
        >
          {toasts.map(t => (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto max-w-[340px] rounded-crm-md border px-3.5 py-2.5',
                'text-[13px] font-medium shadow-crm-pop',
                'motion-safe:animate-[crm-toast-in_180ms_cubic-bezier(0.16,1,0.3,1)]',
                TONE_STYLES[t.tone],
              )}
            >
              {t.message}
            </div>
          ))}
          <style>{`@keyframes crm-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
};
