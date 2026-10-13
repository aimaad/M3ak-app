-- M3ak — durcit côté SERVEUR les buckets qui reçoivent des documents d'identité et de véhicule.
-- Jusqu'ici seules l'app validait le type et la taille : un appel REST direct pouvait déposer n'importe quel fichier.
-- Les buckets restent privés ; les règles d'accès (RLS storage) ne changent pas.
-- Aucune donnée n'est modifiée ni supprimée.

update storage.buckets
set file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']
where id in ('client-documents', 'vehicle-documents');

-- Sécurité : on vérifie que les buckets sensibles sont bien privés (une migration ne doit jamais les rendre publics).
update storage.buckets set public = false where id in ('client-documents', 'vehicle-documents', 'inspection-photos', 'contract-pdfs');
