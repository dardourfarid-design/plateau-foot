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

## Panneaux LED de la séance de tirs au but (#231) — décision

La scène de la séance affiche un panneau LED de 3 cellules. Elles portaient le
texte « VOTRE PUB » et n'étaient **jamais câblées** : ça ressemblait à un
emplacement publicitaire cassé.

**Décision retenue : promo MAISON personnalisée** (`public/src/services/ads/houseAds.js`),
et **pas** de régie tierce. Raison : la garantie structurelle du projet est
« **aucune pub pendant une partie** » (voir plus haut), et une séance de tirs au
but **est** une partie. Y brancher AdSense supposerait de réviser explicitement
cette garantie — ce n'est pas le choix fait.

Ce que contiennent les cellules : nos propres messages, adaptés au joueur
(création de compte si anonyme, Pass si connecté, puzzle du jour, boutique…).
Ce ne sont pas des impressions publicitaires : rien n'est compté, tracé, ni
vendu, et `adService` n'est pas sollicité.

**Porte laissée ouverte** : `pickHouseAds(context, count)` est un simple
fournisseur de contenu. Le jour où une vraie régie serait décidée, l'UI garde le
même point d'entrée (`renderHouseAds()` dans `shootoutUI.js`) et c'est ce module
qui déléguerait — mais il faudrait **d'abord** trancher la garantie ci-dessus.

## GameMonetize « en attendant AdSense » — interstitiel + rewarded

AdSense (bannières Display) reste la régie cible, mais sa validation traîne.
Pour ne pas laisser l'inventaire **interstitiel** (entre deux parties) et
**rewarded** (vidéo opt-in) vide — là où l'eCPM sur jeu est le plus fort — on
branche **GameMonetize** sur ces deux seuls formats. La bannière Display reste
servie par AdSense. Le routage par format est un composite (`adProvider.js`) :

```js
ads.providers = { banner: 'adsense', interstitial: 'gamemonetize', rewarded: 'gamemonetize' }
```

Régies disponibles : `adsense` (bannière), `gamemonetize` (interstitiel +
rewarded), `mock` (dev). Absence de `providers` ⇒ tout AdSense (rétro-compatible).

### Sécurité du crédit rewarded (important)

GameMonetize (SDK HTML5, socle GameDistribution) **ne fournit pas de postback
S2S signé** : le seul signal « vue terminée » est l'événement navigateur
`SDK_REWARDED_WATCH_COMPLETE`, donc auto-déclaré par le client — exactement le
farm que 0026 a fermé. On préserve l'invariant « le client n'écrit jamais le
grand livre » avec un **modèle nonce serveur en deux temps** (migration 0044) :

1. `rewarded-begin` (JWT) → `create_rewarded_nonce(user_id)` : nonce aléatoire à
   usage unique, lié à l'utilisateur **authentifié** (jamais déclaré par le body).
2. Le joueur regarde la vidéo (GameMonetize) → `SDK_REWARDED_WATCH_COMPLETE`.
3. `rewarded-complete` (JWT) → `consume_rewarded_nonce(user_id, nonce)` : valide
   propriété + non-consommé + non-expiré (15 min), puis crédite via la **même**
   `grant_rewarded_coins` que le SSV Google (montant décidé serveur, plafond 10/j,
   idempotence `provider_ref = nonce`).

**Limite assumée** : sans crypto S2S, un utilisateur muni de son propre JWT peut
réclamer sans regarder — dommage borné à 10 pièces/jour. Le vrai SSV signé
revient avec AdMob/Ad Manager (`rewarded-ssv` reste en place, inchangé).

Orchestration client : `services/ads/rewardedGrant.js` (`runRewardedGrant`),
appelé par `handleWatchRewarded` dans `main.js`. Le nonce ne circule qu'entre le
client et **notre** serveur — jamais transmis au SDK.

### Comportement réel du SDK (vérifié le 2026-07-23, gameId réel)

Testé en local avec un vrai `gameId` : `window.sdk` n'expose que **`showBanner()`**
(pas de `showAd`/`preloadAd` ; `play()` est un no-op). Un interstitiel réel joue
avec la séquence d'événements `SDK_GAME_PAUSE → [vidéo] → SDK_GAME_START` — c'est
ce que `gameMonetizeProvider` mappe. Détail important : **le SDK mémorise
`window.SDK_OPTIONS.onEvent` au chargement** et ignore toute réassignation ; on
pose donc l'aiguilleur définitif avant d'insérer le script.

Le **rewarded** se distingue par `SDK_REWARDED_WATCH_COMPLETE`, émis seulement si
l'inventaire « Rewarded » est activé pour le jeu côté dashboard GameMonetize.
En local, seul l'interstitiel a pu être observé (le rewarded ne sert pas sur
`localhost`). Le provider ne crédite JAMAIS sans cet événement — un interstitiel
laisse `completed:false`, donc aucun crédit indu.

### Activation (aucun code à écrire)

1. Inscrire le jeu sur GameMonetize → récupérer le **gameId**. ✅ *fait*
2. `public/config.js` : `ads.gameMonetize.gameId` renseigné, `ads.interstitial:
   true` ✅ (vérifié en local). `ads.rewarded` reste **`false`** tant que l'étape 5
   n'est pas confirmée.
3. Déployer la **migration 0044** (`rewarded_nonces` + les deux RPC). ✅ *fait*
4. Déployer les Edge Functions `rewarded-begin` / `rewarded-complete`, désactiver
   « Verify JWT » (comme `delete-account`), poser **`REWARDED_CLIENT_ENABLED=true`**
   (échec fermé sinon). ✅ *fait*
5. **Rewarded — reste à confirmer** : activer l'inventaire « Rewarded » pour le jeu
   dans le dashboard GameMonetize, tester sur le **domaine déployé** (pas
   localhost) qu'une vidéo regardée jusqu'au bout émet bien
   `SDK_REWARDED_WATCH_COMPLETE` et crédite +10 pièces (idempotent, borné 10/j),
   PUIS passer `ads.rewarded` à `true`.

> ⚠️ Empiler AdSense + GameMonetize sur la **même page** peut heurter les CGU
> AdSense. Ici les formats sont **disjoints** (bannière = AdSense ; interstitiel
> plein écran / rewarded = GameMonetize), pas superposés sur un même emplacement.

## État live de la chaîne pub (2026-07-24)

Récapitulatif de bout en bout de ce qui tourne **en production**, dans l'ordre
où les verrous s'enchaînent. Chaque brique a été livrée par une PR distincte.

### Consentement — CMP InMobi (certifié Google, indépendant d'AdSense)

Google **exige un CMP certifié** pour diffuser en EEE/UK/Suisse depuis janvier
2024. Sans chaîne de consentement TCF, la pile Google (GPT/IMA) — utilisée par
GameMonetize — se charge en `gdpr=1` sans signal et **ne remplit rien**. Le CMP
historique (Funding Choices) dépend d'un compte AdSense validé : impasse tant
qu'AdSense n'est pas approuvé. On est donc passé à **InMobi CMP** (ex-Quantcast
Choice), certifié, gratuit, indépendant d'AdSense — il couvre GameMonetize
maintenant **et** AdSense plus tard.

- Assemblage : `services/ads/cmpProvider.js` (garantit **un seul CMP actif** —
  deux CMP = deux bandeaux + chaînes TCF concurrentes = consentement invalide).
- Pont TCF→signal interne : `services/ads/tcfConsent.js` (mapping pur ;
  finalité 1 ou vendeur Google 755 refusé ⇒ refus ; données incomplètes ⇒
  indécis, jamais un faux accord).
- Chargeur : `services/ads/inmobiCmp.js`. Le snippet officiel est **inline**
  (interdit par la CSP) → transposé en module. Il installe **deux stubs**, TCF
  **et GPP** (`choice.js` appelle `window.__gpp` avant sa vraie implémentation —
  oublier le stub GPP lève `TypeError: window.__gpp is not a function`), chacun
  avec son iframe locator (`__tcfapiLocator`, `__gppLocator`) que GPT/IMA
  recherchent depuis leurs propres iframes.
- Config : `ads.cmp = { enabled: true, provider: 'inmobi', inmobi: { propertyId,
  scriptUrl } }`. propertyId **`pLpA6AsDPtRE3`** (tag V3).
- Gating durci (#364) : **accord positif requis** avant de charger tout SDK pub
  (`areAdsAllowed` → `hasAdvertisingConsent()` ; plus « CMP fait autorité »).
  Corollaire : `onAdvertisingConsentChange(GRANTED)` **relance `initAds()`**.

⚠️ **À ne jamais faire** : rallumer Funding Choices (`provider: 'google'`) quand
AdSense sera validé. InMobi couvre les deux — deux CMP casseraient le consentement.

### Zéro pub pour les abonnés (#367)

Un pass actif ⇒ **aucune pub, tous formats**. Le statut `_adFree` (cache) est
**re-vérifié à froid juste avant CHAQUE affichage** (`isFreshlyAdFree()`) pour
fermer la fenêtre d'un cache périmé (webhook Stripe lent, autre onglet). Bon
marché en anonyme (aucun aller-retour backend). Point d'injection de test :
`setActivePassResolver()`. Vérifié en prod : abonné simulé → 3 formats bloqués.

### Robustesse d'affichage GameMonetize (#366, #369)

Le SDK **ne nettoie jamais** son conteneur plein écran noir
(`#sdk__advertisement_slot`) et émet `SDK_GAME_START` très tardivement. Le
provider **ne dépend pas** de cet événement : `armAdMonitor` observe l'état réel
de la vidéo (poll 300 ms) et solde l'affichage dès que — no-fill à 6 s, ou pub
démarrée puis arrêtée (2 relevés). Sans ce garde-fou : **écran sombre 20-30 s**,
joueur bloqué.

Pendant la fenêtre de chargement (règle UX `loading-states`), un indicateur
**« Publicité en cours… »** (spinner marqué, `role=status`, reduced-motion) est
inséré en **premier enfant** du conteneur — l'iframe pub passe **par-dessus**,
donc zéro risque de masquer une pub servie ; retiré dès qu'une vraie pub joue.

### CSP (rappel des domaines requis par la chaîne)

`script-src` doit inclure `'unsafe-eval'` (GPT/IMA), `securepubads.g.doubleclick.net`
+ `*.doubleclick.net` + `www.googletagservices.com` (GPT), `gamemonetize.com`
(apex) + `api.gamemonetize.com` + `*.gamemonetize.com`, `imasdk.googleapis.com`,
`*.2mdn.net`, et les domaines CMP (`cmp.inmobi.com`, `*.inmobi.com`,
`*.quantcast.mgr.consensu.org`). Plus `media-src` (la vidéo des pubs) et les
`frame-src`/`connect-src` équivalents. **`*.domaine` ne matche PAS l'apex.**

> ⚠️ **Service worker** : le HTML est mis en cache **avec ses en-têtes**. Toute
> modification de CSP (ou d'en-tête) dans `vercel.json` reste **masquée** tant
> que `CACHE_NAME` n'est pas bumpé dans `sw.js`. Réflexe systématique.

## Action restante côté toi — langue du bandeau InMobi

Le bandeau de consentement s'affiche dans la **langue du visiteur** (Accept-Language
/ géo), pas dans celle du document. `<html lang="fr">` est déjà correct, mais
InMobi ne sert le français que s'il est **activé dans la propriété**.

À faire dans le dashboard InMobi CMP (propriété `pLpA6AsDPtRE3`) :
1. Section **Languages / Localisation** → activer **Français** (et le laisser en
   langue par défaut ou fallback).
2. Republier la configuration de consentement.
3. Vérifier depuis un navigateur en locale FR : le bandeau doit s'afficher en
   français (un opt-in en langue maternelle **augmente le taux d'acceptation**,
   donc le remplissage publicitaire).
