import { cn } from '../../../lib/utils';

/* Five warm-compatible hues, none of them copper. An avatar is an
   identifier, not an accent — if avatars used the accent hue the eye
   would keep mistaking a teammate for a call to action. */
const HUES = [
  'bg-crm-info-quiet text-crm-info',
  'bg-crm-success-quiet text-crm-success',
  'bg-crm-violet-quiet text-crm-violet',
  'bg-crm-warning-quiet text-crm-warning',
  'bg-crm-danger-quiet text-crm-danger',
];

/* Deterministic so a person is the same colour on every screen and
   across sessions — the colour becomes part of recognising them. */
const hueFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
};

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] ?? '')
    .join('')
    .toUpperCase() || '?';

const SIZES = {
  xs: 'h-5 w-5 text-[9.5px]',
  sm: 'h-6 w-6 text-[10.5px]',
  md: 'h-8 w-8 text-[12px]',
  lg: 'h-10 w-10 text-[14px]',
};

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export const Avatar = ({ name, size = 'sm', className }: AvatarProps) => (
  <span
    title={name}
    className={cn(
      'inline-flex shrink-0 select-none items-center justify-center rounded-full',
      'font-crm-mono font-medium leading-none',
      SIZES[size],
      hueFor(name),
      className,
    )}
  >
    {initialsFor(name)}
  </span>
);

/* Overlapping stack for "who's on this". Anything past `max` collapses
   into a +N chip rather than growing the row. */
export const AvatarStack = ({
  names,
  max = 3,
  size = 'sm',
}: {
  names: string[];
  max?: number;
  size?: keyof typeof SIZES;
}) => {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          size={size}
          className={cn('ring-2 ring-crm-surface', i > 0 && '-ml-1.5')}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'z-10 -ml-1.5 inline-flex items-center justify-center rounded-full',
            'bg-crm-raised font-crm-mono text-crm-ink-3 ring-2 ring-crm-surface',
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
};
