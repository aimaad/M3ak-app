// Audit RLS + cohérence du module Contrats — à exécuter contre une instance
// Supabase LOCALE uniquement (npx supabase start).
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/contract-rls-audit.mjs
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
  const email = `contract-audit-${Date.now()}-${userCounter}@example.test`;
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
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await owner.client.from('agency_invites').insert({
    agency_id: agencyId,
    code,
    role,
    created_by: owner.id,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  const { error } = await member.client.rpc('redeem_invite', { invite_code: code });
  if (error) throw error;
}

async function main() {
  const ownerA = await createUser();
  const ownerB = await createUser();
  const employeeA = await createUser();

  const agencyA = await createAgencyWithOwner(ownerA, 'Agence Contrats A');
  const agencyB = await createAgencyWithOwner(ownerB, 'Agence Contrats B');
  await inviteMember(ownerA, agencyA.id, employeeA, 'employee');

  const { data: vehicleA } = await ownerA.client
    .from('vehicles')
    .insert({ agency_id: agencyA.id, immatriculation: `CA-${Date.now()}`, marque: 'Dacia', modele: 'Logan', carburant: 'diesel', statut: 'disponible', prix_jour: 300 })
    .select()
    .single();
  const { data: customerA } = await ownerA.client
    .from('customers')
    .insert({ agency_id: agencyA.id, nom_complet: 'Client Contrat A', telephone: '+212600000010' })
    .select()
    .single();
  const { data: rentalA } = await ownerA.client
    .from('rentals')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleA.id, customer_id: customerA.id, statut: 'confirmee', date_debut_prevue: '2026-08-01T09:00:00Z', date_fin_prevue: '2026-08-04T09:00:00Z', caution_montant: 2000 })
    .select()
    .single();

  const { data: vehicleB } = await ownerB.client
    .from('vehicles')
    .insert({ agency_id: agencyB.id, immatriculation: `CB-${Date.now()}`, marque: 'Renault', modele: 'Clio', carburant: 'essence', statut: 'disponible', prix_jour: 250 })
    .select()
    .single();
  const { data: customerB } = await ownerB.client
    .from('customers')
    .insert({ agency_id: agencyB.id, nom_complet: 'Client Contrat B', telephone: '+212600000011' })
    .select()
    .single();
  const { data: rentalB } = await ownerB.client
    .from('rentals')
    .insert({ agency_id: agencyB.id, vehicle_id: vehicleB.id, customer_id: customerB.id, statut: 'confirmee', date_debut_prevue: '2026-08-01T09:00:00Z', date_fin_prevue: '2026-08-04T09:00:00Z', caution_montant: 1500 })
    .select()
    .single();

  // --- 1. Création, numéro, instantané ---
  const { data: contract, error: createErr } = await ownerA.client
    .from('contracts')
    .insert({
      agency_id: agencyA.id,
      rental_id: rentalA.id,
      customer_nom: customerA.nom_complet,
      customer_telephone: customerA.telephone,
      vehicle_immatriculation: vehicleA.immatriculation,
      vehicle_marque: vehicleA.marque,
      vehicle_modele: vehicleA.modele,
      date_debut_prevue: rentalA.date_debut_prevue,
      date_fin_prevue: rentalA.date_fin_prevue,
      caution_montant: rentalA.caution_montant,
    })
    .select()
    .single();
  record('1. Création réelle + numéro généré automatiquement', !createErr && !!contract?.numero?.startsWith('CTR-'), createErr?.message ?? `numero=${contract?.numero}`);

  // --- Instantané : modifier le client ensuite ne change pas le contrat déjà créé ---
  await ownerA.client.from('customers').update({ nom_complet: 'Nom Changé Après Coup' }).eq('id', customerA.id);
  const { data: afterRename } = await ownerA.client.from('contracts').select('customer_nom').eq('id', contract.id).single();
  record("2. L'instantané du contrat ne change pas si le client est modifié ensuite", afterRename?.customer_nom === 'Client Contrat A', `customer_nom=${afterRename?.customer_nom}`);

  // --- Un seul contrat actif par réservation ---
  const { error: secondContractErr } = await ownerA.client.from('contracts').insert({
    agency_id: agencyA.id,
    rental_id: rentalA.id,
    customer_nom: customerA.nom_complet,
    vehicle_immatriculation: vehicleA.immatriculation,
    vehicle_marque: vehicleA.marque,
    vehicle_modele: vehicleA.modele,
    date_debut_prevue: rentalA.date_debut_prevue,
    date_fin_prevue: rentalA.date_fin_prevue,
    caution_montant: rentalA.caution_montant,
  });
  record('Un second contrat actif pour la même réservation est refusé', !!secondContractErr, secondContractErr?.message ?? 'AUCUNE ERREUR — deux contrats actifs créés !');

  // --- 3. Transitions de statut ---
  const { error: skipErr } = await ownerA.client.from('contracts').update({ statut: 'signe' }).eq('id', contract.id);
  record("Impossible de sauter 'pret_a_signer' (preparation -> signe direct)", !!skipErr, skipErr?.message ?? 'AUCUNE ERREUR — transition invalide acceptée !');

  const { error: readyErr } = await ownerA.client.from('contracts').update({ statut: 'pret_a_signer' }).eq('id', contract.id);
  record("preparation -> pret_a_signer autorisé", !readyErr, readyErr?.message ?? 'ok');

  // --- Signature : jamais automatique, exige une preuve ---
  const { error: signWithoutProofErr } = await ownerA.client.from('contracts').update({ statut: 'signe' }).eq('id', contract.id);
  record('La signature sans preuve (signed_at/signed_by) est refusée', !!signWithoutProofErr, signWithoutProofErr?.message ?? 'AUCUNE ERREUR — contrat signé sans preuve !');

  const { error: signWithProofErr } = await ownerA.client
    .from('contracts')
    .update({ statut: 'signe', signed_at: new Date().toISOString(), signed_by: ownerA.id })
    .eq('id', contract.id);
  record('La signature avec preuve (horodatage + auteur) est acceptée', !signWithProofErr, signWithProofErr?.message ?? 'ok');

  // --- Usurpation de signature : un employé ne peut pas attribuer la
  // signature à un AUTRE utilisateur réel (ex. le propriétaire) — trouvé et
  // corrigé pendant la phase de stabilisation (migration 0016). ---
  const { data: rentalSpoof } = await ownerA.client
    .from('rentals')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleA.id, customer_id: customerA.id, statut: 'en_attente_confirmation', date_debut_prevue: '2027-03-01T09:00:00Z', date_fin_prevue: '2027-03-03T09:00:00Z', caution_montant: 500 })
    .select()
    .single();
  const { data: contractSpoof } = await employeeA.client
    .from('contracts')
    .insert({
      agency_id: agencyA.id,
      rental_id: rentalSpoof.id,
      customer_nom: 'Client Spoof',
      vehicle_immatriculation: vehicleA.immatriculation,
      vehicle_marque: vehicleA.marque,
      vehicle_modele: vehicleA.modele,
      date_debut_prevue: rentalSpoof.date_debut_prevue,
      date_fin_prevue: rentalSpoof.date_fin_prevue,
      caution_montant: 0,
    })
    .select()
    .single();
  await employeeA.client.from('contracts').update({ statut: 'pret_a_signer' }).eq('id', contractSpoof.id);

  const { data: spoofed, error: spoofErr } = await employeeA.client
    .from('contracts')
    .update({ statut: 'signe', signed_at: new Date().toISOString(), signed_by: ownerA.id })
    .eq('id', contractSpoof.id)
    .select();
  record(
    "Un employee ne peut PAS attribuer la signature à un autre utilisateur (ex. l'owner)",
    !!spoofErr || (spoofed ?? []).length === 0,
    spoofErr?.message ?? `AUCUNE ERREUR — ${(spoofed ?? []).length} ligne(s) signée(s) au nom d'un autre utilisateur !`
  );

  // --- Vérifie que le déclencheur de TRANSITION (pas seulement la preuve de
  // signature) bloque bien un saut d'étape, même avec une preuve valide.
  // Nouvelle réservation dédiée pour ne pas violer "un seul contrat actif
  // par réservation" avec le contrat déjà créé plus haut. ---
  const { data: rentalA2 } = await ownerA.client
    .from('rentals')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleA.id, customer_id: customerA.id, statut: 'en_attente_confirmation', date_debut_prevue: '2026-09-01T09:00:00Z', date_fin_prevue: '2026-09-04T09:00:00Z', caution_montant: 2000 })
    .select()
    .single();
  const { data: contract2 } = await ownerA.client
    .from('contracts')
    .insert({
      agency_id: agencyA.id,
      rental_id: rentalA2.id,
      customer_nom: 'Client Test 2',
      vehicle_immatriculation: vehicleA.immatriculation,
      vehicle_marque: vehicleA.marque,
      vehicle_modele: vehicleA.modele,
      date_debut_prevue: rentalA2.date_debut_prevue,
      date_fin_prevue: rentalA2.date_fin_prevue,
      caution_montant: 0,
    })
    .select()
    .single();
  await ownerA.client.from('contracts').update({ statut: 'pret_a_signer' }).eq('id', contract2.id);
  const { error: skipWithProofErr } = await ownerA.client
    .from('contracts')
    .update({ statut: 'en_cours', signed_at: new Date().toISOString(), signed_by: ownerA.id })
    .eq('id', contract2.id);
  record(
    "Le saut d'étape (pret_a_signer -> en_cours) est refusé même avec une preuve de signature valide",
    !!skipWithProofErr && /contract_status_invalid_transition/.test(skipWithProofErr.message),
    skipWithProofErr?.message ?? 'AUCUNE ERREUR — saut d’étape accepté !'
  );

  // --- 7. Référencement croisé interdit ---
  const { error: crossRentalErr } = await ownerA.client.from('contracts').insert({
    agency_id: agencyA.id,
    rental_id: rentalB.id, // réservation d'une AUTRE entreprise
    customer_nom: 'Fraude',
    vehicle_immatriculation: 'X',
    vehicle_marque: 'X',
    vehicle_modele: 'X',
    date_debut_prevue: rentalB.date_debut_prevue,
    date_fin_prevue: rentalB.date_fin_prevue,
    caution_montant: 0,
  });
  record("Un contrat ne peut PAS référencer la réservation d'une autre entreprise", !!crossRentalErr && /rental_agency_mismatch/.test(crossRentalErr.message), crossRentalErr?.message ?? 'AUCUNE ERREUR — référence cross-agence acceptée !');

  // --- 8. Isolation entre agences ---
  const { data: crossRead } = await ownerB.client.from('contracts').select('id').eq('id', contract.id);
  record('Owner B ne peut PAS lire un contrat de A', (crossRead ?? []).length === 0, `lignes vues: ${(crossRead ?? []).length}`);

  // --- 5. Départ/retour atomiques + anti-double-soumission ---
  await ownerA.client.rpc('start_rental_with_contract', {
    p_rental_id: rentalA.id,
    p_contract_id: contract.id,
    p_km_depart: 10000,
    p_carburant_depart: 100,
    p_etat_depart: 'bon',
    p_accessoires_depart: ['roue_secours'],
    p_observations_depart: null,
  });
  const { data: afterDeparture } = await ownerA.client.from('rentals').select('statut, km_depart').eq('id', rentalA.id).single();
  const { data: vehicleAfterDeparture } = await ownerA.client.from('vehicles').select('statut').eq('id', vehicleA.id).single();
  const { data: contractAfterDeparture } = await ownerA.client.from('contracts').select('statut, etat_depart').eq('id', contract.id).single();
  record(
    '5. Départ atomique : rental, véhicule et contrat mis à jour ensemble',
    afterDeparture?.statut === 'en_cours' && vehicleAfterDeparture?.statut === 'en_location' && contractAfterDeparture?.statut === 'en_cours' && contractAfterDeparture?.etat_depart === 'bon',
    JSON.stringify({ rental: afterDeparture?.statut, vehicle: vehicleAfterDeparture?.statut, contract: contractAfterDeparture?.statut })
  );

  const { error: doubleDepartErr } = await ownerA.client.rpc('start_rental_with_contract', {
    p_rental_id: rentalA.id,
    p_contract_id: contract.id,
    p_km_depart: 10500,
    p_carburant_depart: 100,
    p_etat_depart: 'bon',
    p_accessoires_depart: [],
    p_observations_depart: null,
  });
  record('Un double départ est refusé', !!doubleDepartErr && /already_recorded_or_invalid_state/.test(doubleDepartErr.message), doubleDepartErr?.message ?? 'AUCUNE ERREUR — double départ accepté !');

  // Simule un véhicule mis en maintenance PENDANT la location (cas réel : panne constatée).
  await ownerA.client.from('vehicles').update({ statut: 'maintenance' }).eq('id', vehicleA.id);

  const { error: returnErr } = await ownerA.client.rpc('complete_rental_with_contract', {
    p_rental_id: rentalA.id,
    p_contract_id: contract.id,
    p_km_retour: 10300,
    p_carburant_retour: 80,
    p_etat_retour: 'moyen',
    p_accessoires_retour: [],
    p_observations_retour: null,
    p_retard_minutes: 0,
    p_frais_retard_propose: 0,
    p_frais_carburant_propose: 100,
    p_frais_justification: 'Carburant manquant',
    p_appliquer_frais: true,
  });
  const { data: afterReturn } = await ownerA.client.from('rentals').select('statut, frais_supplementaires, prix_total').eq('id', rentalA.id).single();
  const { data: vehicleAfterReturn } = await ownerA.client.from('vehicles').select('statut, kilometrage').eq('id', vehicleA.id).single();
  record(
    '6. Retour atomique : véhicule en maintenance NON écrasé en "à inspecter"',
    !returnErr && afterReturn?.statut === 'terminee' && vehicleAfterReturn?.statut === 'maintenance' && vehicleAfterReturn?.kilometrage === 10300,
    returnErr?.message ?? JSON.stringify({ rental: afterReturn?.statut, vehicle: vehicleAfterReturn?.statut, km: vehicleAfterReturn?.kilometrage })
  );
  record(
    '6. Les frais proposés et appliqués recalculent bien le prix total',
    Number(afterReturn?.frais_supplementaires) === 100,
    `frais_supplementaires=${afterReturn?.frais_supplementaires} prix_total=${afterReturn?.prix_total}`
  );

  const { error: doubleReturnErr } = await ownerA.client.rpc('complete_rental_with_contract', {
    p_rental_id: rentalA.id,
    p_contract_id: contract.id,
    p_km_retour: 10400,
    p_carburant_retour: 80,
    p_etat_retour: 'bon',
    p_accessoires_retour: [],
    p_observations_retour: null,
    p_retard_minutes: 0,
    p_frais_retard_propose: 0,
    p_frais_carburant_propose: 0,
    p_frais_justification: null,
    p_appliquer_frais: false,
  });
  record('Un double retour est refusé', !!doubleReturnErr && /already_recorded_or_invalid_state/.test(doubleReturnErr.message), doubleReturnErr?.message ?? 'AUCUNE ERREUR — double retour accepté !');

  // --- created_by ne peut pas être usurpé (même famille que signed_by,
  // corrigé en migration 0017) ---
  const { data: rentalForSpoof } = await ownerA.client
    .from('rentals')
    .insert({ agency_id: agencyA.id, vehicle_id: vehicleA.id, customer_id: customerA.id, statut: 'en_attente_confirmation', date_debut_prevue: '2027-05-01T09:00:00Z', date_fin_prevue: '2027-05-03T09:00:00Z', caution_montant: 500 })
    .select()
    .single();
  const { data: spoofedCreatedBy, error: spoofedCreatedByErr } = await ownerA.client
    .from('contracts')
    .insert({
      agency_id: agencyA.id,
      rental_id: rentalForSpoof.id,
      customer_nom: 'Client Spoof CreatedBy',
      vehicle_immatriculation: vehicleA.immatriculation,
      vehicle_marque: vehicleA.marque,
      vehicle_modele: vehicleA.modele,
      date_debut_prevue: rentalForSpoof.date_debut_prevue,
      date_fin_prevue: rentalForSpoof.date_fin_prevue,
      caution_montant: 0,
      created_by: ownerB.id, // tentative d'attribuer la création à un AUTRE utilisateur réel
    })
    .select();
  record(
    "created_by ne peut PAS être attribué à un autre utilisateur réel",
    !!spoofedCreatedByErr || (spoofedCreatedBy ?? []).length === 0,
    spoofedCreatedByErr?.message ?? `AUCUNE ERREUR — ${(spoofedCreatedBy ?? []).length} ligne(s) créée(s) au nom d'un autre utilisateur !`
  );

  // --- PDF : isolation du stockage ---
  const pdfPathA = `${agencyA.id}/${contract.id}/contrat-${Date.now()}.pdf`;
  const tinyPdf = new Blob([new Uint8Array([1, 2, 3])]);
  const { error: uploadOwnErr } = await ownerA.client.storage.from('contract-pdfs').upload(pdfPathA, tinyPdf);
  record('Owner peut téléverser le PDF de son propre contrat', !uploadOwnErr, uploadOwnErr?.message ?? 'ok');

  const { error: uploadCrossErr } = await ownerB.client.storage.from('contract-pdfs').upload(`${agencyA.id}/${contract.id}/hack.pdf`, tinyPdf);
  record("Owner B ne peut PAS écrire dans le dossier PDF de l'agence A", !!uploadCrossErr, uploadCrossErr?.message ?? 'AUCUNE ERREUR — upload cross-tenant accepté !');

  // --- Bilan ---
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== BILAN CONTRATS ===');
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
