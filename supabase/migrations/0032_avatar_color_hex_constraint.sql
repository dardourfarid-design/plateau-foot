-- ============================================================
-- TACTIC MASTER — Correctif sécurité : contrainte hex sur avatar_color
--
-- FAILLE : custom_players.avatar_color (migration 0012) n'avait AUCUNE
-- contrainte de format, alors que sa valeur est injectée brute dans des
-- attributs SVG rendus via innerHTML (src/ui/playerAvatar.js). Une valeur
-- comme `#000" onload="…` ou `red"><script>…` s'échappait de l'attribut →
-- injection SVG/HTML (au minimum self-XSS, potentiellement cross-user si
-- l'avatar est affiché à un autre joueur). avatar_pattern et avatar_accessory
-- avaient déjà leur contrainte ; seule la couleur manquait.
--
-- CORRECTIF : contrainte CHECK acceptant uniquement une couleur hex #RRGGBB.
-- Les lignes héritées non conformes (le cas échéant) sont d'abord ramenées à
-- la couleur par défaut, pour que l'ajout de la contrainte ne échoue pas.
-- (Le rendu client applique la même garde en défense en profondeur.)
-- ============================================================

update public.custom_players
  set avatar_color = '#3A6EA5'
  where avatar_color !~ '^#[0-9A-Fa-f]{6}$';

alter table public.custom_players
  drop constraint if exists custom_players_avatar_color_hex;

alter table public.custom_players
  add constraint custom_players_avatar_color_hex
  check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');
