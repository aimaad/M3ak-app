-- BIBIP — Plaques qui seraient EN DOUBLE une fois normalisées (même plaque écrite de deux façons : « 8921-ب-14 » et « 8921 | ب | 14 »).
-- À lancer dans Supabase → SQL Editor. LECTURE SEULE : cette requête ne modifie rien.
-- Depuis l'ajout rapide de véhicule, les nouvelles plaques sont enregistrées au format « numéro | lettre | région » ; les plaques déjà
-- enregistrées ne sont PAS modifiées. Cette liste montre seulement celles à regarder (fusionner ou archiver à la main, dans l'app).
--
-- Normalisation (comme dans l'app) : sans espaces, barres, tirets, points ni soulignés ; sans marques invisibles ni allongement « ـ » ;
-- « إ آ ٱ » = « أ » ; « ة ە » = « ه » ; en majuscules.

with normalized as (
  select
    v.id,
    v.agency_id,
    v.immatriculation,
    v.archived_at,
    v.created_at,
    upper(
      regexp_replace(
        translate(
          regexp_replace(v.immatriculation, '[‎‏؜‪-‮⁦-⁩ـ]', '', 'g'),
          'إآٱةە',
          'أأأهه'
        ),
        '[\s|/\-._]+', '', 'g'
      )
    ) as plate_key
  from public.vehicles v
)
select
  n.agency_id,
  n.plate_key,
  count(*) as nombre,
  string_agg(n.immatriculation || case when n.archived_at is not null then ' (archivé)' else '' end, '   ·   ' order by n.created_at) as ecritures,
  string_agg(n.id::text, ', ' order by n.created_at) as ids
from normalized n
group by n.agency_id, n.plate_key
having count(*) > 1
order by n.agency_id, n.plate_key;
