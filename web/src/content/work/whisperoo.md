---
kind: product
name: Whisperoo
title: Three audiences, one scheduling core
sector: Healthcare
# TODO(airaf): confirm the year.
year: 2025
summary: >-
  A maternal and infant care platform connecting parents with clinical experts.
  Parents booking support, experts running a practice and clinics onboarding
  staff each get their own surface, over shared scheduling and profile data
  rather than three products that have to agree with each other.
services:
  - Web Development
  - UI/UX Design
stack:
  [React, TypeScript, Vite, TanStack Query, Supabase, PostgreSQL, Tailwind CSS, Radix UI, Zod]
headline:
  value: '3'
  label: Audiences on one scheduling core
  basis: observed
order: 4
# TODO(airaf): sections 03 and 04 are unwritten.
draft: true
---

## The problem

A marketplace with two sides is a hard product. This one has three, and the
third is the one that breaks the usual approach.

A parent wants to find the right person quickly, at two in the morning, while
holding a baby. An expert wants the thing to behave like practice management
software — a calendar they control, a profile they own, and no surprises about
who can book them. A clinic wants neither of those; it wants to onboard a group
of staff, see them as a roster, and be confident nobody is double-booked across
the practice.

Those are three genuinely different products by every measure except the data
underneath, which is the same availability and the same profiles seen from
three angles. Build them as three applications and the calendars drift, which in
a care context is not a scheduling inconvenience — it is a parent who was told
someone would be there.

## What we decided, and why

Three surfaces, one dataset, and validation that runs in exactly one place.

Every boundary — form submission, API call, anything crossing into the database
— goes through the same Zod schemas. That is the decision that makes three
surfaces survivable. When a clinic administrator sets an expert's availability
and that expert simultaneously changes it from their own dashboard, both writes
are checked against the same definition of what a valid availability window is.
Without a single source of truth for that shape, the three surfaces each grow
their own slightly different idea of it, and the differences only ever surface
as a booking that should not exist.

Server state runs through TanStack Query rather than being held in component
state, so a schedule is cached and invalidated in one place instead of being
re-fetched differently by each surface. Radix supplies the primitives, which
matters here more than usual: a scheduling interface is dense with menus,
dialogs and date pickers, and keyboard and screen-reader behaviour on those is
not something to hand-roll for an audience that includes people operating
one-handed at three in the morning.

## What went wrong

<!-- TODO(airaf): required. Candidate areas: timezone handling across clinics,
the permission model once clinics could act on behalf of experts, or the
migration when a second audience arrived after the first shipped. -->

## Where it is now

<!-- TODO(airaf): experts on the platform, clinics onboarded, bookings served.
Anything a clinic has agreed to publish goes in `metrics` with basis:
measured. -->
