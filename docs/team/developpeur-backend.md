# Développeur Backend / Infra — Tactic Master

## Mission sur ce projet

Garantir la fiabilité et la sécurité de tout ce qui touche aux données
joueurs : authentification, achats, et bientôt synchronisation temps réel pour
le multijoueur. C'est le rôle qui devient critique dès que le chantier
multijoueur démarre — jusqu'ici le "backend" se limitait à Supabase Auth +
quelques tables, le temps réel change l'ordre de grandeur de la complexité.

## Ce qui existe déjà à connaître avant de modifier quoi que ce soit

- **Supabase** est l'unique backend (Postgres géré + Auth + bientôt Realtime).
  Schéma dans `supabase/migrations/`, à exécuter dans l'ordre numéroté via le
  SQL Editor du dashboard (pas de CLI configurée actuellement).
- **Row Level Security stricte** : chaque table a ses policies définies dans
  les migrations. Principe non négociable déjà en place : un joueur ne peut
  jamais écrire ses propres achats — seule une fonction `security definer`
  (`mock_complete_purchase`) ou plus tard un webhook serveur avec la
  `service_role` key peut le faire. Ce principe doit être conservé pour toute
  nouvelle table sensible (ex. futurs scores classés).
- **Paiement actuellement mocké** (`src/services/payment/mockPaymentProvider.js`)
  — le vrai Stripe est un squelette prêt mais non branché
  (`stripePaymentProvider.js`), en attente d'un compte Stripe créé par le
  porteur du projet. Bascule prévue en un seul fichier d'assemblage
  (`paymentProvider.js`), sans toucher au reste de l'app.
- **Aucun serveur custom** : pas de Node/Express derrière l'app. Tout ce qui
  nécessite une logique serveur passe par des fonctions Postgres
  (`security definer`) ou, plus tard, des Supabase Edge Functions.
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

1. Concevoir le schéma de données du multijoueur : table `game_sessions`
   (état de la partie partagée), gestion de la présence des deux joueurs,
   et synchronisation des coups via Supabase Realtime (channels broadcast ou
   postgres_changes selon le volume attendu).
2. Implémenter le webhook Stripe (`checkout.session.completed` →
   insertion sécurisée dans `purchases`) dès que le compte Stripe existe —
   le code client est déjà prêt à l'appeler, il manque la Edge Function
   serveur.
3. Réfléchir à la stratégie anti-triche basique pour le multijoueur : le
   moteur de règles (`gameEngine.js`) peut tourner aussi bien côté serveur que
   client — décider si certains coups doivent être revalidés côté serveur
   avant d'être diffusés à l'adversaire.
4. Mettre en place une vraie politique de sauvegarde/export des données
   Supabase avant que le volume de joueurs ne rende une perte de données
   coûteuse.
