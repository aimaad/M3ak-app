import { assertContractIsComplete, buildContractHtml } from '../contract-pdf';
import type { Contract } from '../types';

// Tests exécutés par Jest (Node) : on lit les sources avec require, sans dépendre des types Node.
declare const __dirname: string;
declare function require(name: string): any;

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: '1',
    agencyId: 'agency-1',
    rentalId: 'rental-1',
    numero: 'CTR-2026-00001',
    statut: 'preparation',
    customerNom: 'Youssef El Amrani',
    customerTelephone: '+212661234567',
    customerCin: 'BE482913',
    driverNom: null,
    autresConducteurs: [],
    vehicleImmatriculation: '8921-أ-14',
    vehicleMarque: 'Dacia',
    vehicleModele: 'Logan',
    dateDebutPrevue: '2026-03-10T09:00:00.000Z',
    dateFinPrevue: '2026-03-15T09:00:00.000Z',
    prixTotal: 1500,
    cautionMontant: 2000,
    conditionsParticulieres: null,
    notes: null,
    signedAt: null,
    signedBy: null,
    etatDepart: null,
    accessoiresDepart: [],
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('assertContractIsComplete', () => {
  it('ne renvoie aucun champ manquant pour un contrat complet', () => {
    expect(assertContractIsComplete(makeContract(), 'Agence Demo')).toEqual([]);
  });

  it("signale l'absence du nom de l'agence", () => {
    expect(assertContractIsComplete(makeContract(), '')).toContain('nom de l’agence');
  });

  it('signale les champs obligatoires manquants plutôt que de générer un document incomplet', () => {
    const missing = assertContractIsComplete(makeContract({ prixTotal: null, vehicleImmatriculation: '' }), 'Agence Demo');
    expect(missing).toContain('prix total');
    expect(missing).toContain('immatriculation du véhicule');
  });
});

describe('buildContractHtml', () => {
  it('inclut les informations essentielles du contrat', () => {
    const html = buildContractHtml(makeContract(), 'Agence Demo');
    expect(html).toContain('Agence Demo');
    expect(html).toContain('CTR-2026-00001');
    expect(html).toContain('Youssef El Amrani');
    expect(html).toContain('Dacia');
    expect(html).toContain('MAD');
    expect(html.replace(/\s/g, '')).toContain('1500');
  });

  it('échappe le HTML pour éviter une injection via les champs texte', () => {
    const html = buildContractHtml(makeContract({ conditionsParticulieres: '<script>alert(1)</script>' }), 'Agence Demo');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('conducteurs et confidentialité du contrat', () => {
  it('liste les conducteurs supplémentaires sur le contrat', () => {
    const html = buildContractHtml(
      makeContract({ driverNom: 'Sara Alaoui', autresConducteurs: ['Karim Benali', 'Omar <b>Test</b>'] }),
      'Agence Test'
    );
    expect(html).toContain('Conducteur principal');
    expect(html).toContain('Conducteurs supplémentaires');
    expect(html).toContain('Karim Benali');
    expect(html).toContain('Omar &lt;b&gt;Test&lt;/b&gt;');
  });

  it("n'affiche aucune section conducteurs supplémentaires quand il n'y en a pas", () => {
    expect(buildContractHtml(makeContract(), 'Agence Test')).not.toContain('Conducteurs supplémentaires');
  });

  it('ne reprend jamais les notes internes (contrat ni fiche client) dans le document remis au client', () => {
    const html = buildContractHtml(makeContract({ notes: 'NOTE-INTERNE-CONFIDENTIELLE' }), 'Agence Test');
    expect(html).not.toContain('NOTE-INTERNE-CONFIDENTIELLE');
  });

  it("le module du PDF n'a aucun accès aux notes internes des clients (garde-fou structurel)", () => {
    const fs = require('fs');
    const path = require('path');
    const source: string = fs.readFileSync(path.join(__dirname, '..', 'contract-pdf.ts'), 'utf8');
    expect(source).not.toMatch(/customers\/notes|customer_notes|notes-api/);
    const types: string = fs.readFileSync(path.join(__dirname, '..', 'types.ts'), 'utf8');
    expect(types).not.toMatch(/customer_notes|customerNotes/);
  });
});
