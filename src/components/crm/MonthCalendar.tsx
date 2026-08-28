import { useState } from 'react';
import { isSameDay } from '../../lib/date';
import { IconButton } from './ui';
import { cn } from '../../lib/utils';

interface MonthCalendarProps {
  renderDay: (day: Date, isToday: boolean) => React.ReactNode;
}

/* Monday-first, because a work week starts on Monday and the weekend
   reads better as a pair at the end than split across both edges. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

const MonthCalendar = ({ renderDay }: MonthCalendarProps) => {
  const [cursor, setCursor] = useState(() => new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: Array<Date | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return (
    <div>
      <header className="mb-3 flex items-center justify-between gap-3">
        <IconButton
          label="Previous month"
          size="sm"
          icon={<Chevron dir="left" />}
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        />
        <div className="flex items-center gap-2">
          <span className="font-crm-display text-[14.5px] font-bold tracking-[-0.01em] text-crm-ink">
            {firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="cursor-pointer font-crm-mono text-[10px] uppercase tracking-[0.1em] text-crm-faint transition-colors duration-150 ease-crm hover:text-crm-copper"
            >
              Today
            </button>
          )}
        </div>
        <IconButton
          label="Next month"
          size="sm"
          icon={<Chevron dir="right" />}
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        />
      </header>

      {/* The 1px gap over a line-coloured ground draws the grid without
          a border on every cell, which would double up at every seam. */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-crm-lg border border-crm-line bg-crm-line">
        {WEEKDAYS.map(d => (
          <div
            key={d}
            className="bg-crm-surface px-2.5 py-2 font-crm-mono text-[10px] uppercase tracking-[0.12em] text-crm-ink-3"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday = Boolean(day) && isSameDay(day as Date, today);
          return (
            <div
              key={i}
              className={cn(
                'min-h-[92px] bg-crm-ground p-2',
                !day && 'bg-crm-ground/40',
                isToday && 'bg-crm-copper-quiet/40',
              )}
            >
              {day && (
                <>
                  <div
                    className={cn(
                      'crm-num mb-1.5 font-crm-mono text-[11px]',
                      isToday ? 'font-medium text-crm-copper' : 'text-crm-ink-3',
                    )}
                  >
                    {day.getDate()}
                  </div>
                  {renderDay(day, isToday)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
