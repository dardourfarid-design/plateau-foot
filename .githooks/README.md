# Git hooks

Hooks de dépôt, versionnés ici pour être partagés entre clones.

## Activation (une fois par clone)

```bash
git config core.hooksPath .githooks
```

## `pre-push`

Bloque les **push directs vers `main`** et rappelle de passer par une branche
+ Pull Request.

⚠️ C'est un garde-fou **local** à ce clone, pas une protection serveur : il ne
s'applique qu'à cette machine et se contourne avec `git push --no-verify`. Une
vraie protection de branche côté GitHub nécessite un plan payant sur un dépôt
privé (ou de rendre le dépôt public).
