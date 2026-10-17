import type { Contract } from './types';

/** Contrat fictif pour l'aperçu d'un modèle (aucune donnée réelle). */
export function sampleContract(): Contract {
  const start = new Date();
  const end = new Date(start.getTime() + 3 * 86_400_000);
  return {
    id: 'sample',
    agencyId: 'sample',
    rentalId: 'sample',
    numero: 'CTR-EXEMPLE-0001',
    statut: 'preparation',
    customerNom: 'Nom Client Exemple',
    customerTelephone: '+212 6 00 00 00 00',
    customerCin: 'AB123456',
    driverNom: null,
    autresConducteurs: [],
    vehicleImmatriculation: '1234 | أ | 1',
    vehicleMarque: 'Dacia',
    vehicleModele: 'Logan',
    dateDebutPrevue: start.toISOString(),
    dateFinPrevue: end.toISOString(),
    prixTotal: 1500,
    cautionMontant: 3000,
    conditionsParticulieres: null,
    notes: null,
    signedAt: null,
    signedBy: null,
    clientSignaturePath: null,
    agencySignaturePath: null,
    clientSignedAt: null,
    termsSnapshot: null,
    etatDepart: 'bon',
    accessoiresDepart: ['roue_secours', 'cric'],
    observationsDepart: null,
    etatRetour: null,
    accessoiresRetour: [],
    observationsRetour: null,
    retardMinutes: null,
    fraisRetardPropose: null,
    fraisCarburantPropose: null,
    fraisJustification: null,
    fraisAppliques: false,
    pdfPath: null,
    createdBy: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
  };
}
