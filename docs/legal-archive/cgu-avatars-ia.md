# Archive — CGU des outils IA aux dates de génération des avatars

Complément de [`docs/ip-provenance.md`](../ip-provenance.md). Archivage réalisé
le 2026-07-23 via la Wayback Machine (permaliens datés, immuables). Les
**prompts de génération n'ont pas été conservés** — constat acté, voir en bas.

## Dates de référence (historique git)

| Version | Outil | Intégration au dépôt | Commit |
|---|---|---|---|
| v1 — `keeper.png`, `shooter.png`, `ball.png` (#243) | **ChatGPT** (OpenAI) | **2026-07-17** | `2c5153d` |
| v2 — avatars actuels (#329) | **Flow** (Google) | **2026-07-21** | `8090cbd` |

La génération est antérieure ou contemporaine de ces dates ; les instantanés
archivés ci-dessous encadrent chacune d'elles. `ball.png` (v1, ChatGPT) est
toujours en service.

## v1 — OpenAI (ChatGPT), en vigueur au 2026-07-17

| Document | Instantané archivé | Capturé le |
|---|---|---|
| Europe Terms of Use (applicable — utilisateur en France ; version « Updated: 16 January 2026 ») | <http://web.archive.org/web/20260717081100/https://openai.com/policies/eu-terms-of-use/> | 2026-07-17 08:11 UTC |
| Terms of Use (reste du monde, pour référence) | <http://web.archive.org/web/20260718093011/https://openai.com/policies/row-terms-of-use/> | 2026-07-18 09:30 UTC |

**Clause pertinente** (section « Content », vérifiée le 2026-07-23 sur la
version « Updated: 16 January 2026 », identique à celle en vigueur le
2026-07-17) : l'utilisateur conserve ses droits sur l'Input et **possède
l'Output** ; OpenAI lui cède tout droit éventuel sur l'Output. Réserve notée
par les conditions elles-mêmes : l'Output peut ne pas être unique (des
sorties similaires peuvent être produites pour d'autres utilisateurs, la
cession ne s'y étend pas).

## v2 — Google (Flow), en vigueur au 2026-07-21

| Document | Instantané archivé | Capturé le |
|---|---|---|
| Google Terms of Service (version du 22 mai 2024) | <http://web.archive.org/web/20260721235657/https://policies.google.com/terms> | 2026-07-21 23:56 UTC |
| Generative AI Additional Terms (version du 9 août 2023) | <http://web.archive.org/web/20260722001304/https://policies.google.com/terms/generative-ai> | 2026-07-22 00:13 UTC |
| Page produit Flow (labs.google), instantané le plus proche | <http://web.archive.org/web/20260206115951/https://labs.google/flow/> | 2026-02-06 (5 mois avant — le plus proche disponible) |

**Clauses pertinentes** (vérifiées le 2026-07-23) : les CGU Google précisent
que Google ne revendique pas la propriété du contenu de l'utilisateur (licence
d'exploitation limitée au fonctionnement des services). Les conditions
additionnelles IA générative n'abordent pas la propriété des sorties ; elles
imposent des restrictions d'usage (pas d'entraînement de modèles concurrents,
politique d'usage prohibé) et rappellent de vérifier le contenu généré avant
publication.

## Prompts de génération

**Non conservés** (constat du 2026-07-23, acté par le propriétaire du
projet). Éléments de provenance subsistants : les masters pleine résolution
dans `art-sources/shootout/` (v2) et l'historique des issues/PRs (#230, #243,
#247, #329, #330) qui documentent la démarche et les dates.

## Limites de cet archivage

- Les instantanés Wayback sont des pages publiques archivées par un tiers
  (Internet Archive) — valeur probante usuelle en due diligence, mais pas un
  constat d'huissier.
- Pour Flow, aucun document de conditions **spécifique à l'outil** n'a pu être
  archivé à la date exacte ; les CGU Google générales + conditions IA
  générative sont les textes applicables cités par Google Labs.
