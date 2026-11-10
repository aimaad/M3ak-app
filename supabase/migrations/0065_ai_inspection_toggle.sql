-- M3ak — Analyse IA des inspections : accord du propriétaire SÉPARÉ de la lecture automatique des documents.
--
-- Avant : un seul accord (`cloud_enabled`) autorisait à la fois la lecture des permis / cartes grises ET l'analyse des photos
-- d'inspection (dommages). Maintenant chaque outil a son accord :
--   * cloud_enabled       : lecture automatique des documents (permis, carte grise) ;
--   * inspection_enabled  : analyse IA des photos d'inspection (dommages) ;
--   * insights_enabled    : recommandations IA de l'accueil ;
--   * chat_enabled        : Chat BIBIP.
-- Chaque accord est impossible sans clé d'API (comme les autres) et réservé au propriétaire.
--
-- Les agences qui avaient déjà activé la lecture automatique GARDENT l'analyse des inspections (le comportement actuel ne change
-- pas) ; le propriétaire peut ensuite la désactiver seule. Aucune autre donnée n'est modifiée.

alter table public.agency_ocr_settings add column if not exists inspection_enabled boolean not null default false;

-- Reprise de l'existant AVANT de brancher la traçabilité (pour ne pas écrire une ligne de journal par agence).
update public.agency_ocr_settings set inspection_enabled = true where cloud_enabled = true and gemini_api_key is not null and inspection_enabled = false;

create or replace function public.ocr_settings_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.gemini_api_key is null then
    new.cloud_enabled := false;
    new.inspection_enabled := false;
    new.insights_enabled := false;
    new.chat_enabled := false;
  end if;
  return new;
end;
$$;

create or replace function public.get_ocr_settings(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  settings public.agency_ocr_settings;
begin
  if not public.is_agency_member(p_agency_id) then
    raise exception 'not_allowed';
  end if;
  select * into settings from public.agency_ocr_settings where agency_id = p_agency_id;
  return jsonb_build_object(
    'cloud_available', coalesce(settings.gemini_api_key is not null, false),
    'cloud_enabled', coalesce(settings.cloud_enabled and settings.gemini_api_key is not null, false),
    'inspection_enabled', coalesce(settings.inspection_enabled and settings.gemini_api_key is not null, false),
    'insights_enabled', coalesce(settings.insights_enabled and settings.gemini_api_key is not null, false),
    'chat_enabled', coalesce(settings.chat_enabled and settings.gemini_api_key is not null, false)
  );
end;
$$;

-- Réservé au propriétaire ; refusé tant qu'aucune clé n'est configurée (même règle que les autres accords).
create or replace function public.set_ai_inspection_enabled(p_agency_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.agency_role_of(p_agency_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_enabled and not exists (
    select 1 from public.agency_ocr_settings where agency_id = p_agency_id and gemini_api_key is not null
  ) then
    raise exception 'ocr_key_missing';
  end if;
  update public.agency_ocr_settings set inspection_enabled = p_enabled where agency_id = p_agency_id;
  return public.get_ocr_settings(p_agency_id);
end;
$$;

revoke all on function public.set_ai_inspection_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_ai_inspection_enabled(uuid, boolean) to authenticated;

-- Journal d'activité : le propriétaire voit qui a activé ou désactivé l'analyse des inspections.
create or replace function public.audit_ocr_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.cloud_enabled is distinct from NEW.cloud_enabled then
    perform public.audit_event(NEW.agency_id, 'ocr_cloud_toggled', null, jsonb_build_object('enabled', NEW.cloud_enabled));
  end if;
  if OLD.inspection_enabled is distinct from NEW.inspection_enabled then
    perform public.audit_event(NEW.agency_id, 'ai_inspection_toggled', null, jsonb_build_object('enabled', NEW.inspection_enabled));
  end if;
  if OLD.insights_enabled is distinct from NEW.insights_enabled then
    perform public.audit_event(NEW.agency_id, 'ai_insights_toggled', null, jsonb_build_object('enabled', NEW.insights_enabled));
  end if;
  return NEW;
end;
$$;
