import { supabase } from '../../../lib/supabase';
import { callGoogle, type BookResponse } from '../../../lib/google-api';
import { formatInZone, isConnectionError, isSessionError, type OutcomeDef } from '../../../lib/dialer-calls';
import type { OutcomeSubmit } from './OutcomePanel';

export interface Contact {
  name?: string;
  title?: string;
  email?: string;
}

export type LogResult =
  | { ok: true; message: string; /** The log row, for Undo. Null for calendar bookings. */ activityId: string | null }
  | { ok: false; error: string; code: string | null };

/* One way to record a call, used by the call screen and the board.

   A meeting picked from the calendar goes through the server, which
   creates the event, sends the invites and logs the call as one
   operation (undoing the event if the CRM refuses). Everything else is
   a plain log_call. Callers never need to know which happened. */
export async function logOutcome(
  lead: { id: string; company_name: string; timezone: string | null },
  outcome: OutcomeDef,
  v: OutcomeSubmit,
  contact: Contact = {},
): Promise<LogResult> {
  if (v.booking) {
    const r = await callGoogle<BookResponse>({
      action: 'book',
      lead_id: lead.id,
      start: v.booking.start,
      duration: v.booking.duration,
      attendee_email: v.booking.email,
      attendee_name: v.booking.name || contact.name || '',
      note: v.note,
      tags: v.tags,
      flagged: v.flagged,
      contact_name: contact.name ?? v.booking.name,
      contact_title: contact.title ?? '',
    });
    if (r.error || !r.data) return { ok: false, error: r.error ?? 'Couldn’t book that.', code: r.code };
    return { ok: true, message: `${lead.company_name}: meeting booked · invite sent to ${v.booking.email}`, activityId: null };
  }

  const { data, error } = await supabase.rpc('log_call', {
    p_lead_id: lead.id,
    p_outcome: outcome.key,
    p_tags: v.tags,
    p_note: v.note || null,
    p_flagged: v.flagged,
    p_at: v.at,
    p_contact_name: contact.name?.trim() || null,
    p_contact_title: contact.title?.trim() || null,
    p_contact_email: contact.email?.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error: isConnectionError(error.message)
        ? 'Couldn’t reach the server — that call is NOT logged yet. Press it again when the connection is back.'
        : isSessionError(error.message)
          ? 'Your login was just renewed — that call is NOT logged yet. Press it again.'
          : error.message,
      code: null,
    };
  }
  const next = data?.next_call_at ? ` · next ${formatInZone(new Date(data.next_call_at), lead.timezone ?? 'America/New_York')}` : '';
  return { ok: true, message: `${lead.company_name}: ${outcome.label}${next}`, activityId: data?.activity_id ?? null };
}
