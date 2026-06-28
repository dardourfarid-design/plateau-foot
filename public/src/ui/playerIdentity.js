// ===================== IDENTITÉ DES PIONS (joueurs fictifs) =====================
// Fait le pont entre les tokenId génériques du moteur de jeu (b-gk, b-def0,
// r-att2, etc.) et l'identité d'un joueur fictif aligné par un compte
// (nom, custom_name, style). Le moteur de jeu ne connaît jamais cette
// couche — il continue à raisonner uniquement sur b-gk/b-def0/etc., ce qui
// garde gameEngine.js totalement indépendant du système de collection.
//
// Une "lineup résolue" est un objet simple { def0: {name, style}, att1: {...}, ... }
// construit une fois par partie (pas par coup), à partir de team_lineups +
// player_ownership + fictional_players déjà joints côté service.

/**
 * Construit une lineup résolue (nom à afficher + style) à partir des
 * lignes renvoyées par fetchMyLineup() + fetchMyCollection().
 * Retourne null si l'utilisateur n'a pas (encore) de composition —
 * dans ce cas l'UI doit simplement ne rien afficher de spécial sur les
 * pions (comportement par défaut, identique à avant ce système).
 */
export function resolveLineup(lineupRow, collection) {
  if (!lineupRow) return null;

  const bySlot = {};
  const slotKeys = ['gk', 'def0', 'def1', 'att0', 'att1', 'att2'];

  slotKeys.forEach(slot => {
    const ownershipId = lineupRow[`slot_${slot}`];
    if (!ownershipId) return;
    const owned = collection.find(c => c.id === ownershipId);
    if (!owned) return;

    // Un joueur custom (owned.isCustom === true) porte son nom et son style
    // directement à plat (voir toOwnedShape() dans main.js) ; un joueur du
    // catalogue les porte dans owned.fictional_players. On normalise ici
    // pour que le reste du jeu n'ait jamais besoin de connaître cette
    // différence de structure entre les deux sources.
    const baseName = owned.isCustom ? owned.name : owned.fictional_players?.name;
    const style = owned.isCustom ? owned.style : owned.fictional_players?.style;
    const rarity = owned.isCustom ? 'personnalise' : owned.fictional_players?.rarity;

    bySlot[slot] = {
      displayName: owned.custom_name || baseName,
      style,
      rarity
    };
  });

  return bySlot;
}

/**
 * Pour un tokenId du moteur (ex: "b-att1", "r-gk"), retourne le slot
 * générique correspondant (ex: "att1", "gk"), indépendant de l'équipe.
 */
export function slotFromTokenId(tokenId) {
  const match = tokenId.match(/^[a-z]-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Retourne le nom à afficher pour un pion donné, ou null si aucune lineup
 * résolue n'est disponible pour son équipe (cas par défaut : pas de
 * compte, pas de composition encore choisie, ou adversaire sans lineup
 * connue côté client — ex. l'IA n'a pas d'identité de joueurs).
 */
export function displayNameForToken(tokenId, lineupsByTeam) {
  const slot = slotFromTokenId(tokenId);
  if (!slot) return null;
  const team = tokenId.startsWith('b-') ? 'bleu' : 'rouge';
  const lineup = lineupsByTeam?.[team];
  if (!lineup || !lineup[slot]) return null;
  return lineup[slot].displayName;
}
