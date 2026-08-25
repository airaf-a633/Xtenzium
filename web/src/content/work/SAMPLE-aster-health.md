---
kind: engagement
name: Aster Health
client: Aster Health
title: A patient portal that stopped timing out
sector: Clinical SaaS
year: 2025
summary: >-
  A clinic group whose portal took 3.2 seconds to show a login box. We rebuilt
  it on Next.js with an audited migration, no downtime, and no change to the
  clinical workflows staff already knew.
services:
  - Web Development
  - Technical Consultancy
stack: [Next.js, TypeScript, PostgreSQL, Vercel]
headline:
  value: 3.2s → 0.8s
  label: Time to interactive
metrics:
  - value: '0'
    label: Hours of downtime
  - value: 62%
    label: Fewer support tickets
  - value: 4mo
    label: Scope to launch
order: 2
draft: true
---

## The problem

Aster's portal worked, slowly. Every page rebuilt the full patient record
server-side on each request, and staff had learned to open three tabs and wait.
The previous vendor had quoted a full rewrite and an eighteen-month timeline.

## What we built

Not a rewrite. We profiled it, found that four queries accounted for most of the
wait, and moved the record view to incremental rendering with a proper cache
layer. The parts that were fine, we left alone.

## What it returned

Time to interactive went from 3.2s to 0.8s. Support tickets about the portal
dropped 62% in the first quarter. Total cost was a fraction of the rewrite
quote — which we told them before they signed.
