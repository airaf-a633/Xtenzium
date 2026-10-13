/* Starter pitch for the call screen.

   Hard-coded for now so the rep has something on screen from day one.
   It moves into an admin-editable Settings table with the rest of the
   dialer content, at which point this file goes away. */

export interface ScriptBlock {
  title: string;
  lines: string[];
}

export const SCRIPT: ScriptBlock[] = [
  {
    title: 'Opener',
    lines: [
      '“Hi, is this {{contact or the owner}}? This is {{your name}} from Xtenzium — I’ll be quick, did I catch you at a bad time?”',
      '“We’re a development and design team that works as an extension of agencies like yours — I wanted to see if it’s relevant before I take any more of your time.”',
    ],
  },
  {
    title: 'The pitch',
    lines: [
      'We plug into your agency as your own build team — design, web, mobile, even hardware/IoT — so you can say yes to projects without hiring.',
      'Instead of paying for one developer, you get a whole team (design, front-end, back-end, QA) for roughly the same monthly cost.',
      'You keep the client relationship and the margin; we work under your brand.',
      'Ask: “When you win a project bigger than your bench, what do you do today?”',
    ],
  },
  {
    title: 'Close for the meeting',
    lines: [
      '“Our founder, Airaf, can walk you through how it works and show a couple of agency builds. Do you have 20 minutes this week?”',
      'Get a day, a time and the zone, plus the best email for the invite. Log it as “Meeting agreed”.',
    ],
  },
  {
    title: 'Objections',
    lines: [
      '“We have in-house devs” → “Makes sense — most of our agencies do. We cover the overflow and the skills you don’t keep on payroll. When do you hit capacity?”',
      '“We already outsource” → “Good, then you know the pain of reliability. We’re a team, not a freelancer — if someone’s out, the work doesn’t stop. Worth a comparison?”',
      '“Send me an email” → “Happy to. What’s the best address, and what should I focus it on — web, app, or design?”',
      '“Not now / no budget” → “Understood. Can I check back in a couple of months? Who should I ask for?”',
    ],
  },
];
