-- M3ak — corrige une escalade de privilèges : un manager pouvait s'attribuer
-- (ou attribuer à un complice) le rôle "owner", via deux chemins qui ne
-- vérifiaient que l'agence, jamais le rôle inséré :
--   1) INSERT direct sur agency_members avec role = 'owner'
--   2) INSERT d'une invitation (agency_invites) avec role = 'owner', puis
--      redeem_invite() qui fait confiance au rôle stocké sans le revalider.
-- Trouvé et reproduit via scripts/rls-security-audit.mjs contre une instance
-- Supabase locale (aucune donnée de production affectée).

drop policy if exists "agency_members_insert" on public.agency_members;
create policy "agency_members_insert" on public.agency_members
  for insert with check (
    -- Un owner/manager ne peut ajouter que des manager/employee.
    (public.is_agency_manager(agency_id) and role in ('manager', 'employee'))
    or (
      -- Amorçage : le créateur d'une agence toute neuve devient son premier
      -- owner (et seulement lui, et seulement comme owner).
      role = 'owner'
      and user_id = auth.uid()
      and not exists (select 1 from public.agency_members m where m.agency_id = agency_members.agency_id)
      and exists (
        select 1 from public.agencies a
        where a.id = agency_members.agency_id and a.created_by = auth.uid()
      )
    )
  );

drop policy if exists "agency_invites_insert" on public.agency_invites;
create policy "agency_invites_insert" on public.agency_invites
  for insert with check (
    public.is_agency_manager(agency_id) and role in ('manager', 'employee')
  );
