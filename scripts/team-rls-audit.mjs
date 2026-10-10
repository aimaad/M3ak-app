// Audit du module Équipe & Filiales (filiales, suppression par un manager,
// profil, journal d'audit) — à exécuter contre une instance Supabase LOCALE
// uniquement (npx supabase start). Crée ses propres comptes/agences de test
// jetables.
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/team-rls-audit.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPA_URL;
const ANON = process.env.SUPA_ANON;
const SERVICE = process.env.SUPA_SERVICE;

if (!URL || !ANON || !SERVICE) {
  console.error('SUPA_URL, SUPA_ANON et SUPA_SERVICE sont requis.');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'OK  ' : 'FAIL'} — ${name} :: ${detail}`);
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  const email = `team-audit-${Date.now()}-${userCounter}@example.test`;
  const password = 'Audit-Test-P@ssw0rd-1234';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function createAgencyWithOwner(owner, nom) {
  const { data: agency, error } = await owner.client.from('agencies').insert({ nom, created_by: owner.id }).select().single();
  if (error) throw error;
  await owner.client.from('agency_members').insert({ agency_id: agency.id, user_id: owner.id, role: 'owner', nom_complet: 'Owner Test' });
  return agency;
}

async function inviteMember(owner, agencyId, member, role, branchId = null) {
  const code = randomCode();
  const { data: invite, error } = await owner.client
    .from('agency_invites')
    .insert({ agency_id: agencyId, code, role, branch_id: branchId, created_by: owner.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .select()
    .single();
  if (error) throw error;
  const { error: redeemErr } = await member.client.rpc('redeem_invite', { invite_code: code });
  if (redeemErr) throw redeemErr;
  return invite;
}

async function memberRow(agencyId, userId) {
  const { data, error } = await admin.from('agency_members').select('*').eq('agency_id', agencyId).eq('user_id', userId).single();
  if (error) throw error;
  return data;
}

async function main() {
  const owner = await createUser();
  const manager = await createUser();
  const employee = await createUser();
  const employee2 = await createUser();
  const outsider = await createUser();

  const agency = await createAgencyWithOwner(owner, 'Agence Équipe A');
  await createAgencyWithOwner(outsider, 'Agence Équipe B');

  // --- 1. Filiales : réservées à owner/manager, pas à un employee ---
  const { data: branchCasa, error: branchErr } = await owner.client
    .from('branches')
    .insert({ agency_id: agency.id, nom: 'Casablanca', ville: 'Casablanca' })
    .select()
    .single();
  record('Owner peut créer une filiale', !branchErr, branchErr?.message ?? `id=${branchCasa?.id}`);

  await inviteMember(owner, agency.id, manager, 'manager');
  await inviteMember(owner, agency.id, employee, 'employee', branchCasa.id);
  await inviteMember(owner, agency.id, employee2, 'employee');

  const { data: branchByEmployee, error: branchByEmployeeErr } = await employee.client
    .from('branches')
    .insert({ agency_id: agency.id, nom: 'Rabat' })
    .select();
  record(
    "Un employee ne peut PAS créer de filiale",
    !!branchByEmployeeErr || (branchByEmployee ?? []).length === 0,
    branchByEmployeeErr?.message ?? `AUCUNE ERREUR — ${(branchByEmployee ?? []).length} ligne(s) créée(s) !`
  );

  // --- 2. L'invitation propage bien la filiale au nouveau membre ---
  const employeeRow = await memberRow(agency.id, employee.id);
  record(
    "L'invitation avec filiale affecte bien le nouveau membre à cette filiale",
    employeeRow.branch_id === branchCasa.id,
    `branch_id=${employeeRow.branch_id}`
  );
  const employee2Row = await memberRow(agency.id, employee2.id);
  record(
    'Sans filiale choisie, le membre reste rattaché à l\'agence (branch_id null)',
    employee2Row.branch_id === null,
    `branch_id=${employee2Row.branch_id}`
  );

  // --- 2b. Accès par filiale : sans filiale = toutes, avec filiale = la sienne ---
  const { data: branchRabat } = await owner.client
    .from('branches')
    .insert({ agency_id: agency.id, nom: 'Rabat', ville: 'Rabat' })
    .select()
    .single();
  const { data: carCasa } = await owner.client
    .from('vehicles')
    .insert({ agency_id: agency.id, branch_id: branchCasa.id, immatriculation: '1111-A-1', marque: 'Dacia', modele: 'Logan' })
    .select()
    .single();
  const { data: carRabat } = await owner.client
    .from('vehicles')
    .insert({ agency_id: agency.id, branch_id: branchRabat.id, immatriculation: '2222-A-1', marque: 'Renault', modele: 'Clio' })
    .select()
    .single();
  const { data: seenByBranchEmployee } = await employee.client.from('vehicles').select('id').eq('agency_id', agency.id);
  record(
    'Employé rattaché à Casablanca : voit uniquement les véhicules de Casablanca',
    (seenByBranchEmployee ?? []).length === 1 && seenByBranchEmployee[0].id === carCasa?.id,
    `véhicules vus: ${(seenByBranchEmployee ?? []).length}`
  );
  const { data: seenByAllBranches } = await employee2.client.from('vehicles').select('id').eq('agency_id', agency.id);
  record(
    "Employé sans filiale : voit les véhicules de toutes les filiales",
    (seenByAllBranches ?? []).length === 2,
    `véhicules vus: ${(seenByAllBranches ?? []).length}`
  );
  const { data: updatedOther } = await employee.client
    .from('vehicles')
    .update({ kilometrage: 1 })
    .eq('id', carRabat?.id)
    .select();
  record(
    "Employé de Casablanca ne peut PAS modifier un véhicule de Rabat",
    (updatedOther ?? []).length === 0,
    `lignes modifiées: ${(updatedOther ?? []).length}`
  );
  const { data: ownCar } = await employee.client
    .from('vehicles')
    .insert({ agency_id: agency.id, immatriculation: '3333-A-1', marque: 'Kia', modele: 'Picanto' })
    .select()
    .single();
  record(
    "Un véhicule créé par un employé de filiale est rattaché à sa filiale",
    ownCar?.branch_id === branchCasa.id,
    `branch_id=${ownCar?.branch_id}`
  );
  const { error: otherBranchInsertErr } = await employee.client
    .from('vehicles')
    .insert({ agency_id: agency.id, branch_id: branchRabat.id, immatriculation: '4444-A-1', marque: 'Kia', modele: 'Rio' });
  record(
    "Employé de Casablanca ne peut PAS créer un véhicule dans Rabat",
    !!otherBranchInsertErr,
    otherBranchInsertErr?.message ?? 'AUCUNE ERREUR'
  );

  // --- 3. Isolation entre agences ---
  const { data: seenByOutsider } = await outsider.client.from('branches').select('id').eq('agency_id', agency.id);
  record("Un membre d'une autre agence ne voit PAS les filiales de A", (seenByOutsider ?? []).length === 0, `lignes vues: ${(seenByOutsider ?? []).length}`);

  // --- 4. Profil : chacun peut modifier SA fiche, mais pas son propre rôle ni
  // celle d'un autre membre (vérifié avant les suppressions ci-dessous, pour
  // cibler des lignes qui existent encore) ---
  const { error: selfUpdateErr } = await employee.client
    .from('agency_members')
    .update({ prenom: 'Karim', nom: 'Alaoui', nom_complet: 'Karim Alaoui' })
    .eq('id', employeeRow.id);
  record('Un employee peut modifier son propre prénom/nom', !selfUpdateErr, selfUpdateErr?.message ?? 'ok');

  const { error: selfRoleEscalationErr } = await employee.client
    .from('agency_members')
    .update({ role: 'owner' })
    .eq('id', employeeRow.id);
  record(
    "Un employee ne peut PAS changer son propre rôle",
    !!selfRoleEscalationErr,
    selfRoleEscalationErr?.message ?? 'AUCUNE ERREUR — rôle modifié !'
  );

  const { data: otherUpdateData, error: otherUpdateErr } = await employee.client
    .from('agency_members')
    .update({ prenom: 'Pirate' })
    .eq('id', employee2Row.id)
    .select();
  record(
    "Un employee ne peut PAS modifier la fiche d'un autre membre",
    !!otherUpdateErr || (otherUpdateData ?? []).length === 0,
    otherUpdateErr?.message ?? `AUCUNE ERREUR — ${(otherUpdateData ?? []).length} ligne(s) modifiée(s) !`
  );

  // --- 5. Suppression : manager peut retirer un employee, pas un autre manager ---
  const { data: removedEmployee, error: removeEmployeeErr } = await manager.client
    .from('agency_members')
    .delete()
    .eq('id', employee2Row.id)
    .select();
  record(
    'Un manager peut retirer un employee',
    !removeEmployeeErr && (removedEmployee ?? []).length === 1,
    removeEmployeeErr?.message ?? `lignes supprimées: ${(removedEmployee ?? []).length}`
  );

  const managerRow = await memberRow(agency.id, manager.id);
  const { data: removedManager, error: removeManagerErr } = await employee.client
    .from('agency_members')
    .delete()
    .eq('id', managerRow.id)
    .select();
  record(
    "Un employee ne peut PAS retirer un manager",
    !!removeManagerErr || (removedManager ?? []).length === 0,
    removeManagerErr?.message ?? `AUCUNE ERREUR — ${(removedManager ?? []).length} ligne(s) supprimée(s) !`
  );

  const { data: managerRemovedByManager, error: managerRemovedByManagerErr } = await manager.client
    .from('agency_members')
    .delete()
    .eq('id', managerRow.id)
    .select();
  record(
    "Un manager ne peut PAS retirer un autre manager (ni lui-même via cette policy)",
    !!managerRemovedByManagerErr || (managerRemovedByManager ?? []).length === 0,
    managerRemovedByManagerErr?.message ?? `AUCUNE ERREUR — ${(managerRemovedByManager ?? []).length} ligne(s) supprimée(s) !`
  );

  const { data: managerRemovedByOwner, error: managerRemovedByOwnerErr } = await owner.client
    .from('agency_members')
    .delete()
    .eq('id', managerRow.id)
    .select();
  record(
    'Le owner peut retirer un manager',
    !managerRemovedByOwnerErr && (managerRemovedByOwner ?? []).length === 1,
    managerRemovedByOwnerErr?.message ?? `lignes supprimées: ${(managerRemovedByOwner ?? []).length}`
  );

  // --- 6. Journal d'audit : visible uniquement par le owner ---
  const { data: logForOwner, error: logForOwnerErr } = await owner.client.from('agency_audit_log').select('*').eq('agency_id', agency.id);
  record('Le owner voit le journal de son agence', !logForOwnerErr && (logForOwner ?? []).length > 0, `lignes vues: ${(logForOwner ?? []).length}`);

  const { data: logForEmployee } = await employee.client.from('agency_audit_log').select('*').eq('agency_id', agency.id);
  record("Un employee ne voit PAS le journal (réservé au owner)", (logForEmployee ?? []).length === 0, `lignes vues: ${(logForEmployee ?? []).length}`);

  const actions = new Set((logForOwner ?? []).map((row) => row.action));
  record(
    "Le journal contient bien la création de filiale, l'invitation et l'arrivée d'un membre",
    actions.has('branch_created') && actions.has('invite_created') && actions.has('member_joined'),
    `actions présentes: ${[...actions].join(', ')}`
  );
  record(
    'Le journal contient bien le retrait du membre par le manager',
    actions.has('member_removed'),
    `actions présentes: ${[...actions].join(', ')}`
  );

  const { data: logForOutsider } = await outsider.client.from('agency_audit_log').select('*').eq('agency_id', agency.id);
  record("Un owner d'une autre agence ne voit PAS le journal de A", (logForOutsider ?? []).length === 0, `lignes vues: ${(logForOutsider ?? []).length}`);

  // --- 7. Avatars : isolation entre agences ---
  const fakeFile = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
  const avatarPath = `${agency.id}/${employee.id}/avatar-test.jpg`;
  const { error: avatarUploadErr } = await employee.client.storage.from('member-avatars').upload(avatarPath, fakeFile, { contentType: 'image/jpeg' });
  record('Un membre peut téléverser son propre avatar', !avatarUploadErr, avatarUploadErr?.message ?? 'ok');

  const { error: avatarForOtherErr } = await employee.client.storage
    .from('member-avatars')
    .upload(`${agency.id}/${manager.id}/avatar-test.jpg`, fakeFile, { contentType: 'image/jpeg' });
  record(
    "Un membre ne peut PAS téléverser l'avatar d'un autre membre",
    !!avatarForOtherErr,
    avatarForOtherErr?.message ?? 'AUCUNE ERREUR !'
  );

  const { error: crossAgencyAvatarErr } = await outsider.client.storage
    .from('member-avatars')
    .upload(avatarPath, fakeFile, { contentType: 'image/jpeg', upsert: true });
  record(
    "Un membre d'une autre agence ne peut PAS écrire dans ce dossier",
    !!crossAgencyAvatarErr,
    crossAgencyAvatarErr?.message ?? 'AUCUNE ERREUR !'
  );

  // --- Bilan ---
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== BILAN ÉQUIPE & FILIALES ===\n${passed}/${total} contrôles réussis`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
