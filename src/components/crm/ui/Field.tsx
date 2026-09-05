import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../../lib/utils';

/* Every control gets a visible label. A placeholder disappears the
   moment someone types, which is exactly when they most need to know
   what the field was for. */
const CONTROL =
  'w-full rounded-crm-md border bg-crm-ground px-3 text-[13.5px] text-crm-ink ' +
  'placeholder:text-crm-faint transition-colors duration-150 ease-crm ' +
  'border-crm-line hover:border-crm-line-hi focus:border-crm-copper ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

const INVALID = 'border-crm-danger hover:border-crm-danger focus:border-crm-danger';

interface FieldShellProps {
  label: string;
  /* Errors sit next to the field they belong to, not in a summary at
     the top of the form where you have to hunt for the cause. */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export const Field = ({ label, error, hint, required, className, children }: FieldShellProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="font-crm-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-crm-ink-3"
      >
        {label}
        {required && <span className="ml-1 text-crm-copper">*</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="m-0 text-[12px] text-crm-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 text-[12px] text-crm-danger">
          {error}
        </p>
      )}
    </div>
  );
};

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
};

export const Input = ({ label, error, hint, className, required, ...rest }: InputProps) => (
  <Field label={label} error={error} hint={hint} required={required} className={className}>
    {({ id, describedBy, invalid }) => (
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(CONTROL, 'h-9', invalid && INVALID)}
        {...rest}
      />
    )}
  </Field>
);

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
};

export const Textarea = ({ label, error, hint, className, required, rows = 4, ...rest }: TextareaProps) => (
  <Field label={label} error={error} hint={hint} required={required} className={className}>
    {({ id, describedBy, invalid }) => (
      <textarea
        id={id}
        rows={rows}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(CONTROL, 'resize-y py-2 leading-relaxed', invalid && INVALID)}
        {...rest}
      />
    )}
  </Field>
);

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export const Select = ({
  label,
  error,
  hint,
  className,
  options,
  placeholder,
  required,
  ...rest
}: SelectProps) => (
  <Field label={label} error={error} hint={hint} required={required} className={className}>
    {({ id, describedBy, invalid }) => (
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(CONTROL, 'h-9 appearance-none pr-8', invalid && INVALID)}
        style={{
          /* Inline because the caret is a data URI keyed to the ink
             token; a background-image utility can't read a CSS var. */
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23948A80' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )}
  </Field>
);

/* Search is common enough in this app to deserve its own control —
   label hidden, icon visible, because a search box explains itself. */
export const SearchInput = ({
  value,
  onValueChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <div className={cn('relative', className)}>
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-crm-ink-3"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
    <input
      type="search"
      aria-label={placeholder}
      value={value}
      onChange={e => onValueChange(e.target.value)}
      placeholder={placeholder}
      className={cn(CONTROL, 'h-9 pl-9')}
    />
  </div>
);
