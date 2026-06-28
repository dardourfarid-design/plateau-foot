// ===================== SERVICE NOTIFICATIONS =====================
// Principe non négociable : les notifications de retour sont strictement
// opt-in (jamais activées par défaut), et leur contenu est toujours
// factuel et neutre — jamais formulé pour culpabiliser ("ton adversaire
// t'attend", "ne perds pas ta série"). Voir TEMPLATES ci-dessous : chaque
// message décrit un fait disponible, sans levier émotionnel de manipulation.
//
// Ce module ne déclenche aucun envoi push lui-même pour l'instant (aucune
// infrastructure d'envoi configurée — Web Push nécessite un service worker
// et des clés VAPID, voir chantier ci-dessous). Il gère uniquement la
// préférence d'activation, stockée comme un consentement de plus dans le
// système RGPD déjà en place (voir consentService.js), pour rester
// cohérent avec le reste du projet plutôt que de créer un second système
// de préférences parallèle.

import { recordConsent } from './consentService.js';
import { supabase } from './supabaseClient.js';

export const NOTIFICATION_PURPOSE = 'notifications_reengagement';

// Modèles de message factuels, pour référence lors de l'implémentation
// future de l'envoi réel. Volontairement secs et informatifs.
export const NOTIFICATION_TEMPLATES = Object.freeze({
  DAILY_CHALLENGE_AVAILABLE: 'De nouveaux défis quotidiens sont disponibles.',
  STREAK_INFO: 'Ta série actuelle est de {days} jour(s).',
  FRIEND_ONLINE: '{friendName} vient de se connecter.'
});

export async function enableReengagementNotifications() {
  await recordConsent(NOTIFICATION_PURPOSE, true);
}

export async function disableReengagementNotifications() {
  await recordConsent(NOTIFICATION_PURPOSE, false);
}

export async function isReengagementEnabled() {
  if (!supabase) return false;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;

  const { data, error } = await supabase
    .from('user_consents')
    .select('granted')
    .eq('user_id', userData.user.id)
    .eq('purpose', NOTIFICATION_PURPOSE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return data.granted === true;
}

// ---------------------------------------------------------------
// CHANTIER FUTUR (non implémenté ici, documenté pour le rôle backend) :
// Pour un envoi réel de notifications push web, il faudra :
//   1. Générer une paire de clés VAPID côté serveur
//   2. Un service worker côté client (sw.js) qui écoute les push events
//   3. Demander la permission Notification au navigateur (jamais sans
//      action explicite de l'utilisateur sur un bouton dédié, jamais au
//      chargement de la page)
//   4. Une Supabase Edge Function planifiée (cron) qui envoie les push
//      uniquement aux comptes ayant isReengagementEnabled() === true
// Voir docs/team/developpeur-backend.md pour le suivi de ce chantier.
// ---------------------------------------------------------------
