-- M3ak — inspection complète : guide de capture étendu (extérieur, roues, intérieur), analyse IA et
-- validation des dommages par l'employé.
--
-- 1) Nouveaux angles de photo (3/4, capot, toit, pare-brise, volant, frein à main, sièges, banquette,
--    plafond, tapis, coffre ouvert) et nouvelles zones / types de dommage (intérieur, pneus, feux…).
-- 2) damages : source (IA ou saisie manuelle), statut de validation (proposé / confirmé / rejeté),
--    coût estimé par l'IA et coût validé par l'employé, description, angle de la photo.
-- 3) inspections : état de l'analyse IA, résumé, relevés lus au tableau de bord (km, carburant).
--
-- Rien n'est supprimé : les anciennes valeurs et les inspections existantes restent valides.

-- ------------------------------------------------------------------ angles de photo
alter type public.photo_angle add value if not exists 'avant_gauche';
alter type public.photo_angle add value if not exists 'avant_droit';
alter type public.photo_angle add value if not exists 'arriere_gauche';
alter type public.photo_angle add value if not exists 'arriere_droit';
alter type public.photo_angle add value if not exists 'capot';
alter type public.photo_angle add value if not exists 'toit';
alter type public.photo_angle add value if not exists 'pare_brise';
alter type public.photo_angle add value if not exists 'volant';
alter type public.photo_angle add value if not exists 'frein_a_main';
alter type public.photo_angle add value if not exists 'siege_avant_gauche';
alter type public.photo_angle add value if not exists 'siege_avant_droit';
alter type public.photo_angle add value if not exists 'banquette_arriere';
alter type public.photo_angle add value if not exists 'plafond';
alter type public.photo_angle add value if not exists 'tapis';
alter type public.photo_angle add value if not exists 'coffre_interieur';

-- ------------------------------------------------------------------ zones et types de dommage
alter type public.damage_zone add value if not exists 'calandre';
alter type public.damage_zone add value if not exists 'phare_avant';
alter type public.damage_zone add value if not exists 'feu_arriere';
alter type public.damage_zone add value if not exists 'bas_de_caisse';
alter type public.damage_zone add value if not exists 'lunette_arriere';
alter type public.damage_zone add value if not exists 'pneu_avant_gauche';
alter type public.damage_zone add value if not exists 'pneu_avant_droit';
alter type public.damage_zone add value if not exists 'pneu_arriere_gauche';
alter type public.damage_zone add value if not exists 'pneu_arriere_droit';
alter type public.damage_zone add value if not exists 'tableau_de_bord';
alter type public.damage_zone add value if not exists 'volant';
alter type public.damage_zone add value if not exists 'frein_a_main';
alter type public.damage_zone add value if not exists 'siege_avant_gauche';
alter type public.damage_zone add value if not exists 'siege_avant_droit';
alter type public.damage_zone add value if not exists 'banquette_arriere';
alter type public.damage_zone add value if not exists 'plafond';
alter type public.damage_zone add value if not exists 'tapis';
alter type public.damage_zone add value if not exists 'coffre_interieur';

alter type public.damage_type add value if not exists 'eclat';
alter type public.damage_type add value if not exists 'tache';
alter type public.damage_type add value if not exists 'dechirure';
alter type public.damage_type add value if not exists 'brulure';
alter type public.damage_type add value if not exists 'casse';
alter type public.damage_type add value if not exists 'usure';

-- ------------------------------------------------------------------ dommages : validation par l'employé
alter table public.damages
  add column if not exists angle text,
  add column if not exists description text check (description is null or length(description) <= 500),
  add column if not exists comparaison text not null default 'retour_seul'
    check (comparaison in ('comparee', 'retour_seul', 'depart')),
  add column if not exists statut text not null default 'propose'
    check (statut in ('propose', 'confirme', 'rejete')),
  add column if not exists source text not null default 'ia'
    check (source in ('ia', 'manuel')),
  add column if not exists cout_valide numeric(10, 2) check (cout_valide is null or cout_valide >= 0),
  add column if not exists valide_par uuid references auth.users (id),
  add column if not exists valide_le timestamptz,
  add column if not exists created_by uuid references auth.users (id);

-- ------------------------------------------------------------------ inspections : analyse IA et relevés
alter table public.inspections
  add column if not exists kilometrage integer check (kilometrage is null or kilometrage >= 0),
  add column if not exists niveau_carburant smallint check (niveau_carburant is null or niveau_carburant between 0 and 100),
  add column if not exists proprete text check (proprete is null or proprete in ('propre', 'correcte', 'sale')),
  add column if not exists analysis_status text not null default 'aucune'
    check (analysis_status in ('aucune', 'en_cours', 'terminee', 'partielle', 'echec')),
  add column if not exists analyzed_at timestamptz,
  add column if not exists ai_summary text check (ai_summary is null or length(ai_summary) <= 2000),
  add column if not exists failed_zones text[] not null default '{}';

create index if not exists damages_inspection_statut_idx on public.damages (inspection_id, statut);
