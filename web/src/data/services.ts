/**
 * Service lines.
 *
 * Structured data rather than a content collection: these pages are a fixed
 * shape, not prose, and keeping them typed means a missing section is a build
 * error instead of a blank space on a live page.
 *
 * Capability lists are carried over from the previous site — that copy came
 * from real engagements, so it is the most credible source available until
 * case studies are signed off.
 *
 * Anything a reader would take as a factual claim (prices, outcome numbers,
 * named clients) must go through `unverified()` until confirmed.
 */

export interface Engagement {
  name: string;
  shape: string;
  note: string;
}

export interface CapabilityGroup {
  group: string;
  items: string[];
}

export interface Service {
  slug: string;
  title: string;
  kicker: string;
  /** One sentence for cards and meta descriptions. */
  summary: string;
  /** The headline on the service page, split into lines. */
  heading: string[];
  /** What is actually going wrong for someone who lands here. */
  problem: string[];
  /** How the engagement runs. */
  approach: { n: string; title: string; body: string }[];
  /** Concrete artefacts the client ends up owning. */
  deliverables: string[];
  capabilities: CapabilityGroup[];
  engagements: Engagement[];
  /**
   * The next step, in this service's own terms.
   *
   * Every service page used to end with the same two buttons — book a
   * call, estimate a project. That asks an IoT prospect worrying about
   * certification and a marketing prospect worrying about attribution to
   * do the identical thing, which means it is tuned to neither. `lead` is
   * the primary ask and `note` is the sentence that removes the reason
   * not to take it.
   */
  cta: { lead: string; note: string };
  faqs: { q: string; a: string }[];
  order: number;
}

const FIXED: Engagement = {
  name: 'Fixed price',
  shape: 'One number, agreed up front',
  note: 'For work we can scope tightly. You get a written scope and a price before anything is built, and the price does not move unless the scope does.',
};

const MILESTONE: Engagement = {
  name: 'Phased',
  shape: 'Priced and approved per phase',
  note: 'For larger builds. Each phase is scoped, priced and signed off on its own, so you can stop or change direction at a known point rather than being locked into the whole thing.',
};

const RETAINER: Engagement = {
  name: 'Retainer',
  shape: 'Monthly capacity',
  note: 'For ongoing work after launch. A set amount of our time each month, and you decide what it goes on. No minimum term.',
};

export const services: Service[] = [
  {
    slug: 'development',
    title: 'Web Development',
    kicker: 'Scoped product build',
    summary:
      'React, Next.js and Astro applications that load fast, rank well, and hold up after launch. Built from scratch — no themes, no page builders.',
    heading: ['Software that still works', 'two years after launch.'],
    problem: [
      'Most agency builds are handed over as a black box. The code is someone else’s, the deploy is a mystery, and the first change you need costs more than it should.',
      'We build the opposite way. The stack is boring on purpose, the repo is yours from the first commit, and the documentation is written for whoever inherits it — including a developer who has never met us.',
    ],
    approach: [
      { n: '01', title: 'Scope in writing', body: 'We map what actually needs building before quoting. You leave with a written scope and a number, free either way.' },
      { n: '02', title: 'Design against real data', body: 'Interfaces are designed with your actual content and edge cases, not lorem ipsum. This is where most timelines quietly break.' },
      { n: '03', title: 'Two-week cycles', body: 'A working link at the end of every cycle. You watch it come together rather than waiting for a reveal.' },
      { n: '04', title: 'Handover, properly', body: 'Repo, credentials, infrastructure and docs in your name. Thirty days of support, and no obligation after that.' },
    ],
    deliverables: [
      'Source code in your GitHub organisation from day one',
      'Infrastructure and domains registered to you, not to us',
      'A written architecture decision record for anything non-obvious',
      'Automated deploys with a rollback you can trigger yourself',
      'Performance and accessibility budgets checked in CI',
      'Documentation written for your next developer',
    ],
    capabilities: [
      {
        group: 'Build',
        items: [
          'Web applications in React, Next.js and Astro',
          'Custom software for complex internal workflows',
          'eCommerce storefronts, checkout and inventory',
          'Mobile applications for iOS and Android',
          'API design and third-party integration',
        ],
      },
      {
        group: 'Quality',
        items: [
          'Automated, manual and performance testing',
          'Security auditing and dependency review',
          'Accessibility conformance work',
          'Core Web Vitals and search performance',
        ],
      },
      {
        group: 'Platforms',
        items: ['WordPress themes, plugins and WooCommerce', 'Shopify and Shopify Plus, including migrations'],
      },
    ],
    engagements: [FIXED, MILESTONE, RETAINER],
    cta: {
      lead: 'Send us the repo, or the idea',
      note:
        "If code already exists we will review it and tell you honestly whether extending it is cheaper than replacing it. If it does not, a paragraph about the problem is enough to start.",
    },
    faqs: [
      { q: 'Do you work with our existing codebase?', a: 'Often, yes. We will review it first and tell you honestly whether extending it is cheaper than replacing it. Sometimes the answer is that your current code is fine and you have a different problem.' },
      { q: 'What stack do you use?', a: 'React, Next.js or Astro on the front, Node and PostgreSQL behind it, usually deployed to Vercel. We pick boring, well-supported tools deliberately — you should be able to hire for your own stack.' },
      { q: 'Who owns the code?', a: 'You do, from the first commit. The repository lives in your organisation and we work inside it. Nothing is transferred at the end because nothing was ever ours.' },
      { q: 'What happens if we want to change something mid-build?', a: 'Bring it to the cycle review. Small changes are absorbed; anything that moves the scope gets re-quoted before we start it, so there are no surprise invoices.' },
    ],
    order: 1,
  },

  {
    slug: 'design',
    title: 'Design & Branding',
    kicker: 'Identity engagement',
    summary:
      'Interface design, design systems, and visual identity. The system ships with the work, so your team can extend it without us.',
    heading: ['An identity your team', 'can actually use.'],
    problem: [
      'A logo in a PDF is not a brand. Most identity work falls apart the first time someone internal needs to make a slide, a social post or a new page, because nobody wrote down how the system behaves.',
      'We deliver the rules alongside the artwork: tokens, components, and enough documentation that your team can extend it correctly without calling us.',
    ],
    approach: [
      { n: '01', title: 'Understand the position', body: 'Who you are selling to and what you need them to believe. Design decisions that skip this are just taste.' },
      { n: '02', title: 'Establish the system', body: 'Type, colour, spacing and motion as tokens — not as a mood board. Everything downstream inherits from these.' },
      { n: '03', title: 'Apply and pressure-test', body: 'We build the real screens and the awkward ones. A system that only works on the homepage is not a system.' },
      { n: '04', title: 'Document and hand over', body: 'Figma library, usage rules, and exported assets in every format you will actually need.' },
    ],
    deliverables: [
      'Logo suite across every lockup and colour mode',
      'Design tokens exported for code, not just Figma',
      'A component library your developers can build against',
      'Brand guidelines covering the cases people get wrong',
      'Editable source files, owned by you',
      'Asset exports at production sizes',
    ],
    capabilities: [
      {
        group: 'Identity',
        items: [
          'Logo design and full visual identity systems',
          'Brand guidelines and positioning',
          'Graphic design for marketing and digital collateral',
        ],
      },
      {
        group: 'Product',
        items: [
          'Web and application interface design',
          'Design systems and component libraries',
          'Prototyping and usability review',
        ],
      },
      {
        group: 'Content production',
        items: [
          'Photography and videography',
          'Motion graphics and animation',
          'Video editing, colour grading and sound',
        ],
      },
    ],
    engagements: [FIXED, MILESTONE],
    cta: {
      lead: 'Show us the product as it is today',
      note:
        "A link is plenty. You will get a straight read on what is costing you users, whether or not that turns into a project.",
    },
    faqs: [
      { q: 'Can you work with our existing brand?', a: 'Yes. Evolving an identity is usually cheaper and less disruptive than replacing it, and we will say so if that is the right call rather than selling you a rebrand.' },
      { q: 'Do we get the source files?', a: 'Always. Figma files, vector artwork and any production assets are yours, editable, with no ongoing licence.' },
      { q: 'Do you design without building?', a: 'Yes, and we hand over in a state another agency can build from. We would rather do both, but we do not hold designs hostage to win the build.' },
    ],
    order: 2,
  },

  {
    slug: 'iot',
    title: 'IoT & Embedded',
    kicker: 'Board-level engineering',
    summary:
      'Custom PCB design, firmware, connectivity and the cloud backend behind it — one team from the board to the dashboard.',
    heading: ['From the board', 'to the dashboard.'],
    problem: [
      'Connected products usually involve two vendors who each blame the other. The hardware firm ships a board with a protocol the software firm did not expect, and the integration becomes the project.',
      'We take the whole path: schematic, layout, firmware, connectivity, backend and the interface people actually look at. When one team owns both ends, the protocol between them gets designed rather than negotiated.',
    ],
    approach: [
      { n: '01', title: 'Define the constraints', body: 'Power budget, range, duty cycle, unit cost and certification target. These decide the architecture, and getting them wrong is expensive to undo.' },
      { n: '02', title: 'Prototype early', body: 'A rough board and rough firmware in the real environment, because bench conditions lie. We would rather find the problem on revision one.' },
      { n: '03', title: 'Build both ends together', body: 'Firmware and backend developed against each other, so the protocol is as small as it needs to be. That is usually what makes the battery last.' },
      { n: '04', title: 'Production and fleet', body: 'Design for manufacture, test fixtures, OTA update path and a dashboard for whoever operates the fleet.' },
    ],
    deliverables: [
      'Schematics and PCB layout files, in your name',
      'Firmware source with a documented build and flash process',
      'Bill of materials with sourcing notes and alternates',
      'Test procedures and any fixtures we build',
      'Backend, APIs and an operations dashboard',
      'An over-the-air update path that works in the field',
    ],
    capabilities: [
      {
        group: 'Hardware & electronics',
        items: ['Schematic design', 'PCB design and layout', 'Circuit design', 'Prototype development', 'Hardware testing and debugging'],
      },
      {
        group: 'Embedded systems',
        items: ['Embedded firmware development', 'RTOS', 'Microcontroller programming', 'Device driver development', 'Bootloader development'],
      },
      {
        group: 'Connectivity',
        items: ['Bluetooth and BLE', 'WiFi, Zigbee and LoRa', 'MQTT and CoAP', '4G and 5G IoT modules'],
      },
      {
        group: 'IoT cloud',
        items: ['AWS IoT', 'Azure IoT', 'IoT gateways', 'Data logging', 'OTA updates'],
      },
      {
        group: 'Applications',
        items: ['Industrial IoT', 'Smart building automation', 'Wireless sensor networks', 'IoT dashboards and monitoring'],
      },
      {
        group: 'Sectors',
        items: ['Medical IoT', 'Automotive embedded', 'Agricultural IoT', 'Smart energy'],
      },
    ],
    engagements: [MILESTONE, FIXED, RETAINER],
    cta: {
      lead: 'Tell us what the device has to do',
      note:
        "Bring the constraint that worries you most — battery life, range, certification, unit cost — and we will tell you early if it is the one that decides the design.",
    },
    faqs: [
      { q: 'Do you take hardware projects without the software?', a: 'We can, but the value we add is largest when we hold both ends. If you already have a software team we will work to their interface rather than imposing ours.' },
      { q: 'Why does hardware cost more than software?', a: 'Because iteration has a physical cost. Every board revision is a fabrication run and a lead time measured in weeks. We front-load design review to keep revisions down, but it is genuinely more work than a web build.' },
      { q: 'Can you handle certification?', a: 'We design towards your certification target and prepare the documentation, and we work with accredited labs for the testing itself. Tell us the target market early — it changes the design.' },
      { q: 'What about manufacturing?', a: 'We design for manufacture and can hand a complete package to your contract manufacturer, or work with one we have used before. We do not mark up fabrication.' },
    ],
    order: 3,
  },

  {
    slug: 'automation',
    title: 'AI & Automation',
    kicker: 'Workflow-led systems build',
    summary:
      'LLM integrations and internal tooling built around how your team already works, not around a demo.',
    heading: ['Automation that fits', 'how you already work.'],
    problem: [
      'Most AI projects fail at the same point: the demo is impressive, and then nobody uses it, because it was designed around the model rather than around anyone’s actual job.',
      'We start from the workflow. What is being done manually, how often, and what would have to be true for someone to trust a machine doing it. Sometimes the honest answer is that a script beats a model.',
    ],
    approach: [
      { n: '01', title: 'Map the real workflow', body: 'We sit with the people doing the work. The documented process and the actual process are rarely the same, and the difference is where automation breaks.' },
      { n: '02', title: 'Find the honest win', body: 'We look for the repetitive, high-volume, low-judgement steps. If the task needs judgement, we automate around it rather than through it.' },
      { n: '03', title: 'Build with a human in the loop', body: 'Anything consequential gets a review step until it has earned trust. Confidence is a feature, not a metric.' },
      { n: '04', title: 'Measure and hand over', body: 'Hours saved, error rates, and cost per run — reported honestly, including where it did not help.' },
    ],
    deliverables: [
      'A written map of the workflow before and after',
      'Working tooling deployed into your environment',
      'Evaluation harness so you can measure quality over time',
      'Cost and usage monitoring per workflow',
      'Fallback behaviour for when the model is wrong or unavailable',
      'Training for the team who will operate it',
    ],
    capabilities: [
      {
        group: 'AI integration',
        items: [
          'LLM integration into existing products and workflows',
          'Retrieval over your own documents and data',
          'Evaluation harnesses and quality monitoring',
          'Prompt and cost optimisation',
        ],
      },
      {
        group: 'Automation',
        items: [
          'Internal tooling and admin interfaces',
          'Workflow and process automation',
          'Data pipelines and reporting',
          'System-to-system integration',
        ],
      },
      {
        group: 'Advisory',
        items: ['AI strategy and feasibility review', 'Build-versus-buy assessment', 'Data readiness review'],
      },
    ],
    engagements: [FIXED, MILESTONE, RETAINER],
    cta: {
      lead: 'Describe the process you keep doing by hand',
      note:
        "The useful first conversation is about the workflow, not the model. Sometimes the answer is a script rather than an LLM, and we will say so.",
    },
    faqs: [
      { q: 'Will our data be used to train a model?', a: 'No. We use providers and configurations where your data is not retained for training, and we will document exactly where your data goes as part of the engagement.' },
      { q: 'What if AI is the wrong answer?', a: 'We will say so. A rules engine or a well-written script is often cheaper, faster and more reliable, and telling you that costs us a bigger invoice.' },
      { q: 'How do you handle the model getting it wrong?', a: 'Every consequential action has a review step or a fallback until the numbers justify removing it. We would rather ship something narrower that people trust.' },
    ],
    order: 4,
  },

  {
    slug: 'consultancy',
    title: 'Technical Consultancy',
    kicker: 'Advisory engagement',
    summary:
      'Architecture reviews, stack decisions, compliance and roadmaps — so you avoid the expensive mistake before you make it.',
    heading: ['A second opinion', 'before you commit.'],
    problem: [
      'The costliest decisions on a technical project are made in the first fortnight, usually by people who will not be maintaining the result.',
      'We do short, sharp advisory work: review what is proposed, say plainly what will hurt in eighteen months, and write it down so you can act on it with or without us.',
    ],
    approach: [
      { n: '01', title: 'Understand the business first', body: 'Technical advice given without commercial context is guesswork. We start with what the business needs to be true.' },
      { n: '02', title: 'Review what exists', body: 'Architecture, code, infrastructure, vendor contracts and team structure. Usually the constraint is not the one you were told about.' },
      { n: '03', title: 'Write it down', body: 'A document with findings ranked by cost of inaction — not a slide deck, and specific enough to act on.' },
      { n: '04', title: 'Stay available', body: 'A short window afterwards for the questions that surface once your team starts implementing.' },
    ],
    deliverables: [
      'A written review ranked by cost of inaction',
      'Architecture recommendations with trade-offs stated',
      'A roadmap your team can execute without us',
      'Vendor and build-versus-buy assessment',
      'Compliance gap analysis where relevant',
      'A follow-up window for implementation questions',
    ],
    capabilities: [
      {
        group: 'Technical advisory',
        items: [
          'Architecture and code review',
          'Digital transformation and legacy migration planning',
          'AI strategy and feasibility',
          'Product strategy and lifecycle',
        ],
      },
      {
        group: 'Infrastructure',
        items: ['Managed IT and infrastructure planning', 'Cloud migration and architecture on AWS, Azure and GCP', 'SaaS and PaaS platform design'],
      },
      {
        group: 'Security & compliance',
        items: [
          'Cyber security review and penetration testing',
          'Data protection and GDPR frameworks',
          'ISO certification support',
          'PCI DSS compliance',
        ],
      },
      {
        group: 'Research',
        items: ['Market research and competitive analysis', 'Technical due diligence'],
      },
    ],
    engagements: [FIXED, RETAINER],
    cta: {
      lead: 'Bring the decision you are stuck on',
      note:
        "A stack choice, an architecture you have doubts about, a build-or-buy call. One session is often enough, and we will tell you if it is.",
    },
    faqs: [
      { q: 'Will you recommend yourselves for the build?', a: 'Only if we are genuinely the right team, and we will say when we are not. The review is written so another agency can execute it, because advice you cannot act on independently is not advice.' },
      { q: 'How long does a review take?', a: 'Most take two to three weeks depending on how much there is to read. We will tell you the shape after a first conversation.' },
      { q: 'Can you do technical due diligence for an acquisition?', a: 'Yes. Code, architecture, team, security posture and the risks that do not appear on a balance sheet.' },
    ],
    order: 5,
  },

  {
    slug: 'marketing',
    title: 'Marketing',
    kicker: 'Growth engagement',
    summary:
      'SEO and content, paid media, social, and the analytics to tell which of them is actually working.',
    heading: ['Growth you can', 'attribute to something.'],
    problem: [
      'Most marketing spend is unattributable. Traffic goes up, someone claims credit, and nobody can say which channel produced revenue or what it cost to get it.',
      'We build the measurement before the campaigns, so every channel has to justify itself against the same number. Sometimes that means telling you to stop spending on something.',
    ],
    approach: [
      { n: '01', title: 'Fix the measurement', body: 'Tracking, events and attribution first. Optimising against numbers you do not trust is worse than not optimising.' },
      { n: '02', title: 'Find where demand already is', body: 'Search intent, competitor gaps and the questions your sales calls keep answering. Cheaper than manufacturing demand.' },
      { n: '03', title: 'Run and measure', body: 'Content and campaigns against a stated hypothesis, reviewed monthly against cost per qualified lead.' },
      { n: '04', title: 'Cut what does not work', body: 'Reported honestly, including our own recommendations that failed.' },
    ],
    deliverables: [
      'Analytics and conversion tracking you own',
      'A keyword and content plan tied to real search demand',
      'Campaign builds in your own ad accounts',
      'Monthly reporting against cost per qualified lead',
      'Content assets, written and designed',
      'A documented playbook your team can run',
    ],
    capabilities: [
      {
        group: 'Search & content',
        items: ['Technical and on-page SEO', 'Content strategy and production', 'Blog, whitepaper and email content', 'Organic authority building'],
      },
      {
        group: 'Paid media',
        items: ['Google Ads', 'Paid social across Meta and LinkedIn', 'Programmatic and display', 'Campaign optimisation against ROAS'],
      },
      {
        group: 'Social & brand',
        items: ['Social media management and community', 'Social media optimisation', 'Influencer partnerships', 'PR and reputation'],
      },
      {
        group: 'Analytics',
        items: ['Analytics implementation and dashboards', 'Conversion rate optimisation', 'KPI and ROI reporting', 'Marketing strategy and channel planning'],
      },
    ],
    engagements: [RETAINER, FIXED, MILESTONE],
    cta: {
      lead: 'Tell us what you are already measuring',
      note:
        "If the answer is nothing, that is the first finding. We would rather fix attribution before spending anything on traffic.",
    },
    faqs: [
      { q: 'Do we own the ad accounts?', a: 'Yes. Campaigns are built in your accounts under your billing. If you stop working with us, nothing goes with us.' },
      { q: 'How long before we see results?', a: 'Paid can produce signal in weeks. Organic search realistically takes six months or more, and anyone promising faster is either buying links or misreading their own data.' },
      { q: 'Will you tell us to spend less?', a: 'When the numbers say so, yes. A channel that does not pay for itself is not worth managing, and we would rather keep the relationship than the line item.' },
    ],
    order: 6,
  },

  {
    slug: 'support',
    title: 'Support & Growth',
    kicker: 'Ongoing retainer',
    summary:
      'Maintenance, performance work and iteration once the build ships. Optional, never bundled in to inflate a quote.',
    heading: ['What happens after', 'everyone else leaves.'],
    problem: [
      'Software decays. Dependencies age out, browsers change, traffic patterns shift, and the person who understood the deploy has moved on.',
      'We keep things running and keep them moving — but as a choice you make after launch, not a clause buried in the build contract.',
    ],
    approach: [
      { n: '01', title: 'Inherit properly', body: 'A documented handover, access audit and a written picture of what is fragile. We do this even for systems we did not build.' },
      { n: '02', title: 'Keep it healthy', body: 'Dependency updates, security patches, monitoring and backups verified by actually restoring them.' },
      { n: '03', title: 'Improve what matters', body: 'Your monthly capacity spent on whatever you decide — performance, features, or paying down what is slowing your team.' },
      { n: '04', title: 'Report plainly', body: 'What we did, what it cost, what we would do next. Cancel whenever it stops being worth it.' },
    ],
    deliverables: [
      'Monitoring and alerting configured to your thresholds',
      'Verified backups with a tested restore procedure',
      'A documented incident and escalation path',
      'Dependency and security patching on a schedule',
      'A monthly written report you can actually read',
      'No minimum term and no exit fee',
    ],
    capabilities: [
      {
        group: 'Keep it running',
        items: ['Proactive monitoring and alerting', 'Security patching and dependency updates', 'Backup and disaster recovery', 'Incident response'],
      },
      {
        group: 'Keep it fast',
        items: ['Performance profiling and optimisation', 'Core Web Vitals work', 'Infrastructure and cost review'],
      },
      {
        group: 'Keep it moving',
        items: ['Feature development against monthly capacity', 'Technical debt reduction', 'Extra engineering capacity alongside your team'],
      },
    ],
    engagements: [RETAINER, FIXED],
    cta: {
      lead: 'Tell us what breaks, and how often',
      note:
        "Support is priced on what a system actually needs, so the honest version of this conversation starts with what is going wrong now.",
    },
    faqs: [
      { q: 'Do you support software you did not build?', a: 'Yes. We start with a review and an honest assessment of what it will cost to hold it steady — occasionally that assessment is that it needs replacing.' },
      { q: 'Is a retainer mandatory after a build?', a: 'No, and we will not quote as though it is. Plenty of clients take the handover and run it themselves, which is the point of documenting it properly.' },
      { q: 'What are your response times?', a: 'Agreed per retainer against what the system actually justifies. We would rather commit to something we can hold than publish a number that sounds impressive.' },
    ],
    order: 7,
  },
];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
