/* Who may go where.

   This is the UI half of the role model — it decides which screen
   someone lands on and which routes bounce them. It is NOT the security
   boundary: migration 016 is, at the database. Hiding a page here only
   keeps a caller from staring at empty tables. */

import type { UserRole } from '../types/database';

export const CALLER_HOME = '/crm/dialer';
export const ADMIN_HOME = '/crm';

export const homeFor = (role: UserRole | null): string =>
  role === 'caller' ? CALLER_HOME : ADMIN_HOME;

/** Is `role` one of the allowed roles? A null role (no profile) never is. */
export const roleAllowed = (role: UserRole | null, allow: readonly UserRole[]): boolean =>
  role !== null && allow.includes(role);
