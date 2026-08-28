import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* One header component so every page in the CRM starts at the same
   baseline and the eye doesn't have to re-find the title on each
   navigation. Breadcrumb is optional and only appears on detail pages,
   where "back to where" is a real question. */
export const PageHeader = ({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) => (
  <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-crm-ink-3 no-underline transition-colors duration-150 ease-crm hover:text-crm-ink-2"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {back.label}
        </Link>
      )}
      <h1 className="m-0 font-crm-display text-[24px] font-bold leading-tight tracking-[-0.025em] text-crm-ink">
        {title}
      </h1>
      {subtitle && <p className="m-0 mt-1.5 text-[13.5px] text-crm-ink-3">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);
