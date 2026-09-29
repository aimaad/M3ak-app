-- M3ak — une seule photo par angle et par inspection (une reprise remplace la précédente).

alter table public.inspection_photos
  add constraint inspection_photos_inspection_angle_key unique (inspection_id, angle);
