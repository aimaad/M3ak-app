-- M3ak — console d'administration : activité de chaque agence (combien de voitures, clients, locations, dernière activité).
-- Seulement des COMPTEURS : jamais le contenu des clients, des voitures ni des locations.
-- (Remplace admin_list_agencies de la migration 0057.)

create or replace function public.admin_list_agencies()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'agency_id', a.id,
      'nom', a.nom,
      'ville', a.ville,
      'created_at', a.created_at,
      'access_until', a.access_until,
      'suspended', a.suspended,
      'has_access', public.agency_has_access(a.id),
      'members', (select count(*) from public.agency_members m where m.agency_id = a.id),
      'owner_email', (select u.email from public.agency_members m join auth.users u on u.id = m.user_id
                      where m.agency_id = a.id and m.role = 'owner' limit 1),
      'vehicles', (select count(*) from public.vehicles v where v.agency_id = a.id and v.archived_at is null),
      'customers', (select count(*) from public.customers c where c.agency_id = a.id and c.archived_at is null),
      'rentals', (select count(*) from public.rentals r where r.agency_id = a.id),
      'contracts', (select count(*) from public.contracts k where k.agency_id = a.id),
      'last_activity', (select max(l.created_at) from public.agency_audit_log l where l.agency_id = a.id)
    ) order by a.created_at desc)
    from public.agencies a
  ), '[]'::jsonb);
end;
$$;
