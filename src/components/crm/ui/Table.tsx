import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

/* Tables scroll inside their own container so a wide money column
   never makes the whole page scroll sideways. */
export const TableShell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('overflow-x-auto rounded-crm-lg border border-crm-line bg-crm-surface', className)}>
    <table className="w-full border-collapse text-[13.5px]">{children}</table>
  </div>
);

export const Th = ({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap border-b border-crm-line px-4 py-2.5',
      'font-crm-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-crm-ink-3',
      align === 'right' ? 'text-right' : 'text-left',
      className,
    )}
  >
    {children}
  </th>
);

export const Td = ({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) => (
  <td
    className={cn(
      'border-b border-crm-line px-4 py-3 align-middle text-crm-ink-2',
      align === 'right' ? 'crm-num text-right' : 'text-left',
      className,
    )}
  >
    {children}
  </td>
);

export const Tr = ({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <tr
    onClick={onClick}
    className={cn(
      'last:[&>td]:border-b-0',
      onClick && 'cursor-pointer transition-colors duration-150 ease-crm hover:bg-crm-raised',
      className,
    )}
  >
    {children}
  </tr>
);
