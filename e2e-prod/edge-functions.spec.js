import { test, expect } from '@playwright/test';

// SMOKE — réglage verify_jwt=false des Edge Functions (#22).
//
// delete-account et create-checkout-session tournent par conception avec
// verify_jwt = false : l'authentification est vérifiée DANS la fonction
// (supabase.auth.getUser()), pas par le gateway. Ce réglage doit être posé
// manuellement dans le Dashboard et peut être silencieusement réactivé par
// un redéploiement — cassant la suppression de compte (RGPD) et le checkout.
//
// Détection sans effet de bord : on appelle chaque fonction SANS jeton.
// - verify_jwt = false (attendu) : la fonction s'exécute et répond son
//   erreur applicative → 401 {"error":"Authentification requise."}.
// - verify_jwt réactivé (régression) : le gateway bloque AVANT la fonction
//   et répond son propre format ({"code":401,"message"/"msg":…}) → le test
//   échoue et signale la régression.
// Aucune donnée n'est lue ni écrite : le parcours s'arrête au contrôle d'auth.

const EDGE_FUNCTIONS = ['delete-account', 'create-checkout-session'];

async function fetchSupabaseUrl(request, baseURL) {
  // L'URL Supabase de la prod est lue depuis le config.js réellement déployé,
  // pour tester exactement le backend que sert le site (pas une valeur codée
  // en dur qui pourrait diverger).
  const res = await request.get(`${baseURL}/config.js`);
  expect(res.ok(), 'config.js doit être servi par la prod').toBeTruthy();
  const body = await res.text();
  const match = body.match(/supabaseUrl:\s*'([^']+)'/);
  expect(match, 'supabaseUrl introuvable dans config.js').toBeTruthy();
  return match[1];
}

for (const fn of EDGE_FUNCTIONS) {
  test(`${fn} : l'auth est vérifiée par la fonction, pas par le gateway (verify_jwt=false actif)`, async ({ request, baseURL }) => {
    const supabaseUrl = await fetchSupabaseUrl(request, baseURL);

    const res = await request.post(`${supabaseUrl}/functions/v1/${fn}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });

    expect(res.status(), 'un appel sans jeton doit être refusé').toBe(401);

    const body = await res.json();
    // Signature de l'erreur APPLICATIVE (la fonction a tourné). Si le gateway
    // avait bloqué (verify_jwt réactivé), le corps serait {"code":401,
    // "message"/"msg": "..."} sans clé `error` — échec voulu du test.
    expect(body.error, `réponse inattendue de ${fn} : ${JSON.stringify(body)} — ` +
      'si {"code":401,...}, le réglage verify_jwt=false a probablement été ' +
      'réécrasé par un redéploiement (voir README, checklist Edge Functions)').toBe('Authentification requise.');
  });
}
