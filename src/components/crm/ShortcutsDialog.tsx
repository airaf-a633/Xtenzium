import { Dialog } from './ui';

/* Grouped by when you'd reach for them, not alphabetically. The
   palette row comes first because it's the one that makes the rest
   optional. */
const GROUPS: Array<{ title: string; rows: Array<[string[], string]> }> = [
  {
    title: 'Anywhere',
    rows: [
      [['⌘', 'K'], 'Open the command palette'],
      [['/'], 'Search — same palette, straight into the field'],
      [['C'], 'Create — type a title and press Enter'],
      [['?'], 'This list'],
      [['Esc'], 'Close, or step back one screen'],
    ],
  },
  {
    title: 'Go to',
    rows: [
      [['G', 'D'], 'Dashboard'],
      [['G', 'P'], 'Pipeline'],
      [['G', 'C'], 'Clients'],
      [['G', 'R'], 'Projects'],
      [['G', 'T'], 'Tasks'],
      [['G', 'M'], 'Team'],
    ],
  },
  {
    title: 'In the palette',
    rows: [
      [['↑', '↓'], 'Move through results'],
      [['↵'], 'Run the highlighted result'],
      [['Esc'], 'Back a screen, then close'],
    ],
  },
];

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-crm-sm border border-crm-line-hi bg-crm-raised px-1.5 font-crm-mono text-[10.5px] text-crm-ink-2">
    {children}
  </kbd>
);

const ShortcutsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog
    open={open}
    onClose={onClose}
    wide
    title="Keyboard shortcuts"
    description="Everything below works without touching the mouse."
  >
    <div className="grid gap-6 sm:grid-cols-2">
      {GROUPS.map(group => (
        <section key={group.title}>
          <h3 className="m-0 mb-2.5 font-crm-mono text-[10.5px] uppercase tracking-[0.12em] text-crm-ink-3">
            {group.title}
          </h3>
          <ul className="m-0 list-none p-0">
            {group.rows.map(([keys, label]) => (
              <li key={label} className="flex items-center gap-3 border-b border-crm-line py-1.5 last:border-b-0">
                <span className="flex shrink-0 items-center gap-1">
                  {keys.map(k => (
                    <Key key={k}>{k}</Key>
                  ))}
                </span>
                <span className="text-[12.5px] text-crm-ink-2">{label}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    <p className="m-0 mt-5 border-t border-crm-line pt-4 text-[12.5px] text-crm-ink-3">
      Creating a task from the palette drops you straight onto its actions, so a new task can be
      assigned, dated and flagged urgent without ever leaving the keyboard.
    </p>
  </Dialog>
);

export default ShortcutsDialog;
