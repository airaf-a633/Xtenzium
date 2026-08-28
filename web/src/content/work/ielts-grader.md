---
kind: product
name: IELTS Grader
links:
  site: https://ieltsgrader.com
  repo: https://github.com/pizn-01/IELTS_GRADER
title: A band score that shows its working
sector: Education
year: 2024
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
draft: false
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

Examiners disagreed with the engine, and the feature we were proudest of is the
reason they could.

A tool that returns a bare 6.5 is never argued with. Not because it is right —
because there is nothing in it to take hold of. An examiner reading a number
either accepts it or replaces it, and either way the disagreement goes
unrecorded and the tool never hears about it. Making the engine cite its
criterion removed that cover. Once the output says which descriptor it is
reasoning from and points at the evidence, an examiner can be precise: not that
criterion, or that criterion but not that sentence, or the right criterion and
the wrong band. Every one of those is a specific, answerable objection, and we
received a great many of them.

That part was uncomfortable and it was the system working. What we had not
planned for was the product question sitting behind it, which is not a
modelling problem at all: when a human and the engine disagree, who wins, and
what does the candidate see? Deferring silently to the examiner makes the
engine decorative. Keeping the machine score is indefensible. Showing both
without resolving them puts the disagreement in front of the one person least
equipped to arbitrate it.

None of those is a tuning issue, and we spent longer on it than on the grading.
What we would carry forward is that making a system explain itself does not
reduce disagreement — it converts vague distrust into specific challenges,
which is a large improvement and a much larger amount of work. Designing for
the disagreement should have begun when we decided the output would cite its
criterion, not when the objections started arriving.

## Where it is now

Live, with candidates submitting work and examiners reviewing what the engine
returns.

The disagreement problem from the section above is not solved so much as
housed: there is now a defined answer to who wins and what the candidate sees,
rather than three surfaces each improvising one. That is the difference between
a research demo and a product, and it is most of what the last stretch of work
went into.
