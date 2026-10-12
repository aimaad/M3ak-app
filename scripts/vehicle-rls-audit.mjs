// Audit RLS du module Flotte — à exécuter contre une instance Supabase LOCALE
// uniquement (npx supabase start). Crée ses propres comptes/agences/véhicules
// de test jetables.
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/vehicle-rls-audit.mjs
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
  const email = `veh-audit-${Date.now()}-${userCounter}@example.test`;
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
}

const baseVehicle = {
  marque: 'Dacia',
  modele: 'Logan',
  annee: 2022,
  categorie: 'economique',
  couleur: 'Blanc',
  nombre_places: 5,
  transmission: 'manuelle',
  carburant: 'diesel',
  kilometrage: 10000,
  niveau_carburant: 80,
  statut: 'disponible',
  prix_jour: 250,
  prix_semaine: 1500,
  prix_mois: 5000,
  description: 'Véhicule de test',
};

async function main() {
  const ownerA = await createUser();
  const managerA = await createUser();
  const employeeA = await createUser();
  const ownerB = await createUser();

  const agencyA = await createAgencyWithOwner(ownerA, 'Agence Flotte A');
  const agencyB = await createAgencyWithOwner(ownerB, 'Agence Flotte B');
  await inviteMember(ownerA, agencyA.id, managerA, 'manager');
  await inviteMember(ownerA, agencyA.id, employeeA, 'employee');

  const plate = `TEST-${Date.now()}`;

  // --- 1/2/11 : création et persistance réelle en base ---
  const { data: vehicle, error: createErr } = await ownerA.client
    .from('vehicles')
    .insert({ ...baseVehicle, agency_id: agencyA.id, immatriculation: plate })
    .select()
    .single();
  record('1/2. Création du véhicule et persistance', !createErr && vehicle?.immatriculation === plate, createErr?.message ?? `id=${vehicle?.id}`);

  const freshOwnerASession = createClient(URL, ANON);
  await freshOwnerASession.auth.signInWithPassword({ email: ownerA.email, password: 'Audit-Test-P@ssw0rd-1234' });
  const { data: reread, error: rereadErr } = await freshOwnerASession.from('vehicles').select('*').eq('id', vehicle.id).single();
  record(
    '11. Les données persistent après reconnexion (nouvelle session)',
    !rereadErr && reread?.marque === 'Dacia' && Number(reread?.prix_semaine) === 1500,
    rereadErr?.message ?? JSON.stringify({ marque: reread?.marque, prix_semaine: reread?.prix_semaine })
  );

  // --- 5. Immatriculation en double : refusée dans la même agence ---
  const { error: dupErr } = await ownerA.client
    .from('vehicles')
    .insert({ ...baseVehicle, agency_id: agencyA.id, immatriculation: plate });
  record('5. Immatriculation en double refusée (même agence)', dupErr?.code === '23505', dupErr?.message ?? 'AUCUNE ERREUR — doublon accepté !');

  // --- La même immatriculation reste possible dans une AUTRE agence ---
  const { error: otherAgencyErr } = await ownerB.client
    .from('vehicles')
    .insert({ ...baseVehicle, agency_id: agencyB.id, immatriculation: plate });
  record("Même immatriculation autorisée dans une autre agence", !otherAgencyErr, otherAgencyErr?.message ?? 'ok');

  // --- VIN en double : refusé dans la même agence, autorisé si VIN absent ---
  const vin = `VIN-TEST-${Date.now()}`;
  const { error: vinSetErr } = await ownerA.client.from('vehicles').update({ vin }).eq('id', vehicle.id);
  record("Le VIN peut être renseigné sur un véhicule existant", !vinSetErr, vinSetErr?.message ?? 'ok');

  const { error: vinDupErr } = await ownerA.client
    .from('vehicles')
    .insert({ ...baseVehicle, agency_id: agencyA.id, immatriculation: `${plate}-2`, vin });
  record('VIN en double refusé (même agence)', vinDupErr?.code === '23505', vinDupErr?.message ?? 'AUCUNE ERREUR — doublon de VIN accepté !');

  const { data: twoNullVins, error: nullVinErr } = await ownerA.client
    .from('vehicles')
    .insert([
      { ...baseVehicle, agency_id: agencyA.id, immatriculation: `${plate}-3` },
      { ...baseVehicle, agency_id: agencyA.id, immatriculation: `${plate}-4` },
    ])
    .select();
  record(
    'Plusieurs véhicules sans VIN (null) restent possibles dans la même agence',
    !nullVinErr && (twoNullVins ?? []).length === 2,
    nullVinErr?.message ?? `lignes créées: ${(twoNullVins ?? []).length}`
  );

  // --- 4/8. Permissions : employee peut créer/modifier, mais pas archiver ---
  const { data: empUpdate, error: empUpdateErr } = await employeeA.client
    .from('vehicles')
    .update({ kilometrage: 15000 })
    .eq('id', vehicle.id)
    .select();
  record('4. Employee peut modifier un véhicule de son agence', !empUpdateErr && (empUpdate ?? []).length === 1, empUpdateErr?.message ?? 'ok');

  const { data: empArchive, error: empArchiveErr } = await employeeA.client
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', vehicle.id)
    .select();
  record(
    "8. Employee NE PEUT PAS archiver (réservé owner/manager)",
    !!empArchiveErr || (empArchive ?? []).length === 0,
    empArchiveErr?.message ?? `AUCUNE ERREUR — ${(empArchive ?? []).length} ligne(s) archivée(s) !`
  );

  // --- Chemin légitime : manager archive puis owner réactive ---
  const { data: managerArchive, error: managerArchiveErr } = await managerA.client
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', vehicle.id)
    .select();
  record('8. Manager peut archiver un véhicule', !managerArchiveErr && (managerArchive ?? []).length === 1, managerArchiveErr?.message ?? 'ok');

  const { data: ownerReactivate, error: ownerReactivateErr } = await ownerA.client
    .from('vehicles')
    .update({ archived_at: null })
    .eq('id', vehicle.id)
    .select();
  record('8. Owner peut réactiver un véhicule archivé', !ownerReactivateErr && (ownerReactivate ?? []).length === 1, ownerReactivateErr?.message ?? 'ok');

  // --- 9/10. Isolation stricte entre agences ---
  const { data: vehicleB } = await ownerB.client.from('vehicles').select('id').eq('agency_id', agencyB.id).limit(1).single();

  const { data: crossRead } = await managerA.client.from('vehicles').select('id').eq('id', vehicleB.id);
  record('9. Un membre de A ne peut PAS lire un véhicule de B', (crossRead ?? []).length === 0, `lignes vues: ${(crossRead ?? []).length}`);

  const { data: crossUpdate } = await managerA.client.from('vehicles').update({ kilometrage: 1 }).eq('id', vehicleB.id).select();
  record('10. Un membre de A ne peut PAS modifier un véhicule de B', (crossUpdate ?? []).length === 0, `lignes modifiées: ${(crossUpdate ?? []).length}`);

  const { data: crossDelete } = await ownerB.client.from('vehicles').delete().eq('id', vehicle.id).select();
  record("Owner B ne peut PAS supprimer un véhicule de l'agence A", (crossDelete ?? []).length === 0, `lignes supprimées: ${(crossDelete ?? []).length}`);

  // --- 7. Téléversement sécurisé : stockage isolé par agence ---
  const docPathA = `${agencyA.id}/${vehicle.id}/assurance-${Date.now()}.jpg`;
  const tinyFile = new Blob([new Uint8Array([1, 2, 3])]);

  const { error: uploadOwnErr } = await ownerA.client.storage.from('vehicle-documents').upload(docPathA, tinyFile);
  record('7. Owner peut téléverser un document pour son propre véhicule', !uploadOwnErr, uploadOwnErr?.message ?? 'ok');

  const docPathB = `${agencyB.id}/${vehicleB.id}/assurance-${Date.now()}.jpg`;
  const { error: uploadCrossErr } = await managerA.client.storage.from('vehicle-documents').upload(docPathB, tinyFile);
  record("7. Un membre de A ne peut PAS écrire dans le dossier de documents de B", !!uploadCrossErr, uploadCrossErr?.message ?? 'AUCUNE ERREUR — upload cross-tenant accepté !');

  const { data: downloadCross, error: downloadCrossErr } = await managerA.client.storage.from('vehicle-documents').download(docPathB);
  record(
    "7. Un membre de A ne peut PAS lire les documents de B",
    !downloadCross || !!downloadCrossErr,
    downloadCrossErr?.message ?? (downloadCross ? 'AUCUNE ERREUR — lecture cross-tenant acceptée !' : 'ok')
  );

  // .remove() ne renvoie pas forcément d'erreur si RLS bloque silencieusement
  // la suppression (0 ligne supprimée) : on vérifie l'état réel du fichier,
  // pas seulement l'absence d'erreur retournée par l'appel.
  await employeeA.client.storage.from('vehicle-documents').remove([docPathA]);
  const { data: stillThere } = await admin.storage.from('vehicle-documents').list(`${agencyA.id}/${vehicle.id}`);
  const fileStillExists = (stillThere ?? []).some((f) => docPathA.endsWith(f.name));
  record(
    "7. Employee ne peut PAS supprimer un document (réservé owner/manager)",
    fileStillExists,
    fileStillExists ? 'fichier toujours présent (suppression bloquée)' : 'FICHIER SUPPRIMÉ — suppression acceptée pour un employee !'
  );

  // --- Bilan ---
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== BILAN FLOTTE ===');
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
