-- M3ak — cachet de l'agence : une image (photo ou scan du tampon) dans le bucket privé « agency-assets »,
-- apposée sur les contrats PDF à côté de la signature de l'agence.
-- Seul le propriétaire peut le référencer (comme le reste de la fiche entreprise : RLS « agencies_update »).

alter table public.agencies add column if not exists stamp_path text;

create or replace function public.check_agency_stamp_path()
returns trigger
language plpgsql
as $$
begin
  if NEW.stamp_path is not null
     and NEW.stamp_path is distinct from OLD.stamp_path
     and NEW.stamp_path !~ ('^' || NEW.id::text || '/stamp\.(png|jpg|jpeg)$') then
    raise exception 'invalid_stamp_path';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_check_agency_stamp_path on public.agencies;
create trigger trg_check_agency_stamp_path
  before update on public.agencies
  for each row execute function public.check_agency_stamp_path();
