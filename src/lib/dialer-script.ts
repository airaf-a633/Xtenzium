/* The built-in pitch — a fallback for when Dialer settings has none.

   The live copy is edited by an admin in Dialer settings (and is seeded
   from migration 023, which mirrors this). Placeholders are filled in
   on the call screen:
     {{who}}      "Dana at Acme" if the contact is known, else "a representative at Acme"
     {{company}}  the company name
     {{rep}}      the rep's first name */

export interface ScriptBlock {
  title: string;
  lines: string[];
}

export const SCRIPT: ScriptBlock[] = [
  {
    title: '1 · Open',
    lines: [
      '“Hi, how are you doing? Am I speaking with {{who}}?”',
      '(Pause. Let them answer.)',
      '“Great. I’ll be upfront with you — this is a cold call. I’m {{rep}}, and I have a business proposition for you and your team.”',
      '“If you can spare a couple of minutes, I’ll walk you through it. If it’s a bad time, just say so and I’ll let you get back to your day — no hard feelings. Fair enough?”',
    ],
  },
  {
    title: '2 · Are they the right person?',
    lines: [
      'If they say yes to a couple of minutes:',
      '“Thank you, I appreciate that. Quick question first — are you the person who makes decisions about bringing in outside design or development help for {{company}}, or is there someone else I should be speaking to?”',
      'Decision-maker → go to the hook.',
      'Someone else → “No problem — who would that be, and what’s the best way to reach them?” Log it as “Gatekeeper — got a name”.',
      'Shared decision → “That’s fine, I’ll keep it short and you can pass it on.”',
      'If they say no or it’s a bad time: “Understood, thanks for your time. Is there a better time to call?” → log a Callback. Otherwise end politely.',
    ],
  },
  {
    title: '3 · The hook',
    lines: [
      '“Here’s the proposition in one sentence: for what you’d pay to hire one person, you get an entire team.”',
      '“Most agencies hire one developer or one designer, and that one person has to cover everything. We flip that: for the same money you’d pay that single hire, you get designers, developers and QA working together on your projects.”',
      '“And you don’t have to manage any of them. You deal with one person — a project manager who gets you, learns how you work, and handles the rest. One point of contact, always.”',
      '(Then stop talking. Let them react.)',
    ],
  },
  {
    title: '4 · Questions that keep them talking',
    lines: [
      '“When you win a project that’s bigger than your bench, what do you do today?”',
      '“Do you ever turn work down, or delay it, because you’re short on design or development capacity?”',
      '“How are you covering development right now — in-house, freelancers, another agency?”',
      '“If you could add a full team without hiring, what would that change for you?”',
      '(Listen for the pain — capacity, hiring cost, unreliable freelancers, too many people to manage — and note it.)',
    ],
  },
  {
    title: '5 · The ask',
    lines: [
      'Match the ask to how warm they are.',
      'Warm: “Would it make sense to speak with our founder for 20 minutes? He can show you exactly how it works for an agency like yours.” → Meeting agreed, or Wants a call with us.',
      'Curious: “Can I send you a short overview — who we are and how the team model works — and follow up in a few days?” → Send info. Get the best email and spell it back.',
      'Wants numbers: “It depends on the size of team you need; the founder can give you a straight answer on a quick call.” → Wants proposal.',
      'Always confirm their name, best email, and for any meeting the day, time and time zone.',
    ],
  },
  {
    title: 'Objections',
    lines: [
      '“We have in-house developers.” → “That makes sense — most agencies we speak with do. This isn’t a replacement; it’s for the overflow and the skills you don’t keep on payroll. When you’re at capacity, what happens to the extra work?”',
      '“We already outsource.” → “Good — then you know how hard reliability is. What’s the biggest headache with how you do it now? With us, if one person is out the rest of the team keeps going, and you still talk to only one person.”',
      '“Just send me an email.” → “Happy to. So it’s useful and not just noise — what would you most like to see: the team model, pricing, or examples of work?” Then get the email and spell it back.',
      '“How much is it?” → “It depends on the team you need, but the principle is simple: roughly what you’d pay one person. The founder can put an exact number on it in a few minutes — worth a quick call?”',
      '“Who are you? What company is this?” → “Fair question — we’re Xtenzium, a design and development team that works as an extension of agencies. Happy to explain how if you have a couple of minutes.”',
      '“Not interested.” → “No problem at all. So I know whether to ever call back — is it timing, or do you already have this covered?” Log the reason and thank them.',
      '“Take me off your list.” → “Absolutely, I’ll remove you right now. Sorry for the interruption.” Log Do not call.',
    ],
  },
  {
    title: 'If it goes to voicemail',
    lines: [
      'Keep it under 20 seconds:',
      '“Hi {{who}}, it’s {{rep}}. This is a cold call, sorry for the interruption — I’ll be quick. We help agencies get an entire design and development team for what they’d normally pay one hire, with a single project manager as your only point of contact. If that’s interesting, I’ll try you again — or you can reply to the email I’ll send. Thanks, and have a good one.”',
      'Don’t pitch more than that. Log “Left voicemail”.',
    ],
  },
  {
    title: 'If they ask for proof',
    lines: [
      '“We’ve delivered over 65 projects, and the way we keep it simple is the one project manager. I’d rather show you than tell you — that’s what the founder’s call is for.”',
      '(Only say what you can back up. Add a specific example here once you have one.)',
    ],
  },
];
