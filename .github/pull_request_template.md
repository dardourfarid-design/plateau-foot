<!--
  Ce template existe pour une raison précise : une passe de vérification (2026-07-16)
  a trouvé 4 issues fermées dont le DoD n'était pas satisfait — dont #61, fermée sans
  qu'une seule ligne de son DoD soit livrée. Les cases n'étaient jamais cochées
  (3 issues sur 157), donc plus rien ne distinguait « fait » de « pas fait ».
  Le but ici n'est pas la paperasse : c'est que la case cochée redevienne une info fiable.
-->

## Ce que fait cette PR

<!-- 2-3 phrases. Le « pourquoi » avant le « comment ». -->

## Issues traitées

<!--
  Utilise « Closes #N » pour une issue RÉELLEMENT terminée (DoD entièrement satisfait),
  et « Refs #N » si la PR n'en livre qu'une partie. Une issue partiellement livrée
  ne se ferme pas : c'est exactement comme ça que #181, #203 et #228 sont passées à travers.
-->

Closes #

## Vérification du DoD

<!--
  Pour chaque point du DoD des issues fermées par cette PR, coche la case DANS L'ISSUE
  et dis ici comment tu l'as vérifié. Une case cochée doit vouloir dire « j'ai constaté »,
  jamais « ça devrait marcher ».
-->

- [ ] J'ai relu le DoD de chaque issue en `Closes` et coché **dans l'issue** les points livrés.
- [ ] Les points **non** livrés ou dépendant d'une action externe (console Google, Dashboard
      Supabase, vérif sur device…) restent décochés, et l'issue reste **ouverte** s'il en reste.

**Comment j'ai vérifié :**

<!-- Ex. : « node tests/run-tests.js → 224/224 » · « grep sur public/src/ui/profileUI.js »
     · « rejoué le parcours accueil → séance en local » · « node tools/balance-sim.mjs → 40/40 » -->

## Tests

- [ ] `node tests/run-tests.js` au vert
- [ ] Tests ajoutés/mis à jour pour le comportement introduit
- [ ] Non applicable (doc, CI, assets uniquement) — préciser :

## Points d'attention

<!--
  À remplir si concerné, sinon supprimer :
  - Migration Supabase → l'ajouter à `supabase/MIGRATIONS.md` ET au README (l'oubli de la
    0037 dans MIGRATIONS.md est précisément l'objet de #203).
  - Changement de structure HTML → penser aux baselines visuelles (`docs/regression-runbook.md`).
  - Nouveau fichier servi → vérifier le précache `sw.js` et les `modulepreload`.
  - i18n → `public/src/ui/i18n.js` + `i18n-en.js`.
-->
