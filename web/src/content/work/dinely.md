---
kind: product
name: Dinely
title: Reservations, floor plan and service on one dataset
sector: Restaurant software
# TODO(airaf): confirm. Placeholder until the real date is checked —
# draft: true keeps it out of production until then.
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
# TODO(airaf): sections 03 and 04 below are unwritten, because only you
# know what they say. Flip this to false once they are.
draft: true
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

<!-- TODO(airaf): this section is required and cannot be written for you.

/work promises every study includes it, and says in as many words that "a
case study without one is marketing". The 38,000-line decision above is
exactly the kind of call that costs something later — a migration that was
painful, a rule nobody could change safely, an onboarding that took a week.
Whatever it actually was, it goes here.

Two or three paragraphs. What broke, what it cost, what you would do
differently. -->

## Where it is now

<!-- TODO(airaf): the fourth section.

For an engagement this is "what it returned, measured after launch". Dinely
is a product, so it is instead: who is running it, on how many covers, and
what the system does in production that it could not do at launch.

If there are numbers here that a restaurant has agreed to, they belong in
`metrics` above with basis: measured. -->
