// ===================== PANNEAUX MAISON DE LA SÉANCE (#231) =====================
// Le panneau LED du stade affichait 3 cellules « VOTRE PUB » purement
// décoratives, jamais câblées : ça ressemblait à un emplacement publicitaire
// cassé. On y met désormais notre PROPRE promo, personnalisée au joueur.
//
// ⚠️ Décision produit assumée : ce sont des messages MAISON, pas de la pub
// tierce. Le projet garantit « aucune pub pendant une partie » (README §
// Publicité) et une séance de tirs au but EST une partie — y brancher une régie
// (AdSense) supposerait de réviser explicitement cette garantie.
//
// Porte laissée ouverte : `pickHouseAds()` est un simple fournisseur de contenu
// (contexte -> N messages). Le jour où une vraie régie est décidée, l'UI garde
// le même point d'entrée et c'est ici qu'on délègue — sans toucher à la scène.
//
// Fonction PURE (aucun DOM, aucun réseau) : testable et déterministe.

/** Catalogue des messages maison, du plus ciblé au plus générique.
 *  Ton : panneau de stade, pas encart publicitaire — on chambre le joueur.
 *  Contrainte de forme : ~34 caractères max, une cellule fait un tiers du
 *  panneau et le texte doit rester lisible jusqu'en mobile. */
const HOUSE_ADS = Object.freeze([
  { id: 'signup', text: 'Compte gratuit. Excuses en option.', when: c => !c.signedIn },
  { id: 'progress', text: 'Pas de compte = pas de gloire', when: c => !c.signedIn },
  { id: 'puzzle', text: 'Puzzle du jour : neuf chaque matin', when: () => true },
  { id: 'shop', text: 'Nouveau maillot, même maladresse', when: () => true },
  { id: 'pass', text: 'Pass Saison : l’XP en heures sup', when: c => c.signedIn },
  { id: 'powers', text: 'Joueurs à pouvoirs : triche légale', when: () => true },
  { id: 'tactic', text: 'Le foot se joue aussi assis', when: () => true }
]);

/**
 * Choisit `count` messages maison adaptés au contexte joueur.
 * @param {{signedIn?: boolean}} context
 * @param {number} count  nombre de cellules du panneau (3 aujourd'hui)
 * @returns {string[]} textes, sans doublon, complétés si le contexte filtre trop.
 */
export function pickHouseAds(context = {}, count = 3) {
  const c = { signedIn: false, ...context };
  const eligible = HOUSE_ADS.filter(a => a.when(c));
  const picked = eligible.slice(0, count).map(a => a.text);
  // Filet : on ne laisse jamais une cellule vide (elle redeviendrait un « trou »).
  for (let i = 0; picked.length < count && i < HOUSE_ADS.length; i++) {
    if (!picked.includes(HOUSE_ADS[i].text)) picked.push(HOUSE_ADS[i].text);
  }
  return picked.slice(0, count);
}
