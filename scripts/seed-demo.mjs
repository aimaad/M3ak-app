// Données de DÉMONSTRATION pour l'accueil de BIBIP — à lancer uniquement sur une base de TEST (jamais en production).
//
//   SUPA_URL=http://127.0.0.1:54321 SUPA_SERVICE=<clé service_role locale> DEMO_OWNER_EMAIL=vous@exemple.ma \
//     node scripts/seed-demo.mjs            # crée (ou recrée) l'agence « DEMO — Agence de démonstration »
//   … node scripts/seed-demo.mjs --reset    # supprime seulement cette agence de démonstration
//   … node scripts/seed-demo.mjs --scenario=libre   # parc seul, tout disponible (aucune location ni entretien)
//
// Garde-fous : refuse toute adresse qui n'est pas locale (localhost / 127.0.0.1) sauf si ALLOW_DEMO_SEED=oui est posé
// explicitement (base de test distante) ; ne touche JAMAIS une autre agence que celle nommée « DEMO — … » ; n'ajoute que des
// données fictives. NON TESTÉ sur une vraie base : à essayer d'abord sur Supabase local (`npx supabase start`).
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { buildDemoDataset } from './demo-seed/dataset.mjs';

const DEMO_NAME = 'DEMO — Agence de démonstration';
const SUPA_URL = process.env.SUPA_URL;
const SUPA_SERVICE = process.env.SUPA_SERVICE;
const DEMO_OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL;
const ALLOW_DEMO_SEED = process.env.ALLOW_DEMO_SEED;

if (!SUPA_URL || !SUPA_SERVICE || !DEMO_OWNER_EMAIL) {
  console.error('SUPA_URL, SUPA_SERVICE et DEMO_OWNER_EMAIL sont requis.');
  process.exit(1);
}
const host = new URL(SUPA_URL).hostname;
const local = host === 'localhost' || host === '127.0.0.1';
if (!local && ALLOW_DEMO_SEED !== 'oui') {
  console.error(`Refus : ${host} n'est pas une base locale. Si c'est bien une base de TEST, relancez avec ALLOW_DEMO_SEED=oui.`);
  process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_SERVICE, { auth: { persistSession: false } });
const check = (label, { error }) => {
  if (error) throw new Error(`${label} : ${error.message}`);
};

// Le compte doit déjà exister (inscription dans l'app) : le script ne crée aucun utilisateur.
const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const owner = users.users.find((u) => u.email?.toLowerCase() === DEMO_OWNER_EMAIL.toLowerCase());
if (!owner) throw new Error(`Aucun compte ${DEMO_OWNER_EMAIL} : inscrivez-vous d'abord dans l'app.`);

// Repart de zéro : supprime l'ancienne agence de démonstration de ce compte (cascade sur toutes ses données).
const { data: old } = await admin.from('agencies').select('id').eq('nom', DEMO_NAME).eq('created_by', owner.id);
for (const agency of old ?? []) check('suppression', await admin.from('agencies').delete().eq('id', agency.id));
if (process.argv.includes('--reset')) {
  console.log('Agence de démonstration supprimée.');
  process.exit(0);
}

const agencyId = randomUUID();
const branchId = randomUUID();
check('agence', await admin.from('agencies').insert({ id: agencyId, nom: DEMO_NAME, ville: 'Casablanca', created_by: owner.id }));
check('membre', await admin.from('agency_members').insert({ agency_id: agencyId, user_id: owner.id, role: 'owner', nom_complet: 'Compte démo' }));
check('filiale', await admin.from('branches').insert({ id: branchId, agency_id: agencyId, nom: 'Casablanca Centre', ville: 'Casablanca' }));

const ids = new Map();
const id = (kind, n) => {
  const key = `${kind}${n}`;
  if (!ids.has(key)) ids.set(key, randomUUID());
  return ids.get(key);
};
const scenario = process.argv.includes('--scenario=libre') ? 'libre' : 'standard';
const data = buildDemoDataset({ now: new Date(), agencyId, branchId, id, scenario });
for (const table of ['vehicles', 'customers', 'customer_documents', 'rentals', 'payments', 'maintenance_items']) {
  check(table, await admin.from(table).insert(data[table]));
  console.log(`${table} : ${data[table].length} lignes`);
}
console.log(`Agence « ${DEMO_NAME} » prête. Connectez-vous avec ${DEMO_OWNER_EMAIL} et choisissez cette agence.`);
