import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/* Copper is the only saturated colour in the chrome, so exactly one
   button on a screen should be primary. Everything else is secondary
   or ghost — that's what makes the primary mean anything. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-crm-copper text-crm-copper-ink hover:bg-crm-copper-hover ' +
    'disabled:hover:bg-crm-copper',
  secondary:
    'bg-crm-raised text-crm-ink border border-crm-line-hi ' +
    'hover:border-crm-faint hover:bg-crm-line disabled:hover:bg-crm-raised',
  ghost:
    'bg-transparent text-crm-ink-2 hover:bg-crm-raised hover:text-crm-ink ' +
    'disabled:hover:bg-transparent',
  danger:
    'bg-crm-danger-quiet text-crm-danger border border-crm-danger/30 ' +
    'hover:border-crm-danger/60 disabled:hover:border-crm-danger/30',
};

const SIZES: Record<ButtonSize, string> = {
  /* 32px and 36px tall. Both clear the 24px WCAG 2.2 target minimum;
     rows of icon buttons get 8px gaps so the 44px comfort target is
     met by the group even where a single control is smaller. */
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-crm-sm',
  md: 'h-9 px-3.5 text-[13.5px] gap-2 rounded-crm-md',
};

const BASE =
  'inline-flex items-center justify-center font-medium whitespace-nowrap ' +
  'transition-colors duration-150 ease-crm select-none ' +
  'disabled:opacity-45 disabled:cursor-not-allowed';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

const Spinner = () => (
  <svg
    className="animate-spin shrink-0"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const content = (icon: ReactNode, loading: boolean | undefined, children: ReactNode) => (
  <>
    {loading ? <Spinner /> : icon}
    {children}
  </>
);

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  ref?: Ref<HTMLButtonElement>;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
    {...rest}
  >
    {content(icon, loading, children)}
  </button>
);

/* Same visual contract, but renders an anchor so navigation stays a
   real link — middle-click, copy-link and the browser's own back
   behaviour all keep working. */
export interface ButtonLinkProps extends CommonProps {
  to: string;
}

export const ButtonLink = ({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
}: ButtonLinkProps) => (
  <Link to={to} className={cn(BASE, SIZES[size], VARIANTS[variant], 'no-underline', className)}>
    {icon}
    {children}
  </Link>
);

/* An icon with no visible text still needs a name. `label` is required
   and becomes both the accessible name and the tooltip. */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export const IconButton = ({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: IconButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      BASE,
      VARIANTS[variant],
      size === 'sm' ? 'h-8 w-8 rounded-crm-sm' : 'h-9 w-9 rounded-crm-md',
      className,
    )}
    {...rest}
  >
    {icon}
  </button>
);
