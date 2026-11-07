// Jeu de données de DÉMONSTRATION (fictif) pour l'accueil de BIBIP : retours en retard, document expiré, entretiens en retard,
// impayés, locations à venir, véhicules à l'arrêt. Lignes au format de la base (snake_case), dates relatives à `now`.
// Utilisé par `scripts/seed-demo.mjs` (insertion dans une base de test) et par les vérifications automatiques.
const DAY = 86400000;

/**
 * @param {{ now?: Date, agencyId: string, branchId?: string|null, id?: (kind: string, n: number) => string }} options
 * `id(kind, n)` fabrique les identifiants (« v1 » pour des tests lisibles, des UUID pour la vraie base).
 */
export function buildDemoDataset({ now = new Date(), agencyId, branchId = null, id = (kind, n) => `${kind}${n}` }) {
  const at = (days) => new Date(now.getTime() + days * DAY).toISOString();
  const day = (days) => at(days).slice(0, 10);

  const vehicleDefs = [
    ['8921-ب-14', 'Dacia', 'Logan', 2022, 'en_location', 250, 47900],
    ['45123-أ-1', 'Renault', 'Clio 5', 2023, 'en_location', 350, 21200],
    ['3307-د-6', 'Peugeot', '208', 2021, 'en_location', 300, 71000],
    ['12876-ه-9', 'Kia', 'Picanto', 2022, 'en_location', 280, 33400],
    ['5540-ج-26', 'Hyundai', 'Tucson', 2023, 'disponible', 650, 15800],
    ['7765-ز-14', 'Dacia', 'Sandero', 2022, 'disponible', 260, 28800],
    ['2290-و-14', 'Renault', 'Symbol', 2020, 'a_inspecter', 270, 61000],
    ['9012-ح-14', 'Peugeot', '301', 2021, 'maintenance', 275, 52300],
  ];
  const vehicles = vehicleDefs.map(([immatriculation, marque, modele, annee, statut, prix_jour, kilometrage], i) => ({
    id: id('v', i + 1),
    agency_id: agencyId,
    branch_id: branchId,
    immatriculation,
    marque,
    modele,
    annee,
    statut,
    prix_jour,
    kilometrage,
    carburant: 'diesel',
    // Assurance expirée sur la Peugeot 208 (document expiré à mettre à jour) ; les autres échéances sont lointaines.
    documents: [
      { type: 'assurance', path: `demo/ass-${i + 1}.png`, uploadedAt: at(-100), expiresAt: i === 2 ? day(-5) : day(60 + i * 20) },
      { type: 'visite_technique', path: `demo/vt-${i + 1}.png`, uploadedAt: at(-100), expiresAt: day(200 + i) },
    ],
  }));

  const customerDefs = [
    ['Karim Alami', '+212 661-000001', 'AB123456'],
    ['Sara Idrissi', '+212 662-000002', 'CD654321'],
    ['Youssef Benani', '+212 663-000003', 'EF778899'],
    ['Atlas Voyages SARL', '+212 522-111222', null],
    ['Nadia Lahlou', '+212 664-000004', 'GH112233'],
    ['Omar Tazi', '+212 665-000005', 'IJ445566'],
  ];
  const customers = customerDefs.map(([nom_complet, telephone, cin_ou_passeport], i) => ({
    id: id('c', i + 1),
    agency_id: agencyId,
    nom_complet,
    telephone,
    cin_ou_passeport,
    consentement_donnees: true,
  }));
  // Permis de Youssef Benani expiré depuis 20 jours.
  const customer_documents = customers.slice(0, 3).map((c, i) => ({
    id: id('d', i + 1),
    agency_id: agencyId,
    customer_id: c.id,
    doc_type: 'permis',
    reference: `14/2019/${i + 1}777`,
    expires_at: i === 2 ? day(-20) : day(400),
  }));

  // [numéro, véhicule, client, statut, début (jours), fin (jours), prix total, déjà encaissé]
  const rentalDefs = [
    [1, 1, 1, 'en_cours', -5, -2, 1500, 500], // en retard de 2 jours, impayé
    [2, 2, 2, 'en_cours', -4, -1, 1400, 0], // en retard de 1 jour, impayé
    [3, 3, 3, 'en_cours', -3, -0.5, 900, 300], // en retard de 12 h, impayé
    [4, 4, 4, 'en_cours', -1, 0.25, 2000, 500], // retour prévu aujourd'hui, pas en retard
    [5, 5, 5, 'terminee', -14, -10, 2600, 1000], // terminée, 1 600 MAD impayés
    [6, 6, 1, 'terminee', -9, -6, 1000, 1000],
    [7, 1, 6, 'confirmee', 0.125, 4, 1000, 0], // départ aujourd'hui, à venir
    [8, 2, 2, 'confirmee', 2, 5, 1050, 0],
    [9, 6, 3, 'en_attente_confirmation', 3, 6, 780, 0],
    [10, 7, 4, 'confirmee', 6, 9, 810, 0],
    [11, 8, 5, 'annulee', -3, -1, 825, 0],
    [12, 7, 6, 'terminee', -20, -17, 810, 810],
  ];
  const rentals = rentalDefs.map(([n, v, c, statut, d1, d2, prix_total, paye]) => {
    const started = statut === 'en_cours' || statut === 'terminee';
    return {
      id: id('r', n),
      agency_id: agencyId,
      numero: `DEMO-${String(n).padStart(4, '0')}`,
      vehicle_id: id('v', v),
      customer_id: id('c', c),
      statut,
      date_debut_prevue: at(d1),
      date_fin_prevue: at(d2),
      date_depart_reel: started ? at(d1) : null,
      date_retour_reel: statut === 'terminee' ? at(d2) : null,
      prix_total,
      acompte_paye: paye,
      caution_montant: 2000,
    };
  });
  const payments = rentalDefs
    .filter((d) => d[7] > 0)
    .map(([n, , , , d1, , , paye]) => ({
      id: id('pay', n),
      agency_id: agencyId,
      rental_id: id('r', n),
      montant: paye,
      methode: n % 3 === 0 ? 'carte' : n % 2 === 0 ? 'virement' : 'especes',
      statut: 'paye',
      date_paiement: at(d1),
    }));

  // [vehicule, type, statut, échéance (jours), coût, intervention (jours)]
  const maintenanceDefs = [
    [3, 'freins', 'en_retard', -4, null, null],
    [1, 'vidange', 'en_retard', -10, null, null],
    [4, 'assurance', 'due', 3, null, null],
    [6, 'visite_technique', 'a_venir', 20, null, null],
    [2, 'pneus', 'effectuee', -40, 1800, -38],
    [2, 'vidange', 'effectuee', -82, 450, -80],
    [5, 'freins', 'effectuee', -62, 950, -60],
  ];
  const maintenance_items = maintenanceDefs.map(([v, type, statut, ech, cout, interv], i) => ({
    id: id('m', i + 1),
    agency_id: agencyId,
    vehicle_id: id('v', v),
    type,
    statut,
    echeance_date: day(ech),
    notes: null,
    ...(statut === 'effectuee' ? { garage: 'Garage Atlas', cout, date_intervention: day(interv) } : {}),
  }));

  return { vehicles, customers, customer_documents, rentals, payments, maintenance_items };
}
