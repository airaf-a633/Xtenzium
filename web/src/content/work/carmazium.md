---
kind: product
name: Carmazium
links:
  site: https://www.carmazium.com
  # TODO(airaf): public repo exists; paste its URL to show a source link.
  # repo: https://github.com/...
title: One car at a time, at showroom scale
sector: Automotive
# TODO(airaf): confirm the year.
year: 2025
summary: >-
  A cinematic-first automotive marketplace. A listing gets the weight it would
  have on a showroom floor — full-bleed imagery and scroll-driven sequencing —
  and the browsing model is built around one vehicle at a time rather than a
  grid of results.
services:
  - Web Development
  - Design & Branding
stack: [Next.js, TypeScript, Tailwind CSS, Framer Motion, Docker]
headline:
  value: '1'
  label: Vehicle on screen at a time
  basis: observed
order: 3
# TODO(airaf): sections 03 and 04 are unwritten.
draft: true
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

## What went wrong

<!-- TODO(airaf): required. The obvious pressure points on this decision:
image weight and LCP on a full-bleed presentation, and whether sellers with
large inventories rejected the one-at-a-time model outright. What actually
bit? -->

## Where it is now

<!-- TODO(airaf): listings live, sellers on it, and whether the browsing model
survived contact with real inventory. There is also a React Native app in
this repo family — say how the two relate if they ship together. -->
