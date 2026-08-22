import { motion, useReducedMotion, type Variants } from 'motion/react';

/**
 * Recipe 03 — the hero.
 *
 * The one place Motion earns its weight over GSAP: this is a load-time
 * orchestration, not a scroll effect. Each headline line sits inside an
 * `overflow-hidden` mask with an inner motion span, so the text wipes up
 * from behind an edge rather than fading in place.
 *
 * `pb-2 -mb-2` on the mask is not decoration — it gives descenders (g, y, p)
 * room inside the clip without shifting layout. Drop it and the headline
 * gets its tails sliced off.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const lineVariants: Variants = {
  hidden: { y: '110%' },
  visible: (i: number) => ({
    y: '0%',
    transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE },
  }),
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: EASE },
  }),
};

const HEADLINE = ['We architect', 'long-term', 'success.'];

export default function Hero() {
  const reduced = useReducedMotion();

  return (
    <div className="relative z-10 max-w-3xl">
      <motion.p
        className="eyebrow"
        variants={fadeUp}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        custom={0.05}
      >
        Karachi, Pakistan — Software &amp; Hardware
      </motion.p>

      <h1 className="mt-4 font-display text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.0] tracking-[-0.035em] text-ink">
        {HEADLINE.map((line, i) => (
          <span key={line} className="block overflow-hidden pb-2 -mb-2">
            <motion.span
              className="block"
              variants={lineVariants}
              initial={reduced ? 'visible' : 'hidden'}
              animate="visible"
              custom={i}
            >
              {i === 1 ? <span className="text-copper">{line}</span> : line}
            </motion.span>
          </span>
        ))}
      </h1>

      <motion.p
        className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2"
        variants={fadeUp}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        custom={0.55}
      >
        A digital agency building web products and the custom hardware
        underneath them. Sixty-five projects delivered for teams across four
        continents.
      </motion.p>

      <motion.div
        className="mt-9 flex flex-col items-start gap-3 sm:flex-row"
        variants={fadeUp}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        custom={0.85}
      >
        <a
          href="/contact"
          className="inline-flex w-full items-center justify-center rounded-pill bg-copper px-7 py-3.5 text-sm font-bold text-white transition-colors duration-300 hover:bg-copper-hi sm:w-auto"
        >
          Start a project
        </a>
        <a
          href="/work"
          className="inline-flex w-full items-center justify-center rounded-pill border border-line-strong bg-surface px-7 py-3.5 text-sm font-bold text-ink transition-colors duration-300 hover:bg-bg-tint sm:w-auto"
        >
          See our work
        </a>
      </motion.div>
    </div>
  );
}
