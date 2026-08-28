---
kind: product
name: Dinely
links:
  site: https://dinely.co.uk
  repo: https://github.com/pizn-01/dinely
title: Reservations, floor plan and service on one dataset
sector: Restaurant software
year: 2025
summary: >-
  A reservation and floor-management platform for high-end restaurants. The
  booking wizard, the floor map and the service dashboard are three views of a
  single dataset, and the rules that decide what can be booked live in the
  database rather than in front of it.
services:
  - Web Development
  - UI/UX Design
stack: [React, Vite, TypeScript, Supabase, PostgreSQL, Express, Docker, Fly.io]
headline:
  value: 38,000
  label: Lines of PL/pgSQL holding the booking rules
  # `observed` — true by reading the schema, and not a claim about
  # outcomes, so it publishes without a client signing anything off.
  basis: observed
metrics:
  - value: '3'
    label: Surfaces over one dataset
    basis: observed
order: 1
draft: false
# Notes live here, not in the body: a YAML comment is parsed away, an HTML
# comment in the body is rendered into the page source.
#
# TODO(airaf): two details would make "What went wrong" land harder — a
# real example of a rule change that hurt, and what you actually did about
# the contention. Naming the fix turns it from a confession into an
# engineering story.
#
# TODO(airaf): a number in "Where it is now" would be the strongest thing
# on the page — covers served, sites live, services run without a booking
# conflict. Anything a restaurant has agreed to goes in `metrics` above
# with basis: measured.
---

## The problem

A restaurant at the top end is not running a booking form. It is running a
room. A table is not a row that is either free or taken — it is a seat count
that can be split, joined to the table beside it, held for a walk-in, turned
twice in an evening, or blocked because the party on it is celebrating
something and will not be rushed.

Most reservation software models the booking and leaves the room to the staff,
which is why the floor plan on the wall and the diary on the screen stop
agreeing at about seven o'clock. The moment they disagree, the diary is wrong
and nobody trusts it again that night.

## What we decided, and why

The availability rules live in Postgres, as roughly 38,000 lines of PL/pgSQL.

That is an unusual place to put them, and it was the central decision of the
project. The alternative — the normal one — is to hold those rules in the
application layer and let the interface enforce them. It reads better, it is
easier to test, and it is wrong for this problem, because it makes a
double-booking a bug rather than an impossibility. An application-layer rule is
only as good as the last code path somebody remembered to route through it, and
this system has three front doors: a guest booking on the public wizard, a
manager dragging a table on the floor map, and a host seating a walk-in on the
service dashboard.

Putting the constraint in the database means the answer to "can this table take
this party at this time" is the same answer no matter which door the question
came through, and it is the same answer at three in the morning when a
concurrent write arrives from two devices at once. A double-booking is not
prevented in Dinely. It is unrepresentable.

The cost is real and worth stating: the rules are harder to read, harder to
change, and harder to hire for than the equivalent TypeScript. We took that
trade because a booking system that is occasionally wrong is worse than no
booking system — a restaurant that has been double-booked once stops using the
software and goes back to the paper diary, and it never comes back.

The three surfaces are then genuinely the same data rather than three services
kept in sync. React and TypeScript on Vite for all three, Supabase and Express
in front of Postgres, containerised and running on Fly.io.

## What went wrong

Two things, and they turned out to be the same bill arriving twice.

The first was that changing a rule meant changing the database. A restaurant
would ask for something small and entirely reasonable — a policy about how late
a table can be held, a different rule for one section of the room — and because
the rules lived in PL/pgSQL, answering took a migration, a review and a deploy.
Software that keeps its logic in the application layer treats a request like
that as configuration and ships it the same afternoon. We treated every one of
them as a schema change, which is exactly the right amount of ceremony for a
constraint and far too much for a preference. The trouble is that a restaurant
does not experience those as two different kinds of request, and it took us
longer than it should have to notice that we had made every preference as
expensive to change as an invariant.

The second arrived on the nights that mattered. Serialising booking writes is
what makes a double-booking unrepresentable — and serialising booking writes is,
precisely, contention. Under ordinary load nobody could tell; on a full service
with concurrent writes landing on the same tables, the guarantee and the
bottleneck turned out to be the same mechanism seen from two sides. That is the
uncomfortable part of the decision, because it is not a bug in the
implementation that could be fixed by writing it better. It is what the
guarantee costs, and we were buying it without having priced it.

What we would do differently is not "put the rules in the application" — the
argument in the section above still holds, and a booking system that is
occasionally wrong is still worse than none. It is to separate the two kinds of
rule at the start. The invariants that must never be violated belong in the
database and are worth every bit of the ceremony. The preferences that a
restaurant will want to change eight times in the first month are not
invariants, and putting them in the same place was a category error that only
looked like consistency.

## Where it is now

Live, with paying restaurants running real services through it.

The parts that were expensive to build are the parts that stopped being
thought about, which is the outcome you want from a constraint living in the
database: nobody on the floor is checking whether the diary and the room agree,
because they cannot disagree. The failure mode Dinely was built to remove is
not managed in production. It is absent.
