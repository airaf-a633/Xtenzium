import { useState } from 'react';
import { isSameDay } from '../../lib/date';

interface MonthCalendarProps {
  renderDay: (day: Date, isToday: boolean) => React.ReactNode;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MonthCalendar = ({ renderDay }: MonthCalendarProps) => {
  const [cursor, setCursor] = useState(() => new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: Array<Date | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, color: '#888', padding: '6px 12px', cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ color: '#ddd', fontSize: 15, fontWeight: 600 }}>
          {firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, color: '#888', padding: '6px 12px', cursor: 'pointer' }}
        >
          →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ background: '#141414', color: '#555', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '8px 10px' }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday = !!day && isSameDay(day, today);
          return (
            <div
              key={i}
              style={{
                background: '#111', minHeight: 90, padding: '8px 8px', opacity: day ? 1 : 0.3,
                border: isToday ? '1px solid #3b82f666' : 'none',
              }}
            >
              {day && (
                <>
                  <div style={{ color: isToday ? '#3b82f6' : '#666', fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 6 }}>
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
