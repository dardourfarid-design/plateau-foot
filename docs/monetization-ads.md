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

**Où lire quoi :**
- **Côté app (Plausible, événements gated)** : `ad_impression`, `rewarded_opt_in`, `rewarded_result`, `consent_choice`.
- **Côté AdSense/Ad Manager (dashboard)** : revenus, **clics / CTR**, eCPM, fill rate. Les clics se produisent dans l'iframe de l'annonce → non traçables côté page (le helper `trackAdClick` reste inactif pour AdSense).

## État d'avancement (code)
- ✅ Consentement RGPD, couche AdProvider, bannières, interstitiels : livrés contre un **mock provider** (PR A→D, branche `feat/ads-pr-a-advertising-consent`).
- ✅ `public/ads.txt` en place (durable, versionné).
- ✅ `publisherId` renseigné dans `config.js` — **diffusion coupée** (`ads.enabled:false`).

## Plausible — mesure des KPIs (côté app)
Nos événements custom (`ad_impression`, `rewarded_opt_in`, `rewarded_result`,
`consent_choice`) sont envoyés à Plausible **uniquement si l'analytics est
consenti** (`isAnalyticsAllowed()`).

Côté code (fait) : `public/plausible-init.js` (stub de file d'attente) chargé
avant `script.js` → aucun événement perdu ; CSP autorise déjà `plausible.io`.

Étapes manuelles (dashboard Plausible) :
1. Créer le compte Plausible et **ajouter le site avec le VRAI domaine de prod**.
2. Dans `public/index.html`, mettre `data-domain` = ce domaine exact (placeholder
   actuel : `tactic-master.vercel.app`).
3. Créer les **Custom event goals** (sinon ils n'apparaissent pas dans les
   rapports) : `ad_impression`, `rewarded_opt_in`, `rewarded_result`,
   `consent_choice`.
4. (Optionnel) définir `rewarded_result` avec la propriété `completed` pour le
   taux de complétion.

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
Un seul point à changer : `public/src/services/ads/adProvider.js` (`activeProvider`). Le reste du code
(`adService`, UI, gating) est déjà agnostique du réseau.

---

## Runbook de déploiement progressif (PR I / #34)

Tout se pilote depuis `public/config.js → ads`, sans redéploiement de code (un `git push` du config suffit, ou édition côté hébergeur).

1. **Pré-vol** : `enabled:true`, `banner:true`, `slots.banner` correct, `cmp.publisherId` correct, `ads.txt` en ligne, migrations 0035 + 0036 appliquées.
2. **Canari 5 %** : `rolloutPercent: 5`. Surveiller les KPIs (impressions, `ads_unavailable`) et l'absence de régression UX pendant 24–48 h.
3. **Montée** : `25` → `50` → `100`, en vérifiant à chaque palier fill rate et rétention.
4. **Rollback immédiat** : repasser `rolloutPercent: 0` (ou `enabled:false`) coupe la diffusion instantanément pour tous — aucun déploiement de code requis.
5. **A/B** (optionnel) : `experiments.interstitialEveryN: [3,5]` pour comparer deux fréquences ; variante stable par client.

Les seuils sont **stables par client** (`abTest`) : un joueur ne bascule pas d'un état à l'autre entre deux visites tant que le pourcentage ne change pas.

## Checklist de conformité (à revalider avant chaque montée en %)
- [ ] **CMP** : message RGPD Google publié et affiché en EEE avant toute pub personnalisée.
- [ ] **Consentement** : un refus explicite (opt-out dur) coupe toute pub ; vérifié via « Gérer mes préférences ».
- [ ] **`ads.txt`** : `https://<domaine>/ads.txt` renvoie la ligne `pub-2881855045042521`.
- [ ] **Exclusion payants** : un pass actif ⇒ zéro pub (bannière, interstitiel, prompt rewarded).
- [ ] **Jamais en partie** : la bannière vit dans l'accueil, l'interstitiel seulement en transition, le rewarded est opt-in.
- [ ] **Rewarded** : crédit décidé côté serveur (SSV + quota, 0036) ; `REWARDED_SSV_ENABLED` seulement quand Ad Manager est prêt.
- [ ] **Analytics** : aucun événement de mesure émis en cas de refus analytics.
- [ ] **Perf** : première bannière différée à l'idle ; dégradation gracieuse si bloqueur/no-fill.
