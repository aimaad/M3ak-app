-- M3ak — verso des documents clients (permis marocain recto-verso).
-- Un document garde un seul enregistrement (numéro, dates, catégories) mais peut
-- désormais porter deux fichiers : le recto (file_path) et le verso (file_path_verso).

alter table public.customer_documents
  add column if not exists file_path_verso text;
