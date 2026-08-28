---
kind: product
name: Carmazium
links:
  site: https://www.carmazium.com
  repo: https://github.com/pizn-01/carmazium
title: One car at a time, at showroom scale
sector: Automotive
year: 2025
summary: >-
  A cinematic-first automotive marketplace with live auctions. A listing gets
  the weight it would have on a showroom floor — full-bleed imagery, scroll-driven
  sequencing, one vehicle at a time rather than a grid — and then has to hold a
  real-time bidding system inside that same presentation.
services:
  - Web Development
  - Design & Branding
stack: [Next.js, TypeScript, Tailwind CSS, Framer Motion, Docker]
headline:
  value: '1'
  label: Vehicle on screen at a time
  basis: observed
order: 3
draft: false
---

## The problem

Every car marketplace is a spreadsheet with photographs. Twelve thumbnails to a
row, price, mileage, year, and a filter rail down the left. That layout is
optimised for a buyer who already knows the exact model they want and is
sorting by price — and it is actively bad for everyone else, because the way
anybody actually chooses a car is by wanting it.

A showroom knows this. It does not put forty cars in a grid. It puts one under
a light, gives it floor space, and lets you walk around it. The grid is not a
neutral container; it flattens a fifty-thousand-dollar decision into a
comparison of numbers, and then the listing that wins is the cheapest one,
which is the wrong outcome for the seller and usually for the buyer too.

## What we decided, and why

One vehicle at a time. No results grid.

This is the expensive decision, and it is expensive in a specific way: it costs
scanning speed. A grid lets you reject nine cars per second. A sequenced,
full-bleed presentation does not, and if the buyer's actual job is "find the
cheapest 2019 diesel estate", this is a worse tool and we accepted that.

What it buys is that a listing can make an argument. Scroll-driven sequencing
means the presentation has an order — the exterior before the interior, the
condition before the price — and order is the only thing separating a
presentation from a data dump. A grid cannot do this because a grid has no
order; every cell is simultaneous and equal, which is exactly why every car in
one looks like every other car in one.

Next.js 15 and Tailwind v4, with Framer Motion driving the sequencing. Motion
rather than GSAP here because the sequencing is component-local and tied to
React's lifecycle rather than to a single page-wide scroll timeline.

Then the auction goes inside all of that, which is where it gets interesting.

## What went wrong

The auction and the presentation want opposite things from the reader, and we
did not fully appreciate that until both existed.

Everything above is an argument for slowing down. Full-bleed imagery, an
ordered sequence, one car at a time — the entire design says take your time,
look properly, decide when you are ready. An auction says the opposite, in the
strongest terms available: decide now, because somebody else is deciding now.
Putting a countdown inside a presentation built for contemplation is not a
layout problem, it is two products with different metabolisms sharing a page,
and every decision about where to put the current bid was really a decision
about which of those two we meant.

The mechanics were the harder half. Bidding is concurrent by definition, so the
usual questions arrived on schedule and were not optional: two bids landing in
the same instant, the current price staying consistent across every viewer
watching the same lot, and a bid that arrives while the page is mid-render. A
marketplace can tolerate a stale price for a second. An auction cannot, because
the stale number is the one somebody just bid against.

Timing was worse than the concurrency, because timing is where an auction meets
people. A countdown has to be accurate to the second across clients whose clocks
disagree. Last-second bids need the close to extend, or the auction rewards
whoever has the better connection rather than whoever wants the car. And every
extension has to reach the people who care about it, immediately — a
notification that arrives forty seconds late is not a slow notification, it is a
bidder who lost for a reason that had nothing to do with bidding.

The other cost was the one the design invited. Full-bleed photography at
showroom weight is heavy, and the presentation is the product, so the obvious
lever — send smaller images — is the one lever that damages the thing we were
selling. That tension does not resolve cleanly. It gets managed.

## Where it is now

Live, with listings on it and auctions running against real clocks.

The one-vehicle-at-a-time model survived contact with real inventory, which was
the open question — it is easy to defend a slow browsing model before anyone has
tried to sell forty cars through it. The image weight is still managed rather
than solved, and always will be: the presentation is the product, so every
compression decision is a decision about how good the car looks.
