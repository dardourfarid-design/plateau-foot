# Développeur Backend / Infra — Tactic Master

## Mission sur ce projet

Garantir la fiabilité et la sécurité de tout ce qui touche aux données
joueurs : authentification, achats, synchronisation temps réel multijoueur
(déjà livrée et testée en conditions réelles). Le chantier qui rend ce rôle
critique aujourd'hui est le câblage de Stripe pour les paiements réels —
jusqu'ici 100% simulé (mock), aucune transaction réelle n'a jamais eu lieu.

## Ce qui existe déjà à connaître avant de modifier quoi que ce soit

- **Supabase** est l'unique backend (Postgres géré + Auth + Realtime, déjà
  activé pour le multijoueur). Schéma dans `supabase/migrations/` (18
  migrations au 29 juin 2026), à exécuter dans l'ordre numéroté via le SQL
  Editor du dashboard (pas de CLI configurée actuellement).
- **Row Level Security stricte sur les 15 tables** : chaque table a ses
  policies définies dans les migrations, sans exception. Principe non
  négociable déjà en place : un joueur ne peut jamais écrire ses propres
  achats — seule une fonction `security definer` (`mock_complete_purchase`)
  ou plus tard un webhook serveur avec la `service_role` key peut le faire.
- **Paiement actuellement mocké, câblage Stripe en cours** — le squelette
  `stripePaymentProvider.js` existe mais aucune Supabase Edge Function
  (`create-checkout-session`, `stripe-webhook`) n'est encore écrite. C'est
  le chantier n°1 actuel. Un correctif important a déjà été fait en amont
  (migration `0018`) : l'achat de joueurs mercato suit désormais le même
  chemin générique que les thèmes (`paymentProvider.js`), pour qu'un futur
  branchement Stripe sur les thèmes ne laisse pas ce chemin gratuit par
  oubli.
- **Aucun serveur custom** : pas de Node/Express derrière l'app. Tout ce qui
  nécessite une logique serveur passe par des fonctions Postgres
  (`security definer`) ou des Supabase Edge Functions à venir pour Stripe.
- **Clé `anon` publique par design** (visible dans `public/config.js`) — ce
  n'est pas une fuite de sécurité, la protection vient des policies RLS, pas
  du secret de la clé. Ne jamais y mettre la clé `service_role`.

## Compétences attendues

- SQL et Postgres solides, en particulier Row Level Security — c'est le seul
  rempart de sécurité de l'app, une erreur de policy expose directement des
  données joueurs.
- Connaissance de Supabase Realtime (ou équivalent websocket) pour le
  multijoueur : gestion de présence, synchronisation d'état entre deux
  clients, résilience aux déconnexions.
- Compréhension des flux de paiement serveur-à-serveur (webhooks Stripe) et
  du principe "ne jamais faire confiance au client" pour tout ce qui touche
  à l'argent — le prix doit être vérifié côté serveur, jamais transmis tel
  quel depuis le navigateur.
- Capacité à raisonner sur la cohérence d'état distribué (que se passe-t-il si
  un joueur ferme son onglet en pleine partie multijoueur ?).

## Premiers chantiers concrets

1. **Câblage Stripe (priorité actuelle)** : créer les deux Supabase Edge
   Functions manquantes — `create-checkout-session` (reçoit l'id de produit,
   recalcule le prix côté serveur, jamais confiance dans un prix client) et
   `stripe-webhook` (vérifie la signature Stripe, insère la ligne `purchases`
   avec la `service_role` key sur `checkout.session.completed`). Une fois
   ces deux fonctions en place, basculer `paymentProvider.js` de
   `mockPaymentProvider` vers `stripePaymentProvider` (déjà écrit).
2. **Suppression complète de compte (RGPD)** : `delete_my_data()` ne
   nettoie que les tables applicatives (profil, achats, consentements). Le
   compte `auth.users` lui-même persiste — sa suppression nécessite la clé
   `service_role` via une Edge Function dédiée. À traiter avant tout
   contrôle ou toute échelle réelle d'utilisateurs.
3. **Revalidation serveur des coups multijoueur** : le moteur de règles
   (`gameEngine.js`) peut tourner aussi bien côté serveur que client —
   décider si certains coups doivent être revalidés côté serveur avant
   d'être diffusés à l'adversaire (le multijoueur fonctionne aujourd'hui en
   faisant confiance au moteur identique des deux clients, acceptable en V1
   entre amis, pas pour un mode compétitif avec de l'argent en jeu).
4. Mettre en place une vraie politique de sauvegarde/export des données
   Supabase avant que le volume de joueurs ne rende une perte de données
   coûteuse.
