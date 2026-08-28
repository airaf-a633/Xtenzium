---
kind: product
name: FinAcc Solutions
links:
  site: https://finaccsolutions.com
  repo: https://github.com/pizn-01/finaccsolutions
title: Gated content that never reaches the browser
sector: Financial services
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
draft: false
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

Nothing broke, and that is the part worth writing about.

There is no incident here. No leak, no session bug, no cache serving one
person's filings to another. Saying so in a section titled "what went wrong" is
uncomfortable, because an absence of failure reads as a brag and it is not one
— it is the outcome the architecture was bought for, and it came at a price
worth stating plainly.

The price is that everything is a round trip. A server-rendered application
with auth in middleware cannot do the thing that makes modern web apps feel
quick, which is to answer from state it already holds in the browser. Every
gated view is a request. Every navigation waits on a server that has to resolve
who you are before it will assemble anything. Framer Motion and Lenis are on
this project as compensation, not decoration: they make navigation read as
continuous over a model that is genuinely re-rendering each page, and without
them the correctness would have been noticeably less pleasant to use.

The second cost is that the rule only holds while it holds absolutely. The
security property is "the content was never produced", and it survives exactly
as long as nobody adds a convenient client-side fetch for a panel that seemed
harmless. That is not a technical safeguard, it is a standing constraint on
everybody who touches the codebase afterwards, and the honest risk on this
project is not that the middleware was wrong. It is that a future feature is
allowed to route around it.

## Where it is now

Live, run by the client.

The architecture has held, which for this project is the entire report: no
gated document has reached a browser that was not entitled to it, and the
standing constraint described above has not yet been routed around. That is
worth restating precisely because it is uneventful. The measure of this system
working is that there is nothing to say about it.
