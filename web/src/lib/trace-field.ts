import gsap from 'gsap';

/**
 * The hero's thesis: circuit traces routing themselves across the page.
 *
 * Xtenzium's differentiator is that it ships the software *and* the board
 * underneath it. So the hero isn't a gradient or a particle field — it's
 * PCB routing, drawn to real rules: segments run orthogonal or at 45°,
 * never at arbitrary angles, and every run terminates in a via.
 *
 * Canvas 2D on purpose. This is ~4KB and costs nothing; a WebGL scene
 * would undo the reason we moved to Astro in the first place.
 *
 * Cost control:
 *  - Completed traces are baked into an offscreen canvas once, so the
 *    per-frame work is a single blit plus a handful of pulses.
 *  - Rendering is driven by gsap.ticker — the loop the page already runs,
 *    not a second rAF.
 *  - Stops entirely when the hero scrolls away or the tab is hidden.
 */

type Pt = { x: number; y: number };

interface Trace {
  pts: Pt[];
  lens: number[];
  total: number;
  progress: number;
}

interface Pulse {
  trace: Trace;
  dist: number;
  speed: number;
}

const GRID = 28;
const COPPER = '194, 98, 27';
const TRACE_ALPHA = 0.34;
const REDUCED = '(prefers-reduced-motion: reduce)';

export function initTraceField(canvas: HTMLCanvasElement) {
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) return () => {};
  // Bind to an explicitly non-null const — control-flow narrowing does not
  // survive into the nested render functions below.
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let traces: Trace[] = [];
  let pulses: Pulse[] = [];
  let baked: HTMLCanvasElement | null = null;
  let drawing = true;
  let running = false;
  let visible = true;
  let tl: gsap.core.Timeline | null = null;

  const reduced = window.matchMedia(REDUCED).matches;

  // ── Routing ────────────────────────────────────────────────────────
  // Directions are the eight a PCB autorouter is allowed to use.
  const DIRS: Pt[] = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  function buildTrace(cols: number, rows: number): Trace {
    let cx = Math.floor(Math.random() * cols);
    let cy = Math.floor(Math.random() * rows);
    let dir = DIRS[Math.floor(Math.random() * DIRS.length)];

    const pts: Pt[] = [{ x: cx * GRID, y: cy * GRID }];
    const legs = 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < legs; i++) {
      const run = 2 + Math.floor(Math.random() * 5);
      cx = Math.max(0, Math.min(cols, cx + dir.x * run));
      cy = Math.max(0, Math.min(rows, cy + dir.y * run));
      pts.push({ x: cx * GRID, y: cy * GRID });

      // Turn by 45° or 90°, never reverse — reversing looks like a mistake.
      const next = DIRS.filter(
        (d) => !(d.x === -dir.x && d.y === -dir.y) && !(d.x === dir.x && d.y === dir.y),
      );
      dir = next[Math.floor(Math.random() * next.length)];
    }

    const lens: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(d);
      total += d;
    }
    return { pts, lens, total, progress: 0 };
  }

  // ── Geometry helpers ───────────────────────────────────────────────
  function pointAt(t: Trace, dist: number): Pt {
    let acc = 0;
    for (let i = 0; i < t.lens.length; i++) {
      if (acc + t.lens[i] >= dist) {
        const f = t.lens[i] === 0 ? 0 : (dist - acc) / t.lens[i];
        const a = t.pts[i];
        const b = t.pts[i + 1];
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
      acc += t.lens[i];
    }
    return t.pts[t.pts.length - 1];
  }

  function strokeTrace(c: CanvasRenderingContext2D, t: Trace, upTo: number) {
    if (upTo <= 0) return;
    c.beginPath();
    c.moveTo(t.pts[0].x, t.pts[0].y);
    let acc = 0;
    for (let i = 0; i < t.lens.length; i++) {
      if (acc + t.lens[i] <= upTo) {
        c.lineTo(t.pts[i + 1].x, t.pts[i + 1].y);
        acc += t.lens[i];
      } else {
        const p = pointAt(t, upTo);
        c.lineTo(p.x, p.y);
        break;
      }
    }
    c.stroke();
  }

  function via(c: CanvasRenderingContext2D, p: Pt, alpha: number) {
    c.beginPath();
    c.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    c.fillStyle = `rgba(${COPPER}, ${alpha})`;
    c.fill();
    // Drill hole — what makes it read as a via rather than a dot.
    c.beginPath();
    c.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    c.fillStyle = '#0A0908';
    c.fill();
  }

  // ── Bake ───────────────────────────────────────────────────────────
  function bake() {
    baked = document.createElement('canvas');
    baked.width = canvas.width;
    baked.height = canvas.height;
    const b = baked.getContext('2d');
    if (!b) return;
    b.scale(dpr, dpr);
    b.lineWidth = 1.25;
    b.lineJoin = 'round';
    b.lineCap = 'round';
    b.strokeStyle = `rgba(${COPPER}, ${TRACE_ALPHA})`;
    traces.forEach((t) => {
      strokeTrace(b, t, t.total);
      via(b, t.pts[0], 0.75);
      via(b, t.pts[t.pts.length - 1], 0.75);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    if (drawing) {
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${COPPER}, ${TRACE_ALPHA})`;
      traces.forEach((t) => {
        const upTo = t.total * t.progress;
        strokeTrace(ctx, t, upTo);
        if (t.progress > 0) via(ctx, t.pts[0], 0.75 * t.progress);
        if (t.progress >= 1) via(ctx, t.pts[t.pts.length - 1], 0.75);
        else if (t.progress > 0) {
          // Leading edge — the router head, brighter than the trace.
          const p = pointAt(t, upTo);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${COPPER}, 0.9)`;
          ctx.fill();
        }
      });
      return;
    }

    if (baked) ctx.drawImage(baked, 0, 0, w, h);

    // Signal pulses travelling the finished routes.
    pulses.forEach((p) => {
      p.dist += p.speed;
      if (p.dist > p.trace.total) {
        p.trace = traces[Math.floor(Math.random() * traces.length)];
        p.dist = 0;
        p.speed = 1.1 + Math.random() * 1.5;
      }
      const head = pointAt(p.trace, p.dist);
      const tail = pointAt(p.trace, Math.max(0, p.dist - 34));
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, `rgba(${COPPER}, 0)`);
      grad.addColorStop(1, `rgba(${COPPER}, 0.85)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COPPER}, 0.95)`;
      ctx.fill();
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  function build() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const cols = Math.ceil(w / GRID);
    const rows = Math.ceil(h / GRID);
    const count = Math.max(10, Math.min(26, Math.round((cols * rows) / 78)));

    traces = Array.from({ length: count }, () => buildTrace(cols, rows));

    tl?.kill();
    pulses = [];

    if (reduced) {
      // No routing animation — draw the finished board and stop.
      traces.forEach((t) => (t.progress = 1));
      drawing = false;
      bake();
      render();
      return;
    }

    drawing = true;
    traces.forEach((t) => (t.progress = 0));

    tl = gsap.timeline({
      onComplete: () => {
        drawing = false;
        bake();
        pulses = Array.from({ length: 3 }, () => ({
          trace: traces[Math.floor(Math.random() * traces.length)],
          dist: Math.random() * 200,
          speed: 1.1 + Math.random() * 1.5,
        }));
      },
    });
    tl.to(traces, {
      progress: 1,
      duration: 1.1,
      stagger: { each: 0.055, from: 'random' },
      ease: 'power2.inOut',
    });
  }

  function tick() {
    if (!visible) return;
    render();
  }

  function startLoop() {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  }

  function stopLoop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  }

  build();
  startLoop();

  // Stop the loop when the hero is off-screen or the tab is backgrounded.
  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) startLoop();
      else stopLoop();
    },
    { rootMargin: '80px' },
  );
  io.observe(canvas);

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else if (visible) startLoop();
  };
  document.addEventListener('visibilitychange', onVisibility);

  let resizeTimer: number;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 220);
  };
  window.addEventListener('resize', onResize);

  return () => {
    stopLoop();
    tl?.kill();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    window.clearTimeout(resizeTimer);
  };
}
