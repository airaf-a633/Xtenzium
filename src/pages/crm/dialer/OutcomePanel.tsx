import { useRef, useState } from 'react';
import {
  GENERAL_CHIPS, filterPeople, formatInZone, insertMention, mentionLabel, mentionTrigger, mentionsIn,
  zonedToUtc, type MentionTrigger, type OutcomeDef,
} from '../../../lib/dialer-calls';
import { useMentionables } from './useMentionables';
import { Button, Input, Textarea } from '../../../components/crm/ui';
import { cn } from '../../../lib/utils';

export interface OutcomeSubmit {
  tags: string[];
  note: string;
  flagged: boolean;
  /** ISO instant, set only for callback / meeting outcomes. */
  at: string | null;
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-crm-line-hi bg-crm-ground px-1.5 py-px font-crm-mono text-[10.5px] text-crm-ink-3">
    {children}
  </kbd>
);

/* The form that follows choosing an outcome: quick-tag chips, a note,
   a flag for the owner, and — for callbacks and meetings — a time.
   Shared by the call screen and the board so both log a call the same
   way. Times are typed in the PROSPECT's zone, because that's the
   clock the agreement was made on. */
const OutcomePanel = ({
  outcome, leadTz, zoneLabel, myTz, saving, onSubmit, onCancel, onInvalid,
}: {
  outcome: OutcomeDef;
  leadTz: string;
  zoneLabel: string;
  myTz: string;
  saving: boolean;
  onSubmit: (v: OutcomeSubmit) => void;
  onCancel: () => void;
  onInvalid: (message: string) => void;
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [atLocal, setAtLocal] = useState('');

  /* @mentions: suggestions appear while an "@name" is being typed. */
  const people = useMentionables();
  const noteBox = useRef<HTMLDivElement>(null);
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null);
  const [pick, setPick] = useState(0);
  const suggestions = trigger ? filterPeople(people, trigger.query).slice(0, 5) : [];
  const tagged = mentionsIn(note, people);

  const watchCaret = (el: HTMLTextAreaElement) => {
    setTrigger(mentionTrigger(el.value, el.selectionStart));
    setPick(0);
  };

  const choose = (index: number) => {
    const person = suggestions[index];
    const el = noteBox.current?.querySelector('textarea');
    if (!person || !trigger || !el) return;
    const next = insertMention(note, trigger, el.selectionStart, mentionLabel(person, people));
    setNote(next.text);
    setTrigger(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  /* Runs before the panel's own Enter/Escape handling, and stops it
     while the suggestion list is open — otherwise picking a name with
     Enter would also save the call. */
  const onNoteKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setPick(i => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      choose(pick);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setTrigger(null);
    }
  };

  const wantsTime = outcome.needs === 'callback_time' || outcome.needs === 'meeting_time';
  const preview = wantsTime && atLocal ? zonedToUtc(atLocal, leadTz) : null;
  const chips = outcome.chips ?? GENERAL_CHIPS;

  const submit = () => {
    if (saving) return;
    let at: string | null = null;
    if (wantsTime) {
      if (!atLocal) {
        onInvalid(outcome.needs === 'callback_time' ? 'Pick a callback time.' : 'Enter the meeting time.');
        return;
      }
      const when = zonedToUtc(atLocal, leadTz);
      if (when.getTime() < Date.now() - 60_000) {
        onInvalid('That time has already passed.');
        return;
      }
      at = when.toISOString();
    }
    onSubmit({ tags, note: note.trim(), flagged, at });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
      {wantsTime && (
        <div>
          <Input
            label={`${outcome.needs === 'callback_time' ? 'Call back' : 'Meeting'} at — their time (${zoneLabel})`}
            type="datetime-local"
            value={atLocal}
            onChange={e => setAtLocal(e.target.value)}
            autoFocus
          />
          {preview && (
            <p className="m-0 mt-1.5 text-[12.5px] text-crm-ink-3">
              = {formatInZone(preview, leadTz)} · {formatInZone(preview, myTz)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chips.map(c => {
          const on = tags.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => setTags(t => (on ? t.filter(x => x !== c) : [...t, c]))}
              className={cn(
                'cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                on
                  ? 'border-crm-copper bg-crm-copper/10 text-crm-ink'
                  : 'border-crm-line bg-crm-surface text-crm-ink-2 hover:border-crm-line-hi',
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div ref={noteBox} className="relative" onKeyDown={onNoteKeyDown}>
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={e => {
            setNote(e.target.value);
            watchCaret(e.target);
          }}
          onKeyUp={e => {
            if (e.key.startsWith('Arrow') && suggestions.length > 0) return;
            watchCaret(e.currentTarget);
          }}
          onClick={e => watchCaret(e.currentTarget)}
          autoFocus={!wantsTime}
          hint={
            people.length > 0
              ? 'Enter saves · Shift+Enter for a new line · type @ to tag a teammate'
              : 'Enter saves · Shift+Enter for a new line'
          }
        />
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Teammates"
            className="absolute left-0 z-20 m-0 mt-1 w-[260px] list-none overflow-hidden rounded-crm-md border border-crm-line-hi bg-crm-surface p-0 shadow-lg"
          >
            {suggestions.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === pick}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 border-0 px-3 py-2 text-left text-[13px] text-crm-ink',
                    i === pick ? 'bg-crm-raised' : 'bg-transparent hover:bg-crm-raised',
                  )}
                >
                  @{mentionLabel(p, people)}
                  <span className="text-crm-ink-3">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tagged.length > 0 && (
        <p className="m-0 -mt-1 text-[12.5px] text-crm-copper">
          Will notify {tagged.map(p => p.name.split(' ')[0]).join(', ')} — {tagged[0].name.split(' ')[0]} takes the follow-up.
        </p>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-crm-ink-2">
        <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
        Flag for the owner
      </label>

      {outcome.key === 'dnc' && (
        <p className="m-0 text-[12.5px] text-crm-danger">This blocks the number and the website for good.</p>
      )}

      <div className="flex gap-2">
        <Button variant={outcome.key === 'dnc' ? 'danger' : 'primary'} loading={saving} onClick={submit}>
          Save &amp; next <Kbd>Enter</Kbd>
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          Cancel <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  );
};

export default OutcomePanel;
