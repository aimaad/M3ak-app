// Script d'audit RLS — à exécuter contre une instance Supabase LOCALE uniquement
// (npx supabase start). Crée ses propres comptes/agences de test jetables.
// Usage: SUPA_URL=... SUPA_ANON=... SUPA_SERVICE=... node scripts/rls-security-audit.mjs
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
  const email = `audit-${Date.now()}-${userCounter}@example.test`;
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

async function main() {
  const ownerA = await createUser();
  const managerA = await createUser();
  const employeeA = await createUser();
  const accomplice1 = await createUser();
  const accomplice2 = await createUser();
  const ownerB = await createUser();

  // --- Création des deux agences (reproduit createAgency() de l'app) ---
  const { data: agencyA, error: agencyAErr } = await ownerA.client
    .from('agencies')
    .insert({ nom: 'Agence A', created_by: ownerA.id })
    .select()
    .single();
  if (agencyAErr) throw agencyAErr;
  await ownerA.client.from('agency_members').insert({
    agency_id: agencyA.id,
    user_id: ownerA.id,
    role: 'owner',
    nom_complet: 'Owner A',
  });

  const { data: agencyB, error: agencyBErr } = await ownerB.client
    .from('agencies')
    .insert({ nom: 'Agence B', created_by: ownerB.id })
    .select()
    .single();
  if (agencyBErr) throw agencyBErr;
  await ownerB.client.from('agency_members').insert({
    agency_id: agencyB.id,
    user_id: ownerB.id,
    role: 'owner',
    nom_complet: 'Owner B',
  });

  // --- #9 Invitations : création + redemption réelles ---
  const managerCode = randomCode();
  const { error: inviteManagerErr } = await ownerA.client.from('agency_invites').insert({
    agency_id: agencyA.id,
    code: managerCode,
    role: 'manager',
    created_by: ownerA.id,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  record('9. Owner peut créer une invitation manager', !inviteManagerErr, inviteManagerErr?.message ?? 'invitation créée');

  const { data: redeemManagerData, error: redeemManagerErr } = await managerA.client.rpc('redeem_invite', {
    invite_code: managerCode,
  });
  record(
    '9. redeem_invite fonctionne réellement (manager)',
    !redeemManagerErr && redeemManagerData === 'manager',
    redeemManagerErr?.message ?? `rôle obtenu = ${redeemManagerData}`
  );

  const employeeCode = randomCode();
  await ownerA.client.from('agency_invites').insert({
    agency_id: agencyA.id,
    code: employeeCode,
    role: 'employee',
    created_by: ownerA.id,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  const { data: redeemEmpData, error: redeemEmpErr } = await employeeA.client.rpc('redeem_invite', {
    invite_code: employeeCode,
  });
  record(
    '9. redeem_invite fonctionne réellement (employee)',
    !redeemEmpErr && redeemEmpData === 'employee',
    redeemEmpErr?.message ?? `rôle obtenu = ${redeemEmpData}`
  );

  // --- #2/#3 Persistance : mise à jour puis relecture avec une session neuve ---
  const { error: updateErr } = await ownerA.client
    .from('agencies')
    .update({ raison_sociale: 'M3ak Demo SARL', telephone: '+212600000000' })
    .eq('id', agencyA.id);
  record('2/3. Mise à jour des infos entreprise acceptée', !updateErr, updateErr?.message ?? 'update ok');

  const freshOwnerASession = createClient(URL, ANON);
  await freshOwnerASession.auth.signInWithPassword({ email: ownerA.email, password: 'Audit-Test-P@ssw0rd-1234' });
  const { data: reloaded, error: reloadErr } = await freshOwnerASession
    .from('agencies')
    .select('raison_sociale, telephone')
    .eq('id', agencyA.id)
    .single();
  record(
    '3. Les modifications persistent après reconnexion',
    !reloadErr && reloaded?.raison_sociale === 'M3ak Demo SARL' && reloaded?.telephone === '+212600000000',
    reloadErr?.message ?? JSON.stringify(reloaded)
  );

  // --- #6 Isolation multi-tenant stricte ---
  const { data: crossReadAgency } = await managerA.client.from('agencies').select('id').eq('id', agencyB.id);
  record('6. Un membre de A ne peut PAS lire Agence B', (crossReadAgency ?? []).length === 0, `lignes vues: ${(crossReadAgency ?? []).length}`);

  const { data: crossReadMembers } = await managerA.client
    .from('agency_members')
    .select('id')
    .eq('agency_id', agencyB.id);
  record('6. Un membre de A ne peut PAS lire les membres de B', (crossReadMembers ?? []).length === 0, `lignes vues: ${(crossReadMembers ?? []).length}`);

  const { data: crossUpdate } = await ownerB.client
    .from('agencies')
    .update({ nom: 'Piraté' })
    .eq('id', agencyA.id)
    .select();
  record('6. Owner B ne peut PAS modifier Agence A', (crossUpdate ?? []).length === 0, `lignes modifiées: ${(crossUpdate ?? []).length}`);

  const { data: crossDeleteMembers } = await ownerB.client
    .from('agency_members')
    .delete()
    .eq('agency_id', agencyA.id)
    .select();
  record('6. Owner B ne peut PAS supprimer des membres de A', (crossDeleteMembers ?? []).length === 0, `lignes supprimées: ${(crossDeleteMembers ?? []).length}`);

  // --- #4 Contrôle des rôles côté serveur (agences) ---
  const { data: employeeUpdateAgency } = await employeeA.client
    .from('agencies')
    .update({ raison_sociale: 'Hack employee' })
    .eq('id', agencyA.id)
    .select();
  record('4. Employee ne peut PAS modifier la fiche entreprise', (employeeUpdateAgency ?? []).length === 0, `lignes modifiées: ${(employeeUpdateAgency ?? []).length}`);

  const { data: managerUpdateAgency } = await managerA.client
    .from('agencies')
    .update({ raison_sociale: 'Hack manager' })
    .eq('id', agencyA.id)
    .select();
  record('4. Manager ne peut PAS modifier la fiche entreprise (owner only)', (managerUpdateAgency ?? []).length === 0, `lignes modifiées: ${(managerUpdateAgency ?? []).length}`);

  // --- #7 Escalade de privilèges : rôle via invitation ---
  const { data: managerARow } = await ownerA.client
    .from('agency_members')
    .select('id')
    .eq('agency_id', agencyA.id)
    .eq('user_id', employeeA.id)
    .single();

  const { data: employeeSelfPromoteData, error: employeeSelfPromoteErr } = await employeeA.client
    .from('agency_members')
    .update({ role: 'owner' })
    .eq('id', managerARow.id)
    .select();
  const employeeSelfPromoteBlocked =
    !!employeeSelfPromoteErr || (employeeSelfPromoteData ?? []).length === 0;
  record(
    '7. Employee ne peut PAS se promouvoir owner (update direct)',
    employeeSelfPromoteBlocked,
    employeeSelfPromoteErr?.message ??
      `lignes modifiées: ${(employeeSelfPromoteData ?? []).length}`
  );

  const ownerInviteCode = randomCode();
  const { error: managerOwnerInviteErr } = await managerA.client.from('agency_invites').insert({
    agency_id: agencyA.id,
    code: ownerInviteCode,
    role: 'owner',
    created_by: managerA.id,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  record(
    '7. Manager ne peut PAS créer une invitation role=owner',
    !!managerOwnerInviteErr,
    managerOwnerInviteErr?.message ?? 'AUCUNE ERREUR — invitation owner créée par un manager !'
  );

  if (!managerOwnerInviteErr) {
    const { data: redeemOwnerData, error: redeemOwnerErr } = await accomplice1.client.rpc('redeem_invite', {
      invite_code: ownerInviteCode,
    });
    record(
      '7. (conséquence) un compte tiers devient owner via ce code',
      !!redeemOwnerErr,
      redeemOwnerErr?.message ?? `AUCUNE ERREUR — rôle obtenu = ${redeemOwnerData} !`
    );
  }

  const { data: managerDirectInsertOwner, error: managerDirectInsertErr } = await managerA.client
    .from('agency_members')
    .insert({ agency_id: agencyA.id, user_id: accomplice2.id, role: 'owner' })
    .select();
  record(
    '7. Manager ne peut PAS insérer directement un membre role=owner',
    !!managerDirectInsertErr || (managerDirectInsertOwner ?? []).length === 0,
    managerDirectInsertErr?.message ?? `AUCUNE ERREUR — ${(managerDirectInsertOwner ?? []).length} ligne(s) insérée(s) !`
  );

  // --- Cas légitime : l'owner gère réellement ses membres (chemin positif) ---
  const { data: ownerChangesRole, error: ownerChangesRoleErr } = await ownerA.client
    .from('agency_members')
    .update({ role: 'employee' })
    .eq('agency_id', agencyA.id)
    .eq('user_id', managerA.id)
    .select();
  record(
    "4/11. Owner peut changer le rôle d'un membre de sa propre agence",
    !ownerChangesRoleErr && (ownerChangesRole ?? []).length === 1 && ownerChangesRole[0].role === 'employee',
    ownerChangesRoleErr?.message ?? `lignes modifiées: ${(ownerChangesRole ?? []).length}`
  );

  const { data: ownerRemovesMember, error: ownerRemovesErr } = await ownerA.client
    .from('agency_members')
    .delete()
    .eq('agency_id', agencyA.id)
    .eq('user_id', employeeA.id)
    .select();
  record(
    '4/11. Owner peut retirer un membre de sa propre agence',
    !ownerRemovesErr && (ownerRemovesMember ?? []).length === 1,
    ownerRemovesErr?.message ?? `lignes supprimées: ${(ownerRemovesMember ?? []).length}`
  );

  // --- #8 Protection du dernier owner ---
  const { error: lastOwnerDeleteErr } = await ownerB.client
    .from('agency_members')
    .delete()
    .eq('agency_id', agencyB.id)
    .eq('user_id', ownerB.id);
  record(
    '8. Impossible de supprimer le dernier owner',
    !!lastOwnerDeleteErr && /last_owner_cannot_be_removed/.test(lastOwnerDeleteErr.message),
    lastOwnerDeleteErr?.message ?? 'AUCUNE ERREUR — dernier owner supprimé !'
  );

  const { error: lastOwnerDemoteErr } = await ownerB.client
    .from('agency_members')
    .update({ role: 'employee' })
    .eq('agency_id', agencyB.id)
    .eq('user_id', ownerB.id);
  record(
    '8. Impossible de rétrograder le dernier owner',
    !!lastOwnerDemoteErr && /last_owner_cannot_be_removed/.test(lastOwnerDemoteErr.message),
    lastOwnerDemoteErr?.message ?? 'AUCUNE ERREUR — dernier owner rétrogradé !'
  );

  // --- Bilan ---
  const failed = results.filter((r) => !r.pass);
  console.log('\n=== BILAN ===');
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
