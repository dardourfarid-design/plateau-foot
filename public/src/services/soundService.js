// ===================== SONS & VIBRATIONS (opt-in, #209) =====================
// Habillage sonore léger et retour haptique, STRICTEMENT opt-in (désactivé par
// défaut). Les sons sont SYNTHÉTISÉS via l'API Web Audio — aucun fichier audio
// à télécharger, rien à précacher, aucun blocage de rendu, compatible hors-ligne
// et avec la CSP stricte de l'app.
//
// L'AudioContext n'est créé qu'à l'activation (un geste utilisateur : cocher
// « Activés »), ce qui respecte les politiques d'autoplay des navigateurs.

let ctx = null;
let enabled = false;

export function isSoundEnabled() { return enabled; }

export function setSoundEnabled(on) {
  enabled = !!on;
  if (enabled) ensureCtx(); // prépare/réveille le contexte tant qu'on est dans un geste
}

function ensureCtx() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
  return ctx;
}

// Une brève note à enveloppe descendante (clic/bip discret).
function tone(freq, durMs, type = 'sine', gain = 0.05) {
  const c = ensureCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  } catch { /* audio indispo : silencieux */ }
}

const SOUNDS = {
  select: () => tone(430, 55, 'triangle', 0.035),
  pass: () => tone(620, 85, 'sine', 0.045),
  // Petit arpège ascendant pour le but.
  goal: () => { tone(523, 110, 'sine', 0.06); setTimeout(() => tone(784, 150, 'sine', 0.06), 100); setTimeout(() => tone(1047, 220, 'sine', 0.06), 240); },
  whistle: () => tone(1800, 180, 'square', 0.025),
  // #263 — coup invalide : deux notes graves brèves et descendantes (« bzz »),
  // ondes carrées douces, assez distinctes des sons positifs (select/pass/goal).
  error: () => { tone(200, 90, 'square', 0.03); setTimeout(() => tone(150, 120, 'square', 0.03), 70); }
};

export function playSound(name) {
  if (!enabled) return;
  (SOUNDS[name] || (() => {}))();
}

// Vibration mobile — uniquement si activée, supportée, et autorisée.
export function vibrate(pattern) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* non supporté */ }
}
