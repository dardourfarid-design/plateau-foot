-- ============================================================
-- TACTIC MASTER — #260 : fermeture du chemin d'écriture non validé du
-- multijoueur en ligne.
--
-- CONTEXTE : depuis la V1 (migration 0005, durcie par 0030), le client pousse
-- un game_state COMPLET via la RPC update_game_session_state — le serveur ne
-- valide pas la légalité des coups (choix documenté « chantier futur »). Un
-- client modifié peut donc écrire un état truqué de SA partie (téléporter le
-- ballon, gonfler le score).
--
-- CORRECTIF : l'écriture passe désormais par l'Edge Function push-game-state,
-- qui rejoue un journal d'actions sur l'état autoritaire avec le moteur du jeu
-- (public/src/engine/replayActions.js) et persiste le résultat du rejeu via le
-- service role. Cette migration retire l'accès direct des clients à la RPC.
--
-- ⚠️  ORDRE DE DÉPLOIEMENT (sinon le multijoueur casse) :
--     1. Déployer l'Edge Function push-game-state et CONSTATER qu'une partie
--        en ligne fonctionne (le client bascule dessus tout seul ; il ne se
--        replie sur la RPC que si la fonction est absente).
--     2. Appliquer ALORS cette migration : le repli devient inutile et le
--        chemin non validé est fermé.
-- ============================================================

-- ⚠️ CES DEUX LIGNES SONT INOPÉRANTES — voir 0043 et #295.
-- Il manque `public` dans la liste : PostgreSQL accorde EXECUTE à PUBLIC par
-- défaut à la création d'une fonction, et anon/authenticated conservent donc
-- l'exécution par héritage. Le revoke passe sans erreur et ne ferme rien.
-- La migration est conservée telle quelle (elle est appliquée en prod) ; le
-- correctif vit dans 0043_fix_0039_revoke_public.sql.
revoke execute on function public.update_game_session_state(uuid, jsonb) from anon;
revoke execute on function public.update_game_session_state(uuid, jsonb) from authenticated;
-- Le service role (Edge Functions) conserve l'exécution — et pourrait à terme
-- remplacer la RPC par un update direct ; on garde la RPC pour sa transition
-- de statut (finished) et son point d'audit unique.
grant execute on function public.update_game_session_state(uuid, jsonb) to service_role;
