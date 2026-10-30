// Audit du module Maintenance (chantier B) — à exécuter contre une instance
// Supabase LOCALE uniquement (npx supabase start). Vérifie l'isolation RLS
// ET le comportement du déclencheur d'immobilisation automatique du
// véhicule (migration 0020). Crée ses propres comptes/agences/véhicules de
// test jetables.
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/maintenance-rls-audit.mjs
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
  const email = `maint-audit-${Date.now()}-${userCounter}@example.test`;
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

const baseVehicle = {
  marque: 'Renault',
  modele: 'Clio',
  carburant: 'essence',
  kilometrage: 15000,
  statut: 'disponible',
  prix_jour: 220,
};

async function createVehicle(owner, agencyId, overrides = {}) {
  const { data, error } = await owner.client
    .from('vehicles')
    .insert({ ...baseVehicle, ...overrides, agency_id: agencyId, immatriculation: `TEST-${Date.now()}-${Math.random()}` })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function vehicleStatus(vehicleId) {
  const { data, error } = await admin.from('vehicles').select('statut').eq('id', vehicleId).single();
  if (error) throw error;
  return data.statut;
}

async function main() {
  const ownerA = await createUser();
  const employeeA = await createUser();
  const ownerB = await createUser();

  const agencyA = await createAgencyWithOwner(ownerA, 'Agence Maintenance A');
  await inviteMember(ownerA, agencyA.id, employeeA, 'employee');

  const vehicleA = await createVehicle(ownerA, agencyA.id);

  // --- 1. Isolation : un membre d'une autre agence ne voit pas les échéances ---
  const { data: itemA, error: createErr } = await employeeA.client
    .from('maintenance_items')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleA.id, type: 'vidange', echeance_km: 20000 })
    .select()
    .single();
  record('Employee peut créer une échéance pour son agence', !createErr, createErr?.message ?? `id=${itemA?.id}`);

  const { data: seenByB } = await ownerB.client.from('maintenance_items').select('id').eq('id', itemA.id);
  record('Un membre de B ne peut PAS lire les échéances de A', (seenByB ?? []).length === 0, `lignes vues: ${(seenByB ?? []).length}`);

  const { data: deletedByEmployee } = await employeeA.client.from('maintenance_items').delete().eq('id', itemA.id).select();
  record(
    'Employee ne peut PAS supprimer une échéance (réservé owner/manager)',
    (deletedByEmployee ?? []).length === 0,
    `lignes supprimées: ${(deletedByEmployee ?? []).length}`
  );

  // --- 2. Démarrage d'une intervention planifiée => immobilisation ---
  const { error: startErr } = await employeeA.client
    .from('maintenance_items')
    .update({ statut: 'en_cours' })
    .eq('id', itemA.id);
  const statusAfterStart = await vehicleStatus(vehicleA.id);
  record(
    "Démarrer l'intervention immobilise le véhicule (statut -> maintenance)",
    !startErr && statusAfterStart === 'maintenance',
    startErr?.message ?? `statut véhicule: ${statusAfterStart}`
  );

  // --- 3. Clôture avec garage/coût/pièces => véhicule redevient disponible ---
  const { error: completeErr } = await employeeA.client
    .from('maintenance_items')
    .update({
      statut: 'effectuee',
      garage: 'Garage Test',
      cout: 450.5,
      pieces_remplacees: 'Plaquettes de frein',
      date_intervention: new Date().toISOString().slice(0, 10),
    })
    .eq('id', itemA.id);
  const statusAfterComplete = await vehicleStatus(vehicleA.id);
  record(
    "Clôturer l'intervention libère le véhicule (statut -> disponible)",
    !completeErr && statusAfterComplete === 'disponible',
    completeErr?.message ?? `statut véhicule: ${statusAfterComplete}`
  );

  const { data: completedItem } = await admin.from('maintenance_items').select('*').eq('id', itemA.id).single();
  record(
    'Le coût et le garage sont bien enregistrés',
    completedItem.cout === '450.50' || Number(completedItem.cout) === 450.5,
    `cout=${completedItem.cout} garage=${completedItem.garage}`
  );

  // --- 4. Panne signalée directement en_cours (immobilisation immédiate) ---
  const vehiclePanne = await createVehicle(ownerA, agencyA.id);
  const { error: panneErr } = await employeeA.client
    .from('maintenance_items')
    .insert({ agency_id: agencyA.id, vehicle_id: vehiclePanne.id, type: 'panne', statut: 'en_cours' })
    .select()
    .single();
  const statusAfterPanne = await vehicleStatus(vehiclePanne.id);
  record(
    'Signaler une panne (en_cours dès la création) immobilise le véhicule',
    !panneErr && statusAfterPanne === 'maintenance',
    panneErr?.message ?? `statut véhicule: ${statusAfterPanne}`
  );

  // --- 5. Deux interventions concurrentes : le véhicule reste immobilisé tant
  // qu'il en reste une en cours ---
  const vehicleConcurrent = await createVehicle(ownerA, agencyA.id);
  const { data: itemC1 } = await employeeA.client
    .from('maintenance_items')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleConcurrent.id, type: 'vidange', statut: 'en_cours' })
    .select()
    .single();
  const { data: itemC2 } = await employeeA.client
    .from('maintenance_items')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleConcurrent.id, type: 'freins', statut: 'en_cours' })
    .select()
    .single();

  await employeeA.client.from('maintenance_items').update({ statut: 'effectuee' }).eq('id', itemC1.id);
  const statusWhileOtherActive = await vehicleStatus(vehicleConcurrent.id);
  record(
    "Le véhicule reste immobilisé tant qu'une autre intervention est en cours",
    statusWhileOtherActive === 'maintenance',
    `statut véhicule: ${statusWhileOtherActive}`
  );

  await employeeA.client.from('maintenance_items').update({ statut: 'effectuee' }).eq('id', itemC2.id);
  const statusAfterBothDone = await vehicleStatus(vehicleConcurrent.id);
  record(
    'Le véhicule est libéré une fois toutes les interventions terminées',
    statusAfterBothDone === 'disponible',
    `statut véhicule: ${statusAfterBothDone}`
  );

  // --- 6. Stockage des factures : isolation entre agences ---
  const pathA = `${agencyA.id}/${itemA.id}/facture-test.jpg`;
  const fakeFile = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
  const { error: uploadErr } = await employeeA.client.storage.from('maintenance-documents').upload(pathA, fakeFile, { contentType: 'image/jpeg' });
  record('Owner/employee peut téléverser une facture pour sa propre agence', !uploadErr, uploadErr?.message ?? 'ok');

  const { error: crossUploadErr } = await ownerB.client.storage
    .from('maintenance-documents')
    .upload(pathA, fakeFile, { contentType: 'image/jpeg', upsert: true });
  record(
    "Un membre de B ne peut PAS écrire dans le dossier de factures de A",
    !!crossUploadErr,
    crossUploadErr?.message ?? 'AUCUNE ERREUR'
  );

  const { data: crossReadData, error: crossReadErr } = await ownerB.client.storage.from('maintenance-documents').download(pathA);
  record(
    "Un membre de B ne peut PAS lire les factures de A",
    !!crossReadErr || !crossReadData,
    crossReadErr?.message ?? 'lecture réussie !'
  );

  // --- Bilan ---
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== BILAN MAINTENANCE ===\n${passed}/${total} contrôles réussis`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
