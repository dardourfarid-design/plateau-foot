# `_shared/engine/` — copie du moteur pour les Edge Functions

**Ne pas éditer ces fichiers à la main.** Ce sont des copies **générées**, identiques
octet pour octet à la source unique `public/src/engine/`.

## Pourquoi

`supabase functions deploy` n'embarque que les fichiers situés **sous
`supabase/functions/`**. Un import vers `../../../public/src/engine/…` échoue au
déploiement avec « Module not found ». L'Edge Function `push-game-state` (#260)
rejoue le moteur du jeu côté serveur : elle importe donc ces copies locales.

## Maintenir à jour

Après toute modification de `public/src/engine/` :

```bash
node tools/sync-edge-engine.mjs
```

Le test `tests/edgeEngineSync.test.js` (suite `node tests/run-tests.js`, donc CI)
échoue si les copies ont dérivé de la source.

Fichiers synchronisés (arbre atteignable depuis `replayActions.js`) :
`constants.js`, `gameEngine.js`, `replayActions.js`.
