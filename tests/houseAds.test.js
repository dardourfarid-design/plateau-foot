import { describe, test, expect } from './test-utils.js';
import { pickHouseAds } from '../public/src/services/ads/houseAds.js';

// #231 — panneaux maison de la séance : contenu personnalisé, jamais de cellule
// vide (une cellule vide redeviendrait un « emplacement pub cassé »).
describe('pickHouseAds (#231)', () => {
  test('remplit toujours exactement le nombre de cellules demandé', () => {
    expect(pickHouseAds({ signedIn: false }, 3)).toHaveLength(3);
    expect(pickHouseAds({ signedIn: true }, 3)).toHaveLength(3);
    // Même en demandant plus que de messages ciblés disponibles.
    expect(pickHouseAds({ signedIn: true }, 5)).toHaveLength(5);
  });

  test('personnalise selon le joueur : invite à créer un compte si non connecté', () => {
    const anon = pickHouseAds({ signedIn: false }, 3);
    expect(anon.includes('Crée ton compte — gratuit')).toBe(true);
    // Un joueur connecté ne se voit jamais proposer de créer un compte.
    const signed = pickHouseAds({ signedIn: true }, 3);
    expect(signed.includes('Crée ton compte — gratuit')).toBe(false);
  });

  test('propose le Pass uniquement à un joueur connecté', () => {
    expect(pickHouseAds({ signedIn: true }, 5).includes('Pass Saison — bonus d’XP')).toBe(true);
    expect(pickHouseAds({ signedIn: false }, 3).includes('Pass Saison — bonus d’XP')).toBe(false);
  });

  test('jamais de doublon ni de cellule vide', () => {
    const ads = pickHouseAds({ signedIn: true }, 5);
    expect(new Set(ads).size).toBe(ads.length);
    expect(ads.every(a => typeof a === 'string' && a.length > 0)).toBe(true);
  });

  test('contexte vide = comportement anonyme, sans planter', () => {
    expect(pickHouseAds()).toHaveLength(3);
  });
});
