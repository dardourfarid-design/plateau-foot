# `_engine/` — copie du moteur pour l'Edge Function

**Ne pas éditer ces fichiers à la main.** Ce sont des copies **générées**, identiques
octet pour octet à la source unique `public/src/engine/`.

## Pourquoi ici (dans le dossier de la fonction, pas dans `_shared/`)

`supabase functions deploy` — et le déploiement via le dashboard — n'embarque de
façon fiable que **le dossier propre de la fonction**. Un import vers
`../../../public/src/engine/…` **ou** vers `../_shared/engine/…` (dossier frère)
échoue au déploiement avec « Module not found ». En plaçant les copies **sous
`push-game-state/_engine/`**, elles font partie du bundle quelle que soit la
méthode de déploiement. L'Edge Function `push-game-state` (#260) rejoue le moteur
du jeu côté serveur : elle importe donc ces copies locales.

## Maintenir à jour

Après toute modification de `public/src/engine/` :

```bash
node tools/sync-edge-engine.mjs
```

Le test `tests/edgeEngineSync.test.js` (suite `node tests/run-tests.js`, donc CI)
échoue si les copies ont dérivé de la source.

Fichiers synchronisés (arbre atteignable depuis `replayActions.js`) :
`constants.js`, `gameEngine.js`, `replayActions.js`.

## Déploiement 100 % manuel (tableau de bord)

Pour éviter de recréer ce dossier `_engine/` à la main, une version **mono-fichier**
(moteur inliné, aucun import local) est générée dans
`tools/generated/push-game-state.single.ts` : colle-la telle quelle comme
`index.ts`. Régénérer : `node tools/bundle-edge-function.mjs`.
