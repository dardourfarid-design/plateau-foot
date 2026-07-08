# Monétisation publicitaire — décision & fondations (épic #24, PR 0 / #25)

## Décision réseau
- **Google AdSense** pour l'affichage : bannières hors-jeu (#28) + interstitiels (#29).
- **Google Ad Manager** pour la vidéo récompensée (#30) — le rewarded web n'existe pas sur AdSense seul.
- Compte AdSense : publisher **`pub-2881855045042521`** (`ca-pub-2881855045042521`).

## Formats & règles
| Format | Écran | Fréquence | Payant (pass) |
|---|---|---|---|
| Bannière | accueil (hors-jeu) | permanente, jamais en partie | masquée |
| Interstitiel | transition fin de match | 1 / 3 matchs, cooldown 3 min | jamais |
| Rewarded | opt-in (bouton « +coins ») | à la demande, quota/jour serveur | masqué |

Verrous cumulés (tous requis), centralisés dans `adService` :
`config.ads.enabled` **ET** `hasAdvertisingConsent()` **ET** `!isAdFree()` **ET** flag du format.

## Matrice payant / gratuit
- **Gratuit + consentement pub** : voit bannières + interstitiels (plafonnés) + peut regarder des rewarded.
- **Gratuit sans consentement** : aucune pub (aucun SDK chargé).
- **Payant (pass actif)** : aucune pub, quel que soit le consentement (#31).

## KPIs à suivre
eCPM · fill rate · ARPDAU · opt-in rate rewarded · taux de complétion rewarded · impact rétention (interstitiel).

## État d'avancement (code)
- ✅ Consentement RGPD, couche AdProvider, bannières, interstitiels : livrés contre un **mock provider** (PR A→D, branche `feat/ads-pr-a-advertising-consent`).
- ✅ `public/ads.txt` en place (durable, versionné).
- ✅ `publisherId` renseigné dans `config.js` — **diffusion coupée** (`ads.enabled:false`).

## Étapes restantes de #25 (côté Google, manuelles)
1. **AdSense → Confidentialité et messages** : créer un message **RGPD** (CMP certifié IAB TCF v2.2), le publier sur le domaine. C'est ce qui active `cmp` côté client.
2. **AdSense → Blocs d'annonces** : créer un bloc « Display » (bannière) → récupérer le slot ID.
3. **Ad Manager** (plus tard, #30) : créer l'unité rewarded + configurer le **SSV** (server-side verification).
4. Vérifier que `https://<domaine>/ads.txt` renvoie bien la ligne (peut prendre 24 h côté AdSense).

## CSP à appliquer À L'ACTIVATION (pas avant — évite d'élargir la surface tant que rien ne charge)
Dans `vercel.json`, ajouter aux directives existantes :
```
script-src  … https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://adservice.google.com
frame-src   https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com
img-src     … https: (les créas viennent de nombreux domaines)
connect-src … https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com
```
> Ces ajouts se font dans la **PR d'activation** (quand `googleAdSenseProvider.js` remplace le mock), pas dans #25.

## Bascule mock → réel (résumé)
Un seul point à changer : `src/services/ads/adProvider.js` (`activeProvider`). Le reste du code
(`adService`, UI, gating) est déjà agnostique du réseau.
