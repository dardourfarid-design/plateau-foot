// Page /en/faq. Même construction que content/pages/faq.mjs : EN_FAQ_GROUPS est
// la source, le HTML visible et le JSON-LD FAQPage en dérivent tous les deux.
// Réponses vérifiées dans public/src/engine/ (2026-08-04).

export const EN_FAQ_GROUPS = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What is Tactic Master?',
        a: `A turn-based football board game you play free in your browser. Pieces
        move one square at a time like in checkers, and you push a ball into the
        opposing goal. A match lasts about five minutes.`
      },
      {
        q: 'Is the game really free?',
        a: `Yes. Every rule, game mode and difficulty level is available without
        paying. An optional shop sells pitch themes and collectible player packs:
        these are purely cosmetic and give no advantage in a match.`
      },
      {
        q: 'Do I need an account to play?',
        a: `No. Local modes — solo against the computer, two players on one
        device, daily puzzle, penalty shoot-out — start without signing up. An
        account is only needed for online multiplayer, the shop, squad management
        and friends.`
      },
      {
        q: 'Do I need to install anything?',
        a: `No. The game opens in your browser, on desktop and mobile alike. You
        can add it to your home screen on iOS and Android — it is a web app (PWA),
        not an app-store download.`
      },
      {
        q: 'Can I play offline?',
        a: `Yes for local modes, once the page has loaded or been installed as a
        PWA. Online multiplayer naturally requires a connection.`
      },
      {
        q: 'Is the game available in English?',
        a: `Yes. The interface is fully translated; this page and the
        <a href="/en/rules">full rules</a> are in English. Strategy articles are
        currently written in French only.`
      },
      {
        q: 'What age is it suitable for?',
        a: `The Discovery rule tier works from around seven or eight: move a
        piece, push the ball, score, with no interception rules at all. The
        Classic and Expert tiers add the tactical depth adults look for.`
      }
    ]
  },
  {
    title: 'Rules',
    items: [
      {
        q: 'How do I score?',
        a: `By bringing the ball to rest on any of the three central squares of
        the opponent's back row. There is no other condition — no minimum
        distance, no required number of passes.`
      },
      {
        q: 'Can I capture enemy pieces?',
        a: `Never. This is the fundamental difference from checkers. No piece
        leaves the pitch during the whole match: enemy pieces are worked around,
        not removed.`
      },
      {
        q: 'Can the ball travel through a piece?',
        a: `No. A pass stops at the first piece it meets, friendly or not. Two
        exceptions: the Power Shot, which goes through the first piece, and a shot
        fired from the penalty spot, which pierces one outfield defender but never
        a goalkeeper.`
      },
      {
        q: 'Do I have to push the ball as far as possible?',
        a: `No, and this is the most common beginner mistake. Every free square
        along the path is a valid destination — you choose where the ball stops. A
        one-square push is legal, and often better, because it keeps the ball
        under your control.`
      },
      {
        q: 'Can a piece already touching the ball push it without moving first?',
        a: `Yes. Select it, then click the destination square: the pass happens
        directly. A piece that reaches the ball after a move can also follow up
        with a pass in the same turn.`
      },
      {
        q: 'Can I move a piece onto the ball\'s square?',
        a: `No. The ball's square counts as occupied: you do not step on it and
        you never carry the ball. You move beside it in order to push it.`
      },
      {
        q: 'What is defensive cover?',
        a: `A square is covered by a team when one of its outfield pieces stands
        directly above, below, left or right of it. An opposing pass can neither
        stop on nor travel through a covered square. Cover is strictly orthogonal,
        so diagonals stay open.`
      },
      {
        q: 'Does the goalkeeper cover the squares around it?',
        a: `No, and that is deliberate. The keeper is the only piece that covers
        nothing. If it projected a cover zone, the goal would be impossible to
        breach. It defends by physically occupying one square of the goal.`
      },
      {
        q: 'Can the goalkeeper leave its goal?',
        a: `No. It slides sideways across the three squares of its goal line and
        never leaves the back row.`
      },
      {
        q: 'Is there an offside rule?',
        a: `No. No offside, no fouls, no cards, no corners, no throw-ins. The ball
        never leaves the pitch — it stops against the edge.`
      },
      {
        q: 'What happens after a goal?',
        a: `The ball returns to the centre and every piece goes back to its
        starting square. The team that conceded restarts play.`
      },
      {
        q: 'How many goals win a match?',
        a: `Three in the standard setup. Time-limited formats end after a fixed
        number of turns, and the score then decides the winner.`
      },
      {
        q: 'What happens if the scores are level?',
        a: `In a time-limited format, a level score at the end of the turns is a
        draw, settled by a penalty shoot-out — a separate arcade mode with aiming
        and a power gauge.`
      },
      {
        q: 'What if nobody touches the ball any more?',
        a: `After eight consecutive turns without a single pass — four per side —
        the ball is automatically returned to the centre for a neutral restart, if
        the centre square is free. The pieces are not moved.`
      },
      {
        q: 'What is the one-two?',
        a: `If the ball comes to rest orthogonally next to one of your outfield
        pieces at the end of your pass, your team immediately plays a bonus move.
        One move only, never a second pass, and it never stacks.`
      },
      {
        q: 'What is the penalty spot?',
        a: `The central square two rows from the opposing goal. A shot from there
        ignores cover and pierces one outfield defender, but never the goalkeeper.
        This rule is only active at the Expert tier.`
      }
    ]
  },
  {
    title: 'Modes and difficulty',
    items: [
      {
        q: 'Which game modes are available?',
        a: `Solo against the computer at three levels, two players on one device,
        online multiplayer via a game code, the daily puzzle and the penalty
        shoot-out.`
      },
      {
        q: 'How do the three computer levels differ?',
        a: `Easy plays largely at random and never pushes the ball more than two
        squares, so it does not punish a beginner's mistake. Medium takes any
        immediate scoring chance and favours moves that bring the ball closer to
        your goal. Hard additionally anticipates your best reply before choosing
        its move, and uses its powers.`
      },
      {
        q: 'What is the difference between Discovery, Classic and Expert?',
        a: `Discovery disables all interception: passes are only blocked by pieces
        themselves. Classic, the default, adds defensive cover and the one-two.
        Expert also enables crosses from the wings and the penalty spot, on an
        eight-piece formation.`
      },
      {
        q: 'Can I customise the rules?',
        a: `Yes. Advanced options let you switch cover, the one-two, crosses and
        the penalty spot on or off individually, on top of the chosen tier.`
      },
      {
        q: 'How do I play with a friend?',
        a: `On the same device, each player takes their turn on the same screen.
        Remotely, one player creates an online game and shares the code.`
      },
      {
        q: 'What is the daily puzzle?',
        a: `A preset position to solve within a given number of moves, the same
        for everyone on a given day. Puzzles use the Discovery tier, which keeps
        them unambiguous and guarantees a solution exists.`
      }
    ]
  },
  {
    title: 'Account, shop and support',
    items: [
      {
        q: 'What can I buy in the shop?',
        a: `Pitch themes and collectible player packs, strictly cosmetic. No
        purchase changes the rules or gives any in-match advantage.`
      },
      {
        q: 'How do I delete my account and my data?',
        a: `From your account, "Export my data" and "Delete my account" let you
        respectively obtain a copy of your data and erase everything. Details are
        in the <a href="/privacy">privacy policy</a>.`
      },
      {
        q: 'Does the game show ads?',
        a: `No advertising script is loaded until you have explicitly consented,
        and consent can be withdrawn at any time from "Manage my data
        preferences".`
      },
      {
        q: 'Which browsers are supported?',
        a: `Recent versions of Chrome, Firefox, Edge and Safari, on desktop and
        mobile. The game uses no plugins.`
      },
      {
        q: 'The page will not update, or something looks stuck.',
        a: `The game keeps a local copy of its files so it can work offline, which
        can delay a new version. Force-reload the page (Ctrl+F5, or Cmd+Shift+R on
        a Mac).`
      },
      {
        q: 'I found a bug, or I have a suggestion.',
        a: `Both are welcome — the <a href="/contact">contact page</a> explains how
        to report them, by email or directly on the project's public repository.`
      }
    ]
  }
];

const escapeHtml = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;');
const squash = s => escapeHtml(s).replace(/\s+/g, ' ').trim();

export const EN_FAQ = `
<p class="page-lead">The questions players ask most often about Tactic Master:
getting started, the rules and their edge cases, game modes, accounts and data.
For the exhaustive reference, see the <a href="/en/rules">full rules</a>.</p>
${EN_FAQ_GROUPS.map(g => `
<h2>${g.title}</h2>
${g.items.map(it => `
<h3>${squash(it.q)}</h3>
<p>${squash(it.a)}</p>`).join('')}`).join('\n')}

<h2>Still stuck?</h2>

<p>Write to us — the <a href="/contact">contact page</a> lists the two ways to
reach the team. Recurring questions eventually make it onto this page.</p>
`;
