---
kind: product
name: IELTS Grader
links:
  site: https://ieltsgrader.com
  # TODO(airaf): public repo exists; paste its URL to show a source link.
  # repo: https://github.com/...
title: A band score that shows its working
sector: Education
# TODO(airaf): confirm the year.
year: 2025
summary: >-
  An AI-assisted assessment engine for IELTS writing tasks. A marketing site, a
  candidate app and an examiner dashboard sit over one Python grading service,
  and every score is returned against the published band descriptors rather
  than as a number the candidate has to take on trust.
services:
  - AI & Automation
  - Web Development
stack: [React, Node.js, Python, Supabase, PostgreSQL, Docker]
headline:
  value: '3'
  label: Surfaces over one grading service
  basis: observed
metrics:
  - value: '1'
    label: Grading implementation, not three
    basis: observed
order: 2
# TODO(airaf): sections 03 and 04 are unwritten.
draft: true
---

## The problem

A candidate who gets a 6.5 wants to know why it was not a 7. That is the whole
product. An assessment tool that returns a number and stops has told them the
one thing they already suspected and none of the things they could act on, and
the number is worth less than nothing without the reason, because it invites
them to guess — usually that they need "better vocabulary", usually wrong.

The second problem is that three different people need the same judgement and
need it presented completely differently. A candidate needs to know what to fix.
An examiner needs to see whether the machine's reasoning holds before signing
their name under it. A visitor deciding whether to pay needs to believe the
thing works at all.

## What we decided, and why

Scoring runs against the public band descriptors, and the feedback cites the
criterion it came from.

This sounds like a presentation choice and is really an architectural one. Once
the output has to name which descriptor it is arguing from, the grading service
can no longer return a bare number with a paragraph of generated encouragement
attached — the shape of the response has to carry its own justification. That
constrains the model's job into something checkable: not "what band is this"
but "against this criterion, what does the descriptor say, and where in the
text is the evidence". An examiner can disagree with a specific claim. Nobody
can disagree with a 6.5.

The three surfaces are three front ends over one Python service, not three
products that each grade a little. That matters more than the deduplication:
it means the score an examiner reviews is byte-for-byte the score the candidate
was shown. If the marketing site demonstrated grading with its own lighter
implementation, the demo would eventually drift from the product and the first
person to notice would be a paying candidate.

React and Node for the surfaces, Python for the grading service, Supabase and
Postgres underneath, containerised with Docker.

## What went wrong

<!-- TODO(airaf): required section, and only you know it.

Likely candidates given the above: a model revision that moved scores under
people mid-cohort, disagreement between the engine and a human examiner that
took real work to reconcile, or the cost curve of running grading at volume.
Whatever it actually was, it goes here — /work promises this section. -->

## Where it is now

<!-- TODO(airaf): who is using it, at what volume, and what it does in
production that it could not do at launch. Any number a candidate or
institution has agreed to goes in `metrics` above with basis: measured. -->
