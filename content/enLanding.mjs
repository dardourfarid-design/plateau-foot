// ============ CONTENU DE LA LANDING ANGLAISE (#313) ============
// Source de vérité du texte anglais de public/en/index.html, qui est un fichier
// GÉNÉRÉ (voir tools/build-en.mjs) — ne pas éditer le HTML à la main.
//
// Pourquoi des DONNÉES et pas du HTML : la page anglaise avait dérivé trois
// fois (tag Plausible #322 ; manifest, lien blog, mention des modes #323).
// L'échafaudage structurel (métas, PWA, hreflang, Plausible) vit desormais dans
// le générateur, hors de portée d'un oubli. Et la FAQ ci-dessous alimente À LA
// FOIS les <details> visibles ET le JSON-LD FAQPage : plus de miroir à tenir à
// la main (c'est ce que le garde-fou seo-check vérifiait).

export const DOMAIN = 'https://tactic-master.vercel.app';

export const meta = {
  lang: 'en',
  path: '/en', // sans barre finale : cleanUrls redirige /en/ en 308 (#322)
  title: 'Tactic Master — Football board game online',
  description: 'A board as simple as checkers, a ball that moves like in football. Play solo, against the computer or online — 5-minute matches, free in your browser.',
  ogDescription: 'A board as simple as checkers, a ball that moves like in football. 5-minute matches, free in your browser.',
  twitterDescription: 'A board as simple as checkers, a ball that moves like in football.'
};

export const hero = {
  // <br> entre les deux mots du logo (rendu identique à l'accueil FR).
  titleTop: 'TACTIC',
  titleBottom: 'MASTER',
  sub: 'Football, sitting down too — a free tactical board game, as easy to learn as checkers.',
  ctaLabel: 'Play now — free, in English',
  ctaHref: '/?lang=en', // démarre l'app en anglais (src/ui/i18n.js)
  ctaSub: 'Runs in your browser, no download. 5-minute matches.'
};

export const about = {
  heading: 'What is Tactic Master?',
  // Le premier groupe est mis en gras (mot-clé principal) — géré par le gabarit.
  introLead: 'football board game',
  introBefore: 'Tactic Master is a free ',
  introAfter: ` you play right in
  the browser. It is as easy to pick up as checkers: each turn you move one piece
  one square, push the ball in a straight line, and score by sending it into the
  opponent's goal. No dice, no luck — like chess or checkers, everything comes
  down to positioning and anticipation. A match takes about five minutes.`
};

// Fiche factuelle (GEO) : énoncés courts, autonomes, chacun vrai isolément.
export const facts = [
  ['Board', '7 columns × 9 rows.'],
  ['Pieces', '6 per team: 1 goalkeeper, 2 defenders, 3 forwards.'],
  ['Players', '1 to 2 — solo vs the computer, two on one screen, or online.'],
  ['Game modes', 'full match, penalty shootout, and a daily puzzle.'],
  ['Match length', 'about 5 minutes.'],
  ['Luck', 'none: no dice, no cards, full information like chess.'],
  ['Price', 'free, no installation; optional cosmetic shop.']
];

export const rulesInShort = [
  'A 7×9 board; 6 pieces per team (1 goalkeeper, 2 defenders, 3 forwards).',
  'On your turn: move one piece one square, in any direction.',
  'A piece adjacent to the ball can push it in a straight line, up to the first obstacle.',
  'The goalkeeper only moves sideways, along the goal line.',
  "No captures: you win by scoring goals — and defence matters, as each piece covers its neighbouring squares and cuts opposing passing lanes."
];

// Une seule source pour la FAQ visible ET le JSON-LD FAQPage.
export const faq = [
  {
    q: 'Is Tactic Master free?',
    a: 'Yes. The game is free to play in your browser, nothing to install. An optional shop offers pitch themes and collectible player packs.'
  },
  {
    q: 'Can you play with two players?',
    a: 'Yes: face to face on the same device, or online by sharing a game code. A mode against the computer with three difficulty levels is also available.'
  },
  {
    q: 'How do you score a goal?',
    a: "By pushing the ball into the opponent's goal — the three central squares of the back line. The ball is pushed in a straight line by an adjacent piece and stops at the first obstacle."
  },
  {
    q: 'Can you install Tactic Master on mobile?',
    a: 'Yes. It is a web app (PWA): open the site in your browser then choose “Add to Home Screen” on iOS or Android. Local modes even work offline.'
  },
  {
    q: 'How is it different from checkers?',
    a: 'A turn is as simple as in checkers — one piece, one square — but you never capture an opposing piece. The goal is not to eliminate your opponent but to push the ball into their goal, and a goalkeeper restricted to sideways moves guards the goal line.'
  },
  {
    q: 'Is there any luck involved?',
    a: 'None. There are no dice, no cards and no draws: like chess or checkers, both players see the whole board and the result depends only on positioning and anticipation.'
  },
  {
    q: 'Do you need an account to play?',
    a: 'No, the game is playable without an account. An account is used for online multiplayer, the shop, managing your team and friends.'
  }
];

// Étapes du JSON-LD HowTo (#rules). Distinctes de rulesInShort : ce sont des
// consignes numérotées, pas la liste à puces éditoriale.
export const howToSteps = [
  { name: 'Move a piece', text: 'On your turn, move a single piece one single square, in any direction. Each team has 6 pieces: 1 goalkeeper, 2 defenders and 3 forwards, on a board of 7 columns by 9 rows.' },
  { name: 'Push the ball', text: 'A piece standing on a square adjacent to the ball can push it in a straight line. The ball slides until it meets the first obstacle: another piece or the edge of the pitch.' },
  { name: 'Score a goal', text: "Send the ball into the opponent's goal, that is the three central squares of their back line. The goalkeeper, who only moves sideways along the goal line, is the last line of defence." },
  { name: 'Defend by positioning', text: "There are no captures: you never take an opposing piece. Defending means placing your pieces to cover neighbouring squares and cut the opponent's pushing lanes." }
];

// Descriptions du nœud VideoGame (#game).
export const game = {
  description: "Tactical board game blending checkers and football: push the ball into the opponent's goal. Solo, vs AI or online. 5-minute matches.",
  keywords: 'football board game, free online football game, strategy game without luck, checkers alternative',
  about: "Tactical board game where you push a ball into the opponent's goal on a 7×9 board, with 6 pieces per side and no captures."
};
