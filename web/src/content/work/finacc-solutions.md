---
kind: product
name: FinAcc Solutions
links:
  site: https://finaccsolutions.com
  # TODO(airaf): public repo exists; paste its URL to show a source link.
  # repo: https://github.com/...
title: Gated content that never reaches the browser
sector: Financial services
# TODO(airaf): confirm the year.
year: 2024
summary: >-
  A financial and accounting services platform, server-rendered throughout.
  Authentication is enforced in middleware and gated content is never sent to
  the client at all, rather than sent and then hidden.
services:
  - Web Development
  - Technical Consultancy
stack: [Next.js, Supabase SSR, TypeScript, Framer Motion, Lenis]
headline:
  value: '0'
  label: Gated bytes reaching an unauthorised browser
  basis: observed
order: 6
# TODO(airaf): sections 03 and 04 are unwritten.
draft: true
---

## The problem

A great deal of gated content on the web is not gated. It is delivered to the
browser and then hidden with a conditional, which means the paywall is a
styling decision and the content is one devtools panel away. On a marketing
site that is embarrassing. On a platform handling financial and accounting
material it is a different category of problem, because the thing being
casually shipped to an unauthorised browser is somebody's financial position.

The failure is rarely deliberate. It is what happens by default when
authentication lives in the client: a component checks a session, decides not
to render, and the data it decided not to render was already in the payload
that carried the decision.

## What we decided, and why

Server-rendered throughout, with auth enforced in middleware — before a route
resolves, not inside the component that renders it.

The distinction is where the check happens relative to the data. A client-side
guard runs after the server has already chosen what to send. Middleware runs
before, so an unauthorised request is redirected without the protected content
ever being assembled, let alone serialised. The security property is not "the
content is hidden" but "the content was never produced", and only the second one
survives someone opening the network tab.

Supabase SSR is what makes this practical rather than theoretical. The session
is read on the server from cookies, so the same identity is available in
middleware, in the route, and in the data layer — one session, resolved once,
rather than a server-side notion of who you are and a client-side one that can
disagree. Sessions disagreeing is how the interesting bugs happen.

The cost is that everything is a server round trip, and a server-rendered app
can feel less immediate than one that ships its state to the browser. That is
paid back at the interface layer — Framer Motion and Lenis are there so
navigation reads as continuous even though each page is genuinely re-rendered
on the server.

## What went wrong

<!-- TODO(airaf): required. Candidates: session refresh at the middleware
boundary, caching a server-rendered page that turned out to be per-user, or
the point where a legitimately interactive feature had to break the SSR
model. -->

## Where it is now

<!-- TODO(airaf): live, who runs on it, and what the gated tier actually
serves today. Any number the client has agreed to goes in `metrics` with
basis: measured. -->
