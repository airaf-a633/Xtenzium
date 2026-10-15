/* "You were signed out" — remembered across the redirect to the login
   page, so the person is told why instead of just landing on a form.
   Held in sessionStorage (this tab only) and read once. Storage can be
   blocked, so every touch is guarded and the app works without it. */

const KEY = 'crm:session-lost';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const store = (): Store | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

export function markSessionLost(s: Store | null = store()): void {
  try {
    s?.setItem(KEY, '1');
  } catch {
    /* not remembered; the login page just won't explain */
  }
}

/** True once after a session was lost, then false until it happens again. */
export function consumeSessionLost(s: Store | null = store()): boolean {
  try {
    if (!s || s.getItem(KEY) !== '1') return false;
    s.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
