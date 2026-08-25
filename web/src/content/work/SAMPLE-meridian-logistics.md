---
kind: engagement
name: Meridian Logistics
client: Meridian Logistics
title: Trackers, dashboard, and one team for both
sector: Fleet telematics
year: 2025
summary: >-
  A regional haulier running 140 vehicles on paper dispatch. We designed the
  tracker hardware and the routing dashboard it reports into, so nobody had to
  integrate two vendors' guesses about each other.
services:
  - IoT & Embedded
  - Web Development
stack: [ESP32, LoRaWAN, MQTT, Next.js, PostgreSQL]
headline:
  value: 41%
  label: Faster dispatch
metrics:
  - value: '140'
    label: Vehicles instrumented
  - value: 11mo
    label: Hardware to rollout
  - value: '99.4%'
    label: Uplink reliability
order: 1
draft: true
---

## The problem

Meridian dispatched by phone. A controller called each driver, wrote the
position on a whiteboard, and rebuilt the picture every morning. Off-the-shelf
telematics quoted them per-vehicle monthly fees that scaled badly past a
hundred trucks, and none of it fit how their yard actually worked.

## What we built

A LoRaWAN tracker on custom hardware — GPS, an accelerometer for harsh-braking
events, and a five-day battery — reporting into a Next.js dashboard that shows
the fleet live and suggests reroutes when a job slips.

Because we designed both ends, the protocol is exactly as chatty as it needs to
be. That is the reason the battery lasts.

## What it returned

Dispatch time per job fell 41%. The controller's whiteboard is gone. Meridian
owns the firmware, the schematics, and the repo.
