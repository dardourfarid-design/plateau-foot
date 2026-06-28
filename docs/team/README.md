# Personae & rôles — Tactic Master

Ce dossier documente les rôles utiles pour faire grandir Tactic Master au-delà
d'un projet solo. Chaque fiche décrit : la mission du rôle sur *ce* projet
précisément, les compétences attendues, ce qui existe déjà dans le code que
cette personne devrait connaître, et les premiers chantiers concrets qui
l'attendent.

Ce ne sont pas des descriptions de poste génériques copiées d'ailleurs : elles
sont écrites en fonction de l'état réel du projet au moment de leur rédaction
(juin 2026) — moteur de jeu testé, déploiement Vercel, backend Supabase,
paiement mocké, IA locale, pas encore de multijoueur.

## Rôles documentés

| Rôle | Fichier | Priorité d'embauche/délégation actuelle |
|---|---|---|
| Game Designer | [`game-designer.md`](./game-designer.md) | Moyenne — les règles sont stables, mais l'équilibrage IA et les futurs modes en ont besoin |
| Développeur Frontend/Produit | [`developpeur-frontend.md`](./developpeur-frontend.md) | Haute — c'est le rôle qui a porté tout le projet jusqu'ici, premier renfort utile |
| Développeur Backend/Infra | [`developpeur-backend.md`](./developpeur-backend.md) | Haute dès le chantier multijoueur — Realtime, sécurité, montée en charge |
| Designer UI/UX | [`designer-ui-ux.md`](./designer-ui-ux.md) | Moyenne — l'identité visuelle existe, manque une vraie revue pro et des assets (icônes, illustrations) |
| Growth / Marketing | [`growth-marketing.md`](./growth-marketing.md) | Basse pour l'instant, haute dès que le trafic doit dépasser le cercle proche |

## Comment utiliser ces fiches

- **Pour déléguer une tâche à Claude** : dis quel persona doit porter la tâche
  ("en tant que designer UI/UX, revois la boutique") pour que je réponde avec
  les bons réflexes et niveau d'exigence de ce rôle.
- **Pour recruter ou briefer un humain** : ces fiches servent de base de fiche
  de poste ou d'onboarding — à adapter, pas à copier-coller tel quel dans une
  offre d'emploi publique.
- **Pour toi en solo** : la colonne "premiers chantiers" de chaque fiche est
  une liste de tâches concrètes, utilisable comme backlog par rôle.
