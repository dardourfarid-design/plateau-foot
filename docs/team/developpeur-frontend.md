# Développeur Frontend / Produit — Tactic Master

## Mission sur ce projet

Faire évoluer l'expérience de jeu et le produit web dans son ensemble :
écrans, parcours utilisateur, intégration boutique/compte, performance
perçue. C'est le rôle qui a porté le projet jusqu'ici (architecture moteur
pur + UI séparée, tests, déploiement) — toute personne qui rejoint dans ce
rôle doit d'abord comprendre cette séparation avant de toucher au code.

## Ce qui existe déjà à connaître avant de modifier quoi que ce soit

- **Architecture stricte en 3 couches** : `src/engine/` (logique pure, jamais
  de DOM), `src/ui/` (rendu + orchestration), `src/services/` (Supabase,
  paiement). Ne jamais mélanger : si une fonction touche `document`, elle
  n'a rien à faire dans `engine/`.
- **`public/` est le dossier déployé tel quel** — pas de bundler, pas de build
  complexe. `public/src/` est une copie de `src/` régénérée par `node
  build.js` ; après toute modif dans `src/`, il faut relancer ce script avant
  de committer, sinon le site en ligne ne reflète pas le changement.
- **`npm test`** lance 49 tests sans dépendance externe (runner maison dans
  `tests/test-utils.js`, pas de Vitest/Jest installé — pas d'accès npm en
  environnement sandboxé au moment de l'écriture). Tout nouveau comportement
  de jeu doit être testé avant d'être considéré fini.
- **Design system** : variables CSS dans `:root` de `public/styles.css`
  (`--vert-terrain`, `--bleu-equipe`, etc.), polices Barlow Condensed (titres)
  + Space Grotesk (texte courant). Les thèmes (boutique) ne font que
  réassigner ces variables — voir `src/ui/themeManager.js`.
- **Pas de framework** : vanilla JS avec ES modules natifs. C'est un choix
  délibéré pour rester déployable sans étape de build ; ne pas introduire
  React/Vue sans une vraie discussion sur le coût de migration.

## Compétences attendues

- JavaScript moderne (ES modules, async/await) sans dépendance à un framework
  — capacité à manipuler le DOM directement quand nécessaire.
- CSS avancé (Grid, variables CSS, responsive réel) plutôt que du
  copier-coller de classes utilitaires.
- Compréhension des principes d'architecture en couches (séparation logique
  métier / présentation), même en l'absence de framework qui l'impose.
- Discipline de test : ne pas considérer une fonctionnalité terminée sans test
  qui couvre au moins le cas heureux et un cas limite.
- À l'aise avec Supabase côté client (auth, requêtes, RLS) pour les écrans
  compte/boutique.

## Premiers chantiers concrets

1. Le multijoueur en ligne (lien d'invitation, liste de joueurs, matchmaking)
   est le chantier UI le plus lourd à venir — nécessite de nouveaux écrans
   (salle d'attente, état de connexion adverse) en plus de la synchronisation
   réseau (voir fiche backend pour la partie Realtime).
2. Polish des micro-interactions : animations de transition entre écrans,
   feedback visuel plus riche sur les buts et victoires.
3. Tester et corriger l'accessibilité clavier (actuellement tout est pensé
   pour la souris/tactile — un joueur au clavier seul ne peut pas jouer).
4. Mettre en place un vrai pipeline de build si le projet grossit au point où
   la copie manuelle `src/` → `public/src/` devient risquée (CI qui vérifie
   que les deux dossiers sont synchronisés avant de merger, par exemple).
