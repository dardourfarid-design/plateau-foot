// ===================== CLIENT SUPABASE =====================
// Point d'entrée unique vers Supabase. Toute l'app passe par ce module
// pour parler au backend ; aucun autre fichier n'accède au SDK Supabase
// directement, ce qui permet de changer de backend plus tard sans chasser
// les usages dans tout le code.
//
// NOTE TECHNIQUE : pas de bundler en place pour cette première version
// (déploiement statique simple), donc le SDK Supabase est chargé via CDN
// dans index.html (variable globale `window.supabase`), plutôt qu'importé
// depuis npm. Si le projet passe à Vite/esbuild plus tard, ce fichier est
// le seul à adapter (remplacer createSupabaseClientFromGlobal par un vrai
// `import { createClient } from '@supabase/supabase-js'`).

function createSupabaseClientFromGlobal() {
  const SUPABASE_URL = window.__PLATEAU_FOOT_CONFIG__?.supabaseUrl;
  const SUPABASE_ANON_KEY = window.__PLATEAU_FOOT_CONFIG__?.supabaseAnonKey;

  if (!SUPABASE_URL || SUPABASE_URL.includes('METTRE_ICI') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('METTRE_ICI')) {
    console.warn(
      '[Supabase] Configuration manquante ou non renseignée dans public/config.js. ' +
      'Les fonctionnalités de compte et de boutique resteront indisponibles.'
    );
    return null;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Supabase] SDK non chargé. Vérifie la balise <script> CDN dans index.html.');
    return null;
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

export const supabase = createSupabaseClientFromGlobal();

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configuré : renseigne public/config.js avec ton URL et ta clé anon.');
  }
  return supabase;
}

// ---------- Auth ----------

export async function signUpWithEmail(email, password, displayName) {
  return requireClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
}

export async function signInWithEmail(email, password) {
  return requireClient().auth.signInWithPassword({ email, password });
}

/**
 * Envoie un email contenant un lien de réinitialisation de mot de passe.
 * Le lien renvoie vers reset-password.html (voir public/), où l'utilisateur
 * saisit son nouveau mot de passe — Supabase gère la validité/expiration
 * du jeton inclus dans le lien, ce module ne fait que déclencher l'envoi.
 */
export async function sendPasswordResetEmail(email) {
  const redirectTo = `${window.location.origin}/reset-password.html`;
  return requireClient().auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signOut() {
  return requireClient().auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// ---------- Thèmes ----------

export async function fetchActiveThemes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

// ---------- Achats ----------

export async function fetchMyPurchases() {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('purchases')
    .select('theme_id, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed');

  if (error) throw error;
  return data;
}

/**
 * Retourne le JWT d'accès de la session active, ou null.
 * Utilisé pour appeler les Edge Functions qui nécessitent une auth.
 */
export async function getAccessToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
