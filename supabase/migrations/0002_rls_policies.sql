-- M3ak — Row Level Security : chaque agence ne voit que ses propres données.

-- ==================================================================
-- Fonctions utilitaires (security definer pour éviter la récursion RLS
-- quand on vérifie l'appartenance à une agence depuis agency_members)
-- ==================================================================

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.agency_role_of(target_agency_id uuid)
returns public.agency_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.agency_members
  where agency_id = target_agency_id
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_agency_manager(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.agency_role_of(target_agency_id) in ('owner', 'manager');
$$;

-- ==================================================================
-- Activation RLS sur toutes les tables métier
-- ==================================================================

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.branches enable row level security;
alter table public.vehicles enable row level security;
alter table public.customers enable row level security;
alter table public.rentals enable row level security;
alter table public.deposits enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.damages enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.chat_messages enable row level security;

-- ==================================================================
-- agencies
-- ==================================================================

create policy "agencies_select" on public.agencies
  for select using (public.is_agency_member(id));

create policy "agencies_insert" on public.agencies
  for insert to authenticated with check (true);

create policy "agencies_update" on public.agencies
  for update using (public.agency_role_of(id) = 'owner');

create policy "agencies_delete" on public.agencies
  for delete using (public.agency_role_of(id) = 'owner');

-- ==================================================================
-- agency_members
-- Un utilisateur qui crée une agence doit pouvoir s'y ajouter comme
-- "owner" (premier membre) ; ensuite seul un owner/manager peut inviter.
-- ==================================================================

create policy "agency_members_select" on public.agency_members
  for select using (public.is_agency_member(agency_id));

create policy "agency_members_insert" on public.agency_members
  for insert with check (
    public.is_agency_manager(agency_id)
    or not exists (
      select 1 from public.agency_members m where m.agency_id = agency_members.agency_id
    )
  );

create policy "agency_members_update" on public.agency_members
  for update using (public.agency_role_of(agency_id) = 'owner');

create policy "agency_members_delete" on public.agency_members
  for delete using (public.agency_role_of(agency_id) = 'owner');

-- ==================================================================
-- Tables simples "agence propriétaire" : lecture pour tout membre,
-- écriture pour tout membre, suppression réservée owner/manager.
-- ==================================================================

create policy "branches_select" on public.branches
  for select using (public.is_agency_member(agency_id));
create policy "branches_write" on public.branches
  for insert with check (public.is_agency_member(agency_id));
create policy "branches_update" on public.branches
  for update using (public.is_agency_member(agency_id));
create policy "branches_delete" on public.branches
  for delete using (public.is_agency_manager(agency_id));

create policy "vehicles_select" on public.vehicles
  for select using (public.is_agency_member(agency_id));
create policy "vehicles_insert" on public.vehicles
  for insert with check (public.is_agency_member(agency_id));
create policy "vehicles_update" on public.vehicles
  for update using (public.is_agency_member(agency_id));
create policy "vehicles_delete" on public.vehicles
  for delete using (public.is_agency_manager(agency_id));

create policy "customers_select" on public.customers
  for select using (public.is_agency_member(agency_id));
create policy "customers_insert" on public.customers
  for insert with check (public.is_agency_member(agency_id));
create policy "customers_update" on public.customers
  for update using (public.is_agency_member(agency_id));
create policy "customers_delete" on public.customers
  for delete using (public.is_agency_manager(agency_id));

create policy "rentals_select" on public.rentals
  for select using (public.is_agency_member(agency_id));
create policy "rentals_insert" on public.rentals
  for insert with check (public.is_agency_member(agency_id));
create policy "rentals_update" on public.rentals
  for update using (public.is_agency_member(agency_id));
create policy "rentals_delete" on public.rentals
  for delete using (public.is_agency_manager(agency_id));

create policy "deposits_select" on public.deposits
  for select using (public.is_agency_member(agency_id));
create policy "deposits_insert" on public.deposits
  for insert with check (public.is_agency_member(agency_id));
create policy "deposits_update" on public.deposits
  for update using (public.is_agency_member(agency_id));
create policy "deposits_delete" on public.deposits
  for delete using (public.is_agency_manager(agency_id));

create policy "inspections_select" on public.inspections
  for select using (public.is_agency_member(agency_id));
create policy "inspections_insert" on public.inspections
  for insert with check (public.is_agency_member(agency_id));
create policy "inspections_update" on public.inspections
  for update using (public.is_agency_member(agency_id));
create policy "inspections_delete" on public.inspections
  for delete using (public.is_agency_manager(agency_id));

create policy "inspection_photos_select" on public.inspection_photos
  for select using (public.is_agency_member(agency_id));
create policy "inspection_photos_insert" on public.inspection_photos
  for insert with check (public.is_agency_member(agency_id));
create policy "inspection_photos_update" on public.inspection_photos
  for update using (public.is_agency_member(agency_id));
create policy "inspection_photos_delete" on public.inspection_photos
  for delete using (public.is_agency_manager(agency_id));

create policy "damages_select" on public.damages
  for select using (public.is_agency_member(agency_id));
create policy "damages_insert" on public.damages
  for insert with check (public.is_agency_member(agency_id));
create policy "damages_update" on public.damages
  for update using (public.is_agency_member(agency_id));
create policy "damages_delete" on public.damages
  for delete using (public.is_agency_manager(agency_id));

create policy "maintenance_items_select" on public.maintenance_items
  for select using (public.is_agency_member(agency_id));
create policy "maintenance_items_insert" on public.maintenance_items
  for insert with check (public.is_agency_member(agency_id));
create policy "maintenance_items_update" on public.maintenance_items
  for update using (public.is_agency_member(agency_id));
create policy "maintenance_items_delete" on public.maintenance_items
  for delete using (public.is_agency_manager(agency_id));

create policy "payments_select" on public.payments
  for select using (public.is_agency_member(agency_id));
create policy "payments_insert" on public.payments
  for insert with check (public.is_agency_member(agency_id));
create policy "payments_update" on public.payments
  for update using (public.is_agency_manager(agency_id));
create policy "payments_delete" on public.payments
  for delete using (public.is_agency_manager(agency_id));

create policy "invoices_select" on public.invoices
  for select using (public.is_agency_member(agency_id));
create policy "invoices_insert" on public.invoices
  for insert with check (public.is_agency_member(agency_id));
create policy "invoices_update" on public.invoices
  for update using (public.is_agency_manager(agency_id));
create policy "invoices_delete" on public.invoices
  for delete using (public.is_agency_manager(agency_id));

-- ==================================================================
-- chat_messages : chaque employé voit tout l'historique de son agence
-- (utile pour le contexte du chat), mais ne peut créer que ses propres messages.
-- ==================================================================

create policy "chat_messages_select" on public.chat_messages
  for select using (public.is_agency_member(agency_id));
create policy "chat_messages_insert" on public.chat_messages
  for insert with check (public.is_agency_member(agency_id) and user_id = auth.uid());
