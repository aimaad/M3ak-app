// Audit RLS + concurrence du module Réservations — à exécuter contre une
// instance Supabase LOCALE uniquement (npx supabase start).
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/rental-rls-audit.mjs
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
  const email = `rental-audit-${Date.now()}-${userCounter}@example.test`;
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

async function main() {
  const ownerA = await createUser();
  const ownerB = await createUser();

  const agencyA = await createAgencyWithOwner(ownerA, 'Agence Réservations A');
  const agencyB = await createAgencyWithOwner(ownerB, 'Agence Réservations B');

  const { data: vehicleA } = await ownerA.client
    .from('vehicles')
    .insert({ agency_id: agencyA.id, immatriculation: `A-${Date.now()}`, marque: 'Dacia', modele: 'Logan', carburant: 'diesel', statut: 'disponible', prix_jour: 300, prix_semaine: 1800, prix_mois: 6000 })
    .select()
    .single();
  const { data: customerA } = await ownerA.client
    .from('customers')
    .insert({ agency_id: agencyA.id, nom_complet: 'Client A', telephone: '+212600000001' })
    .select()
    .single();

  const { data: vehicleB } = await ownerB.client
    .from('vehicles')
    .insert({ agency_id: agencyB.id, immatriculation: `B-${Date.now()}`, marque: 'Renault', modele: 'Clio', carburant: 'essence', statut: 'disponible', prix_jour: 250 })
    .select()
    .single();
  const { data: customerB } = await ownerB.client
    .from('customers')
    .insert({ agency_id: agencyB.id, nom_complet: 'Client B', telephone: '+212600000002' })
    .select()
    .single();

  // --- 1. Création, numéro, persistance ---
  const { data: rental, error: createErr } = await ownerA.client
    .from('rentals')
    .insert({
      agency_id: agencyA.id,
      vehicle_id: vehicleA.id,
      customer_id: customerA.id,
      statut: 'en_attente_confirmation',
      date_debut_prevue: '2026-08-01T09:00:00Z',
      date_fin_prevue: '2026-08-04T09:00:00Z',
      caution_montant: 2000,
    })
    .select()
    .single();
  record(
    '1. Création réelle + numéro généré automatiquement',
    !createErr && !!rental?.numero && rental.numero.startsWith('RES-'),
    createErr?.message ?? `numero=${rental?.numero}`
  );

  const freshSession = createClient(URL, ANON);
  await freshSession.auth.signInWithPassword({ email: ownerA.email, password: 'Audit-Test-P@ssw0rd-1234' });
  const { data: reread } = await freshSession.from('rentals').select('*').eq('id', rental.id).single();
  record(
    '1. Persistance après reconnexion',
    reread?.numero === rental.numero && Number(reread?.caution_montant) === 2000,
    `numero=${reread?.numero}`
  );

  // --- 5. Prix calculé et validé côté serveur, jamais fait confiance au client ---
  record(
    '5. Le prix est calculé par le serveur (3 jours à 300 MAD)',
    Number(rental.duree_jours) === 3 && Number(rental.prix_total) === 900,
    `duree_jours=${rental.duree_jours} prix_total=${rental.prix_total}`
  );

  const { data: fakePrice, error: fakePriceErr } = await ownerA.client
    .from('rentals')
    .insert({
      agency_id: agencyA.id,
      vehicle_id: vehicleA.id,
      customer_id: customerA.id,
      statut: 'en_attente_confirmation',
      date_debut_prevue: '2026-09-01T09:00:00Z',
      date_fin_prevue: '2026-09-04T09:00:00Z',
      caution_montant: 2000,
      prix_total: 1, // tentative d'imposer un prix depuis le "frontend"
      duree_jours: 1,
    })
    .select()
    .single();
  record(
    "5. Le client ne peut PAS imposer un prix : le serveur recalcule (3 jours à 300 = 900, pas 1)",
    !fakePriceErr && Number(fakePrice?.prix_total) === 900,
    fakePriceErr?.message ?? `prix_total reçu=${fakePrice?.prix_total}`
  );

  // --- Instantané : un changement de tarif du véhicule ne modifie pas une réservation déjà créée ---
  await ownerA.client.from('vehicles').update({ prix_jour: 999 }).eq('id', vehicleA.id);
  const { data: afterRateChange } = await ownerA.client.from('rentals').select('prix_total').eq('id', rental.id).single();
  record(
    '5. Un changement de tarif ne modifie pas rétroactivement une réservation existante',
    Number(afterRateChange?.prix_total) === 900,
    `prix_total=${afterRateChange?.prix_total}`
  );
  await ownerA.client.from('vehicles').update({ prix_jour: 300 }).eq('id', vehicleA.id);

  // --- 4. Double réservation concurrente : LE test critique ---
  const overlapA = ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleA.id,
    customer_id: customerA.id,
    statut: 'confirmee',
    date_debut_prevue: '2026-10-10T09:00:00Z',
    date_fin_prevue: '2026-10-15T09:00:00Z',
    caution_montant: 2000,
  });
  const overlapB = ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleA.id,
    customer_id: customerA.id,
    statut: 'confirmee',
    date_debut_prevue: '2026-10-12T09:00:00Z',
    date_fin_prevue: '2026-10-18T09:00:00Z',
    caution_montant: 2000,
  });
  const [resA, resB] = await Promise.all([overlapA, overlapB]);
  const successes = [resA, resB].filter((r) => !r.error).length;
  const exclusionErrors = [resA, resB].filter((r) => r.error?.code === '23P01').length;
  record(
    '4. Deux demandes VRAIMENT simultanées pour le même véhicule : une seule réussit',
    successes === 1 && exclusionErrors === 1,
    `succès=${successes} rejets_par_exclusion=${exclusionErrors}`
  );

  // --- Réservations successives (pas de chevauchement réel) acceptées ---
  const { error: backToBackErr } = await ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleA.id,
    customer_id: customerA.id,
    statut: 'confirmee',
    date_debut_prevue: '2026-08-04T09:00:00Z', // exactement la fin de "rental"
    date_fin_prevue: '2026-08-10T09:00:00Z',
    caution_montant: 2000,
  });
  record('Deux réservations qui se touchent sans se chevaucher sont acceptées', !backToBackErr, backToBackErr?.message ?? 'ok');

  // --- Véhicule en maintenance / indisponible : la réservation reste possible en base
  //     (c'est à l'application de ne pas proposer un véhicule indisponible ;
  //     aucune règle serveur ne bloque aujourd'hui une réservation sur un véhicule en
  //     maintenance autre que le chevauchement de dates — voir limitations du rapport).

  // --- 6. Statuts : transition invalide rejetée côté serveur ---
  // rental est actuellement 'en_attente_confirmation' -> on la fait progresser
  // légitimement jusqu'à 'en_cours', puis on tente une transition invalide.
  const { error: toConfirmedErr } = await ownerA.client.from('rentals').update({ statut: 'confirmee' }).eq('id', rental.id);
  const { error: toEnCoursErr } = await ownerA.client.from('rentals').update({ statut: 'en_cours' }).eq('id', rental.id);
  const { error: terminalErr } = await ownerA.client.from('rentals').update({ statut: 'confirmee' }).eq('id', rental.id);
  record(
    '6. Transition invalide (en_cours -> confirmee) rejetée côté serveur',
    !toConfirmedErr && !toEnCoursErr && !!terminalErr && /rental_status_invalid_transition/.test(terminalErr.message),
    terminalErr?.message ?? `AUCUNE ERREUR (étapes: confirmee=${!toConfirmedErr}, en_cours=${!toEnCoursErr}) — transition invalide acceptée !`
  );

  // --- 9. Référencement croisé interdit (véhicule/client d'une autre agence) ---
  const { error: crossVehicleErr } = await ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleB.id,
    customer_id: customerA.id,
    statut: 'en_attente_confirmation',
    date_debut_prevue: '2026-11-01T09:00:00Z',
    date_fin_prevue: '2026-11-03T09:00:00Z',
    caution_montant: 2000,
  });
  record(
    "9. Une réservation ne peut PAS référencer un véhicule d'une autre entreprise",
    !!crossVehicleErr && /vehicle_agency_mismatch/.test(crossVehicleErr.message),
    crossVehicleErr?.message ?? 'AUCUNE ERREUR — référence cross-agence acceptée !'
  );

  const { error: crossCustomerErr } = await ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleA.id,
    customer_id: customerB.id,
    statut: 'en_attente_confirmation',
    date_debut_prevue: '2026-11-01T09:00:00Z',
    date_fin_prevue: '2026-11-03T09:00:00Z',
    caution_montant: 2000,
  });
  record(
    "9. Une réservation ne peut PAS référencer un client d'une autre entreprise",
    !!crossCustomerErr && /customer_agency_mismatch/.test(crossCustomerErr.message),
    crossCustomerErr?.message ?? 'AUCUNE ERREUR — référence cross-agence acceptée !'
  );

  // --- 9/10. Isolation stricte entre agences sur les réservations elles-mêmes ---
  const { data: crossRead } = await ownerB.client.from('rentals').select('id').eq('id', rental.id);
  record('9. Owner B ne peut PAS lire une réservation de A', (crossRead ?? []).length === 0, `lignes vues: ${(crossRead ?? []).length}`);

  const { data: crossUpdate } = await ownerB.client.from('rentals').update({ notes: 'piraté' }).eq('id', rental.id).select();
  record('10. Owner B ne peut PAS modifier une réservation de A', (crossUpdate ?? []).length === 0, `lignes modifiées: ${(crossUpdate ?? []).length}`);

  // --- Confirmer / annuler une réservation (chemin légitime) ---
  const { data: pendingRental } = await ownerA.client
    .from('rentals')
    .insert({
      agency_id: agencyA.id,
      vehicle_id: vehicleA.id,
      customer_id: customerA.id,
      statut: 'en_attente_confirmation',
      date_debut_prevue: '2026-12-01T09:00:00Z',
      date_fin_prevue: '2026-12-03T09:00:00Z',
      caution_montant: 2000,
    })
    .select()
    .single();
  const { data: confirmed, error: confirmErr } = await ownerA.client
    .from('rentals')
    .update({ statut: 'confirmee' })
    .eq('id', pendingRental.id)
    .select()
    .single();
  record('Confirmer une réservation en attente fonctionne', !confirmErr && confirmed?.statut === 'confirmee', confirmErr?.message ?? 'ok');

  const { data: cancelled, error: cancelErr } = await ownerA.client
    .from('rentals')
    .update({ statut: 'annulee' })
    .eq('id', pendingRental.id)
    .select()
    .single();
  record('Annuler une réservation confirmée fonctionne', !cancelErr && cancelled?.statut === 'annulee', cancelErr?.message ?? 'ok');

  // --- Une réservation annulée ne peut pas être remise en cours ---
  const { error: reviveErr } = await ownerA.client.from('rentals').update({ statut: 'en_cours' }).eq('id', pendingRental.id);
  record(
    '6. Une réservation annulée ne peut PAS être remise en cours',
    !!reviveErr && /rental_status_terminal/.test(reviveErr.message),
    reviveErr?.message ?? 'AUCUNE ERREUR — réservation annulée relancée !'
  );

  // --- Annuler une réservation libère la période ---
  const { error: afterCancelErr } = await ownerA.client.from('rentals').insert({
    agency_id: agencyA.id,
    vehicle_id: vehicleA.id,
    customer_id: customerA.id,
    statut: 'confirmee',
    date_debut_prevue: '2026-12-01T09:00:00Z',
    date_fin_prevue: '2026-12-03T09:00:00Z',
    caution_montant: 2000,
  });
  record("L'annulation libère bien la période pour une nouvelle réservation", !afterCancelErr, afterCancelErr?.message ?? 'ok');

  // --- created_by ne peut pas être usurpé (même famille que signed_by sur les
  // contrats, corrigé en migration 0017) ---
  const { data: spoofedCreatedBy, error: spoofedCreatedByErr } = await ownerA.client
    .from('rentals')
    .insert({
      agency_id: agencyA.id,
      vehicle_id: vehicleA.id,
      customer_id: customerA.id,
      statut: 'en_attente_confirmation',
      date_debut_prevue: '2027-04-01T09:00:00Z',
      date_fin_prevue: '2027-04-03T09:00:00Z',
      caution_montant: 500,
      created_by: ownerB.id, // tentative d'attribuer la création à un AUTRE utilisateur réel
    })
    .select();
  record(
    "created_by ne peut PAS être attribué à un autre utilisateur réel",
    !!spoofedCreatedByErr || (spoofedCreatedBy ?? []).length === 0,
    spoofedCreatedByErr?.message ?? `AUCUNE ERREUR — ${(spoofedCreatedBy ?? []).length} ligne(s) créée(s) au nom d'un autre utilisateur !`
  );

  // --- Bilan ---
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== BILAN RÉSERVATIONS ===');
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
