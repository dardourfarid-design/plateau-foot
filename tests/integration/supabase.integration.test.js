// Tests d'intégration Supabase (#128) — invariants SERVEUR sur la branche de
// test : RLS, durcissement des RPC service_role, cohérence des lectures
// publiques. Volontairement NON DESTRUCTIF (aucune écriture qui polluerait la
// base : soit des lectures, soit des appels dont on attend qu'ils ÉCHOUENT).

import { createClient } from '@supabase/supabase-js';
import { describe, test, expect } from '../test-utils.js';

const cfg = globalThis.__TM_TEST_SUPABASE__;

// Client anonyme (comme un visiteur : protégé uniquement par les policies RLS).
function anonClient() {
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
}

describe('intégration — lectures publiques', () => {
  test('le catalogue de thèmes est lisible sans compte', async () => {
    const { data, error } = await anonClient().from('themes').select('id').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('get_founders_remaining renvoie un entier >= 0 (compteur réel)', async () => {
    const { data, error } = await anonClient().rpc('get_founders_remaining');
    expect(error).toBeNull();
    expect(typeof data === 'number' && data >= 0).toBeTruthy();
  });
});

describe('intégration — RLS & durcissement', () => {
  test('un anonyme ne lit AUCUN profil (RLS auth.uid() = id)', async () => {
    // Sans session, la policy de select sur profiles ne matche personne.
    const { data, error } = await anonClient().from('profiles').select('id').limit(5);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test('grant_rewarded_coins est refusée à un anonyme (service_role uniquement)', async () => {
    // Migration 0036 : revoke public/anon/authenticated ; seul le SSV (service_role)
    // peut créditer. L'appel doit ÉCHOUER, jamais créditer.
    const { error } = await anonClient().rpc('grant_rewarded_coins', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_reward_type: 'coins_small',
      p_provider_ref: 'integration-test-should-fail'
    });
    expect(error).toBeTruthy();
  });

  test('complete_stripe_purchase est refusée à un anonyme (webhook service_role)', async () => {
    // Migration 0025/0031 : réservée au webhook Stripe. Un client ne peut pas
    // s'auto-livrer un achat.
    const { error } = await anonClient().rpc('complete_stripe_purchase', {
      p_stripe_session_id: 'integration-test-should-fail'
    });
    expect(error).toBeTruthy();
  });
});

// Parcours authentifié : seulement si un compte de test est fourni.
describe('intégration — session authentifiée', () => {
  test('connexion + lecture de SES propres données (pas celles des autres)', async () => {
    if (!cfg.user || !cfg.pass) {
      console.log('    (E2E_USER/E2E_PASS absents — test authentifié sauté)');
      return;
    }
    const client = anonClient();
    const { error: signErr } = await client.auth.signInWithPassword({
      email: cfg.user,
      password: cfg.pass
    });
    if (signErr) {
      // Le compte de test n'existe pas (encore) sur la branche `testing` :
      // on saute proprement plutôt que d'échouer (le test s'activera dès que
      // E2E_USER sera créé sur ce backend — voir docs/supabase-branching.md).
      console.log(`    (compte de test invalide : ${signErr.message} — test sauté)`);
      return;
    }

    // Solde de pièces accessible pour l'utilisateur connecté.
    const { data: balance, error: balErr } = await client.rpc('get_currency_balance');
    expect(balErr).toBeNull();
    expect(typeof balance === 'number' && balance >= 0).toBeTruthy();

    // RLS : la lecture de profiles ne renvoie QUE sa propre ligne.
    const { data: profiles, error: profErr } = await client.from('profiles').select('id');
    expect(profErr).toBeNull();
    expect(profiles).toHaveLength(1);

    await client.auth.signOut();
  });
});
