// Audit RLS du module Clients & Conducteurs — à exécuter contre une instance
// Supabase LOCALE uniquement (npx supabase start). Crée ses propres comptes/
// agences/clients de test jetables.
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/customer-rls-audit.mjs
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
  const email = `cust-audit-${Date.now()}-${userCounter}@example.test`;
  const password = 'Audit-Test-P@ssw0rd-1234';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function createAgencyWithOwner(owner, nom) {
  const { data: agency, error } = await owner.client.from('agencies').insert({ nom, created_by: owner.id }).select().single();
  if (error) throw error;
  await owner.client.from('agency_members').insert({ agency_id: agency.id, user_id: owner.id, role: 'owner', nom_complet: 'Owner' });
  return agency;
}

async function inviteMember(owner, agencyId, member, role) {
  const { data: invite, error } = await owner.client.rpc('create_agency_invite', {
    p_agency_id: agencyId,
    p_email: member.email,
    p_prenom: 'Test',
    p_nom: 'Audit',
    p_role: role,
    p_branch_id: null,
  });
  if (error) throw error;
  const { error: redeemErr } = await member.client.rpc('redeem_invite', { invite_code: invite.code });
  if (redeemErr) throw redeemErr;
  return invite;
}

const baseCustomer = {
  nom_complet: 'Youssef El Amrani',
  prenom: 'Youssef',
  nom: 'El Amrani',
  telephone: '+212661234567',
  email: 'youssef@example.test',
  ville: 'Casablanca',
  pays: 'Maroc',
  type_client: 'particulier',
  notes: 'Client fidèle',
};

async function main() {
  const ownerA = await createUser();
  const managerA = await createUser();
  const employeeA = await createUser();
  const ownerB = await createUser();

  const agencyA = await createAgencyWithOwner(ownerA, 'Agence Clients A');
  const agencyB = await createAgencyWithOwner(ownerB, 'Agence Clients B');
  await inviteMember(ownerA, agencyA.id, managerA, 'manager');
  await inviteMember(ownerA, agencyA.id, employeeA, 'employee');

  // --- 1/2. Création et persistance réelle en base ---
  const { data: customer, error: createErr } = await ownerA.client
    .from('customers')
    .insert({ ...baseCustomer, agency_id: agencyA.id })
    .select()
    .single();
  record('1/2. Création du client et persistance', !createErr && customer?.nom_complet === 'Youssef El Amrani', createErr?.message ?? `id=${customer?.id}`);

  const freshSession = createClient(URL, ANON);
  await freshSession.auth.signInWithPassword({ email: ownerA.email, password: 'Audit-Test-P@ssw0rd-1234' });
  const { data: reread, error: rereadErr } = await freshSession.from('customers').select('*').eq('id', customer.id).single();
  record(
    '2. Les données persistent après reconnexion (nouvelle session)',
    !rereadErr && reread?.notes === 'Client fidèle' && reread?.ville === 'Casablanca',
    rereadErr?.message ?? JSON.stringify({ notes: reread?.notes, ville: reread?.ville })
  );

  // --- 4/8. Permissions : employee peut créer/modifier, mais pas archiver ---
  const { data: empUpdate, error: empUpdateErr } = await employeeA.client
    .from('customers')
    .update({ ville: 'Rabat' })
    .eq('id', customer.id)
    .select();
  record('4. Employee peut modifier un client de son agence', !empUpdateErr && (empUpdate ?? []).length === 1, empUpdateErr?.message ?? 'ok');

  const { data: empArchive, error: empArchiveErr } = await employeeA.client
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', customer.id)
    .select();
  record(
    '8. Employee ne peut PAS archiver un client (réservé owner/manager)',
    !!empArchiveErr || (empArchive ?? []).length === 0,
    empArchiveErr?.message ?? `AUCUNE ERREUR — ${(empArchive ?? []).length} ligne(s) archivée(s) !`
  );

  // --- Chemin légitime : manager archive puis owner réactive ---
  const { data: managerArchive, error: managerArchiveErr } = await managerA.client
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', customer.id)
    .select();
  record('Manager peut archiver un client', !managerArchiveErr && (managerArchive ?? []).length === 1, managerArchiveErr?.message ?? 'ok');

  const { data: ownerReactivate, error: ownerReactivateErr } = await ownerA.client
    .from('customers')
    .update({ archived_at: null })
    .eq('id', customer.id)
    .select();
  record('Owner peut réactiver un client archivé', !ownerReactivateErr && (ownerReactivate ?? []).length === 1, ownerReactivateErr?.message ?? 'ok');

  // --- updated_at est bien mis à jour automatiquement ---
  const { data: beforeUpdate } = await ownerA.client.from('customers').select('updated_at').eq('id', customer.id).single();
  await new Promise((r) => setTimeout(r, 1100));
  await ownerA.client.from('customers').update({ notes: 'Note modifiée' }).eq('id', customer.id);
  const { data: afterUpdate } = await ownerA.client.from('customers').select('updated_at').eq('id', customer.id).single();
  record(
    'updated_at est automatiquement rafraîchi à chaque modification',
    new Date(afterUpdate.updated_at).getTime() > new Date(beforeUpdate.updated_at).getTime(),
    `before=${beforeUpdate.updated_at} after=${afterUpdate.updated_at}`
  );

  // --- 9/10. Isolation stricte entre agences ---
  const { data: customerB } = await ownerB.client
    .from('customers')
    .insert({ ...baseCustomer, agency_id: agencyB.id, telephone: '+212600000099' })
    .select()
    .single();

  const { data: crossRead } = await managerA.client.from('customers').select('id').eq('id', customerB.id);
  record('9. Un membre de A ne peut PAS lire un client de B', (crossRead ?? []).length === 0, `lignes vues: ${(crossRead ?? []).length}`);

  const { data: crossUpdate } = await managerA.client.from('customers').update({ ville: 'Piraté' }).eq('id', customerB.id).select();
  record('10. Un membre de A ne peut PAS modifier un client de B', (crossUpdate ?? []).length === 0, `lignes modifiées: ${(crossUpdate ?? []).length}`);

  const { data: crossDelete } = await ownerB.client.from('customers').delete().eq('id', customer.id).select();
  record("Owner B ne peut PAS supprimer un client de l'agence A", (crossDelete ?? []).length === 0, `lignes supprimées: ${(crossDelete ?? []).length}`);

  // --- 11. Conducteurs supplémentaires ---
  const { data: driver, error: driverErr } = await employeeA.client
    .from('drivers')
    .insert({ agency_id: agencyA.id, customer_id: customer.id, nom_complet: 'Samir Tazi', telephone: '0661112233' })
    .select()
    .single();
  record('11. Employee peut ajouter un conducteur supplémentaire', !driverErr && driver?.nom_complet === 'Samir Tazi', driverErr?.message ?? 'ok');

  await employeeA.client.from('drivers').insert({
    agency_id: agencyB.id,
    customer_id: customerB.id,
    nom_complet: 'Conducteur fantôme',
  });
  const { data: crossDriverInsert } = await admin.from('drivers').select('id').eq('customer_id', customerB.id);
  record(
    "11. Un membre de A ne peut PAS créer de conducteur pour un client de B",
    (crossDriverInsert ?? []).length === 0,
    `lignes réellement créées (vues en admin): ${(crossDriverInsert ?? []).length}`
  );

  const { data: crossDriverRead } = await managerA.client.from('drivers').select('id').eq('customer_id', customerB.id);
  record(
    "11. Un membre de A ne peut PAS lire les conducteurs du client de B",
    (crossDriverRead ?? []).length === 0,
    `lignes vues: ${(crossDriverRead ?? []).length}`
  );

  const { data: empDriverDelete } = await employeeA.client.from('drivers').delete().eq('id', driver.id).select();
  record(
    '8. Employee ne peut PAS supprimer un conducteur (réservé owner/manager)',
    (empDriverDelete ?? []).length === 0,
    `lignes supprimées: ${(empDriverDelete ?? []).length}`
  );

  const { data: managerDriverDelete, error: managerDriverDeleteErr } = await managerA.client
    .from('drivers')
    .delete()
    .eq('id', driver.id)
    .select();
  record('Manager peut supprimer un conducteur', !managerDriverDeleteErr && (managerDriverDelete ?? []).length === 1, managerDriverDeleteErr?.message ?? 'ok');

  // --- 7. Documents clients : isolation du stockage entre agences ---
  const docPathA = `${agencyA.id}/${customer.id}/cin-${Date.now()}.jpg`;
  const tinyFile = new Blob([new Uint8Array([1, 2, 3])]);

  const { error: uploadOwnErr } = await ownerA.client.storage.from('client-documents').upload(docPathA, tinyFile);
  record('7. Owner peut téléverser un document pour son propre client', !uploadOwnErr, uploadOwnErr?.message ?? 'ok');

  const docPathB = `${agencyB.id}/${customerB.id}/cin-${Date.now()}.jpg`;
  const { error: uploadCrossErr } = await managerA.client.storage.from('client-documents').upload(docPathB, tinyFile);
  record("7. Un membre de A ne peut PAS écrire dans le dossier de documents de B", !!uploadCrossErr, uploadCrossErr?.message ?? 'AUCUNE ERREUR — upload cross-tenant accepté !');

  const { data: downloadCross, error: downloadCrossErr } = await managerA.client.storage.from('client-documents').download(docPathB);
  record(
    "7. Un membre de A ne peut PAS lire les documents de B",
    !downloadCross || !!downloadCrossErr,
    downloadCrossErr?.message ?? (downloadCross ? 'AUCUNE ERREUR — lecture cross-tenant acceptée !' : 'ok')
  );

  await employeeA.client.storage.from('client-documents').remove([docPathA]);
  const { data: stillThere } = await admin.storage.from('client-documents').list(`${agencyA.id}/${customer.id}`);
  const fileStillExists = (stillThere ?? []).some((f) => docPathA.endsWith(f.name));
  record(
    "7. Employee ne peut PAS supprimer un document (réservé owner/manager)",
    fileStillExists,
    fileStillExists ? 'fichier toujours présent (suppression bloquée)' : 'FICHIER SUPPRIMÉ — suppression acceptée pour un employee !'
  );

  // --- Bilan ---
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== BILAN CLIENTS & CONDUCTEURS ===');
  console.log(`${results.length - failed.length}/${results.length} contrôles réussis`);
  if (failed.length) {
    console.log('\nÉchecs :');
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('ERREUR SCRIPT:', err);
  process.exit(1);
});
