/* Role routing checks. The security boundary is the database (016); this
   guards the UI half — that a caller lands on the dialer, an admin on the
   dashboard, and a login with no profile is let into nothing. */

import { ADMIN_HOME, CALLER_HOME, homeFor, roleAllowed } from '../src/lib/roles';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (got !== want) {
    failures++;
    console.error(`FAIL ${name}: got ${String(got)}, want ${String(want)}`);
  }
};

eq('admin home', homeFor('admin'), ADMIN_HOME);
eq('caller home', homeFor('caller'), CALLER_HOME);
eq('no-profile home', homeFor(null), ADMIN_HOME);

eq('admin allowed on admin routes', roleAllowed('admin', ['admin']), true);
eq('caller blocked from admin routes', roleAllowed('caller', ['admin']), false);
eq('caller allowed on dialer', roleAllowed('caller', ['admin', 'caller']), true);
eq('admin allowed on dialer', roleAllowed('admin', ['admin', 'caller']), true);
eq('no profile blocked everywhere', roleAllowed(null, ['admin', 'caller']), false);

if (failures) {
  console.error(`${failures} role check(s) failed`);
  process.exit(1);
}
console.log('roles: all checks passed');
