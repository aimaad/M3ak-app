-- M3ak — nouveaux statuts de réservation, à exécuter SÉPARÉMENT de
-- 0014_rentals_booking_system.sql.
--
-- Pourquoi un fichier à part : Postgres interdit d'utiliser une valeur
-- venant d'être ajoutée à un enum existant (ALTER TYPE ... ADD VALUE) dans
-- la MÊME transaction. L'éditeur SQL de Supabase exécute tout le texte collé
-- comme une seule transaction : si ce fichier et le suivant sont collés et
-- lancés ensemble, la création de la contrainte d'exclusion dans
-- 0014 (qui filtre sur le statut 'confirmee') échoue avec :
--   ERROR: 55P04: unsafe use of new value "confirmee" of enum type rental_status
-- La solution : exécuter ce fichier avec un clic sur "Run", attendre qu'il
-- se termine (donc que la transaction soit validée), puis exécuter
-- 0014_rentals_booking_system.sql avec un second clic sur "Run".

alter type public.rental_status add value if not exists 'en_attente_confirmation';
alter type public.rental_status add value if not exists 'confirmee';
