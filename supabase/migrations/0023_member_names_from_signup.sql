-- M3ak — le prénom et le nom saisis à l'inscription sont recopiés sur le
-- profil du membre quand il rejoint une agence avec un code d'invitation
-- (jusqu'ici nom_complet restait vide pour les employés invités).
--
-- Même fonction que dans 0021, avec en plus prenom / nom / nom_complet lus dans
-- les métadonnées du compte (auth.users.raw_user_meta_data).

create or replace function public.redeem_invite(invite_code text)
returns public.agency_role
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  meta jsonb;
  member_prenom text;
  member_nom text;
begin
  select * into invite
  from public.agency_invites
  where code = invite_code
    and used_at is null
    and expires_at > now()
  limit 1;

  if invite is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  if exists (
    select 1 from public.agency_members
    where agency_id = invite.agency_id and user_id = auth.uid()
  ) then
    raise exception 'already_member';
  end if;

  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  member_prenom := nullif(trim(coalesce(meta ->> 'prenom', '')), '');
  member_nom := nullif(trim(coalesce(meta ->> 'nom', '')), '');

  insert into public.agency_members (agency_id, user_id, role, branch_id, prenom, nom, nom_complet)
  values (
    invite.agency_id, auth.uid(), invite.role, invite.branch_id,
    member_prenom, member_nom,
    nullif(trim(coalesce(member_prenom, '') || ' ' || coalesce(member_nom, '')), '')
  );

  update public.agency_invites
  set used_at = now(), used_by = auth.uid()
  where id = invite.id;

  return invite.role;
end;
$$;
