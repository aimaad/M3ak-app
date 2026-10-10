-- M3ak — chantier B (maintenance) : nouvelles valeurs d'énum.
-- `panne` (incident non planifié) et `en_cours` (intervention démarrée,
-- immobilise le véhicule) doivent être ajoutées à des types déjà en usage ;
-- comme pour la migration 0013, une valeur ajoutée à un enum préexistant ne
-- peut pas être utilisée dans la MÊME transaction. Ce fichier doit donc être
-- exécuté seul (clic "Run" à part) AVANT la migration 0020 — voir
-- supabase/README.md.

alter type public.maintenance_type add value if not exists 'panne';
alter type public.maintenance_status add value if not exists 'en_cours';
