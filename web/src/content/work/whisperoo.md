---
kind: product
name: Whisperoo
links:
  site: https://whisperoo.app
  # No public repo — closed source, so no repo link.
title: Three audiences, one scheduling core
sector: Healthcare
year: 2025
summary: >-
  A maternal and infant care platform connecting parents with clinical experts.
  Parents booking support, experts running a practice and clinics onboarding
  staff each get their own surface over shared scheduling and profile data, with
  an assistant that answers from the experts and courses actually on the
  platform rather than from the internet.
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
draft: false
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

Sitting across all three is an assistant, and it is the part that caused the
most trouble.

## What went wrong

The assistant had to answer from the platform, not from the internet, and the
distance between those two things is most of the work.

A general model already knows a great deal about maternal and infant care, and
almost all of it is useless here — worse than useless, because a plausible
answer drawn from general knowledge is indistinguishable, to a parent reading
it, from one grounded in the experts and courses actually on the platform. The
job was never to make it knowledgeable. It was to make it answer only from a
corpus that changes every time an expert edits a course or updates their
availability, and to make refusal the behaviour when the corpus has nothing to
say.

It did not do that at first. It recommended things that did not exist —
experts, courses, guidance with nobody behind it. In most products that is an
embarrassing bug with a funny screenshot attached. In maternal and infant care
it is not, and the difference is worth being precise about: a parent acting on
a confidently phrased recommendation at three in the morning is the exact user
the product was designed for, and a fabricated answer reaches them through the
same interface, in the same tone, as a real one. The failure is silent on our
side and load-bearing on theirs.

Fixing it was less about prompting than about grounding: constraining answers
to retrieved material, and treating "I don't have anything on that, here is how
to reach someone who does" as a correct answer rather than a fallback. That is
a worse demo and a better product. An assistant that declines is doing its job;
an assistant that always has something to say is the failure mode wearing a
friendly face.

The unglamorous half was keeping what the assistant knew in step with what the
platform held. Experts add courses, revise them, change what they offer. Every
one of those edits is a cache invalidation problem wearing a content-management
costume, and an assistant confidently describing a course that was withdrawn
last week is the same class of error as inventing one.

## Where it is now

Live across all three audiences — parents booking, experts running practices,
clinics onboarding their staff.

The assistant is the part that changed most between launch and now, and it
changed by learning to say less. What ships today refuses more often than the
first version did, cites what it is drawing on, and hands over to a real expert
when the corpus is thin. In a care product that reads as trustworthy rather
than limited, which was not obvious to us at the start.
