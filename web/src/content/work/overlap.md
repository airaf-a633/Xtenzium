---
kind: product
name: Overlap
links:
  site: https://overlap-gules.vercel.app
  # TODO(airaf): public repo exists; paste its URL to show a source link.
  # repo: https://github.com/...
title: A studio site that argues in clocks
sector: Software
year: 2025
summary: >-
  The studio site for an engineering practice working US hours from Pakistan.
  The pitch is a scheduling argument, so the page makes it literal — paired live
  clocks for both time zones and a 24-hour band shading the six hours the two
  working days actually share.
services:
  - Web Development
  - Design & Branding
stack: [React, TypeScript, Vite, Tailwind CSS, Lenis, Vercel]
headline:
  value: '6'
  label: Hours the two working days share
  basis: observed
order: 5
draft: true
# Notes live here, not in the body: a YAML comment is parsed away, an HTML
# comment in the body is rendered into the page source.
#
# TODO(airaf): two fields left before this can publish —
#   1. `year` above is a placeholder; confirm it.
#   2. "Where it is now" is unwritten. Who is running it, at what scale, and
#      what it does in production that it could not do at launch. Any number
#      someone has agreed to goes in `metrics` with basis: measured.
---

## The problem

Every offshore engineering practice makes the same claim on its homepage, and
it is always the same sentence: significant timezone overlap with US teams. The
sentence is doing no work. A prospect who has been burned before reads it as
marketing, because it is indistinguishable from marketing — the studio that
overlaps for six hours and the studio that overlaps for ninety minutes write it
identically.

The objection underneath is not really about hours. It is "will I be able to
reach you when something is on fire", and no amount of prose answers it,
because prose is exactly the medium the reader has learned to discount.

## What we decided, and why

Show the clocks. Do not describe the overlap — draw it.

The page carries two live clocks, one per zone, and a 24-hour band with the
shared six hours shaded. That is the entire argument, and it works because it
is checkable. A visitor can look at their own watch, look at the page, and
confirm it is telling the truth right now. A claim that can be falsified in one
second and survives is worth more than three paragraphs that cannot be tested
at all.

It also fails honestly, which is the part worth keeping. Land on the page at
three in the morning Karachi time and the band shows you are outside the
overlap. A marketing site would never volunteer that. Volunteering it is what
makes the shaded hours believable when you land during them — the component is
not selling, it is reporting, and a reader can tell the difference.

The rest of the site stays deliberately quiet so the clocks are the only thing
doing work: React on Vite, Tailwind, Lenis for the scroll, Vercel.

## What went wrong

The page made its argument well, and the argument was not what stood in the
way.

That is an awkward thing to publish about your own work and it is the honest
account. The clocks do what they were built to do: they answer the timezone
objection, immediately and checkably, in a way prose cannot. What we had
assumed — without ever testing it — is that the timezone objection was the one
holding enquiries back. It was the objection people *said*, which is not the
same thing, and a site can only answer the objections it is pointed at.

The failure was upstream of the build. We took a stated objection at face value
and engineered a very good answer to it, and the thing that actually needed
work was the offer behind the site rather than the site. A studio page can make
a scheduling argument beautifully and still not resolve the questions a
prospect is really weighing: whether this team has done the specific thing
before, who is accountable if it slips, and what happens when it does.

The engineering lesson is small and the other one is not. The component is
still the right idea, and we would build it again. We would not again treat
"what do prospects object to" as answered by asking them, or assume that the
most articulable objection is the binding one.
