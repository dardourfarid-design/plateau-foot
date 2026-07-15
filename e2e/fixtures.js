// ===================== FIXTURES E2E PUBLICS =====================
// Politique IT (2026-07-15) : les E2E publics ne doivent générer AUCUN trafic
// vers le backend Supabase depuis la machine qui les lance (poste de travail
// OU runner CI — par conception, cette suite est « parcours anonymes, aucun
// backend »). Toute requête vers *.supabase.co est interceptée et coupée
// AVANT de quitter le processus (context.route → abort).
//
// Deux régimes :
//  - lectures PUBLIQUES légitimes pour un anonyme (catalogue thèmes,
//    compteur Fondateurs) : coupées silencieusement — la boutique bascule
//    sur son catalogue de secours offline (refreshThemeData) et les
//    fallbacks (200 places, 0 pièce) ;
//  - tout le reste : coupé ET échec du test — un parcours qui a besoin du
//    backend appartient à e2e/auth/ (CI uniquement), pas ici.
//
// Chaque spec importe { test, expect } d'ici au lieu de '@playwright/test'.

import { test as base, expect } from '@playwright/test';

// Lectures anonymes légitimes : coupées sans faire échouer le test.
const LECTURES_PUBLIQUES = [
  /\/rest\/v1\/themes\?/,
  /\/rest\/v1\/rpc\/get_founders_remaining/
];

export const test = base.extend({
  context: async ({ context }, use) => {
    const fuites = [];
    await context.route(/supabase\.co/i, (route) => {
      const url = route.request().url();
      if (!LECTURES_PUBLIQUES.some((re) => re.test(url))) fuites.push(url);
      route.abort('blockedbyclient');
    });
    await use(context);
    if (fuites.length > 0) {
      throw new Error(
        'Trafic backend interdit détecté dans un E2E public (politique IT) :\n  '
        + [...new Set(fuites)].join('\n  ')
        + '\nCe parcours doit être déplacé vers e2e/auth/ (CI uniquement), mocké,'
        + ' ou gardé par session locale (voir hasLocalSession, supabaseClient.js).'
      );
    }
  }
});

export { expect };
