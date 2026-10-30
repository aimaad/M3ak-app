import { assertContractIsComplete, buildContractHtml } from '../contract-pdf';
import type { Contract } from '../types';
import { sampleContract } from '../sample-contract';

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
    clientSignaturePath: null,
    agencySignaturePath: null,
    clientSignedAt: null,
    termsSnapshot: null,
    snapshotValues: null,
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

describe('contrat complet (conditions, parties, signatures)', () => {
  const sig = { v: 1 as const, width: 300, height: 150, paths: ['M 10 10 L 50 60 L 90 20 L 130 70 L 170 30 L 210 80 L 250 40'] };
  const agency = { nom: 'Agence Atlas', adresse: '12 rue Hassan II', ville: 'Marrakech', telephone: '+212600000000', email: 'contact@atlas.ma' };

  it('contient toutes les conditions générales en français ET en arabe', () => {
    const html = buildContractHtml(makeContract(), agency);
    expect(html).toContain('Article 1');
    expect(html).toContain('Article 12');
    expect(html).toContain('Caution et prolongation');
    expect(html).toContain('المادة 12');
    expect(html).toContain('الضمانة');
    expect(html).toContain('24 heures');
    expect(html).toContain('Marrakech');
  });

  it('indique le montant de la caution sur le recto et le nom de l\'agence dans les conditions', () => {
    const html = buildContractHtml(makeContract({ cautionMontant: 2500 }), agency).replace(/\s/g, ' ');
    expect(html).toMatch(/Caution :<\/span><span class="fvalue">2.500 MAD/);
    expect(html).toContain('Agence Atlas se réserve le plein droit');
  });

  it('affiche les coordonnées de l\'agence (sans e-mail)', () => {
    const html = buildContractHtml(makeContract(), agency);
    expect(html).toContain('12 rue Hassan II');
    expect(html).toContain('+212600000000');
    expect(html).not.toContain('contact@atlas.ma'); // l'e-mail n'est plus affiché sur le contrat
  });

  it('insère les deux signatures manuscrites, le nom du signataire et la date', () => {
    const html = buildContractHtml(
      makeContract({ signedAt: '2026-03-09T10:00:00.000Z', clientSignedAt: '2026-03-09T10:00:00.000Z' }),
      agency,
      { client: sig, agency: sig, agencySignerName: 'Sara Alaoui' }
    );
    expect(html.match(/class="sig"/g)?.length).toBe(2);
    expect(html).toContain('Sara Alaoui');
    expect(html).toContain('M 10 10 L 50 60');
  });

  it('laisse les cadres vides tant que rien n\'est signé', () => {
    expect(buildContractHtml(makeContract(), agency)).not.toContain('class="sig"');
  });

  it('refuse d\'insérer une signature falsifiée (aucun code ne peut passer)', () => {
    const evil = { ...sig, paths: ['M 1 1"/><script>alert(1)</script>'] };
    const html = buildContractHtml(makeContract(), agency, { client: evil, agency: evil });
    expect(html).not.toContain('alert(1)');
    // Le seul script du document est le filet de mise en page, constant : aucun contenu venant des données n'y entre.
    expect(html.match(/<script>/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('class="sig"');
  });

  it('reprend l\'état des lieux de départ quand il existe', () => {
    const html = buildContractHtml(
      makeContract({ etatDepart: 'bon', accessoiresDepart: ['cric', 'extincteur'], observationsDepart: 'Rayure <b>pare-choc</b>' }),
      agency
    );
    expect(html).toContain('État des lieux au départ');
    expect(html).toContain('Cric, Extincteur');
    expect(html).toContain('Rayure &lt;b&gt;pare-choc&lt;/b&gt;');
    expect(buildContractHtml(makeContract(), agency)).not.toContain('État des lieux au départ');
  });

  it('échappe aussi les champs de l\'agence', () => {
    const html = buildContractHtml(makeContract(), { nom: 'A<script>x</script>' });
    expect(html).not.toContain('<script>x');
  });
});

describe('cachet de l\'agence', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  it('appose le cachet à côté de la signature de l\'agence', () => {
    const html = buildContractHtml(makeContract(), 'Agence Test', { stampDataUri: png });
    expect(html).toContain('class="stamp"');
    expect(html).toContain(png);
  });

  it('ne met aucun cachet quand il n\'y en a pas', () => {
    expect(buildContractHtml(makeContract(), 'Agence Test')).not.toContain('class="stamp"');
  });

  it('ignore toute valeur qui n\'est pas une image png/jpeg encodée', () => {
    for (const evil of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,AAAA', `${png}" onerror="x`, 'https://evil.test/x.png']) {
      expect(buildContractHtml(makeContract(), 'Agence Test', { stampDataUri: evil })).not.toContain('class="stamp"');
    }
  });
});

describe('contrat fait après l\'inspection de départ', () => {
  const agency = { nom: 'Agence Atlas', adresse: '12 rue Hassan II', ville: 'Marrakech', telephone: '+212600000000' };
  const base = sampleContract();

  it('reprend les dommages choisis, le kilométrage et le carburant relevés à l\'inspection', () => {
    const contract = { ...base, etatDepart: 'bon' as const, snapshotValues: { dommages_depart: 'Capot — Rayure (Léger)\nPetite rayure pare-chocs', km_depart: '45210', carburant_depart: '50 %' } };
    const html = buildContractHtml(contract, agency);
    expect(html).toContain('Dommages existants');
    expect(html).toContain('Capot — Rayure (Léger)');
    expect(html).toContain('Petite rayure pare-chocs');
    expect(html).toContain('45210');
    expect(html).toContain('50 %');
  });

  it("sans dommage inscrit, la ligne « Dommages existants » n'apparaît pas", () => {
    const html = buildContractHtml({ ...base, etatDepart: 'bon' as const, snapshotValues: {} }, agency);
    expect(html).not.toContain('Dommages existants');
  });

  it('les relevés réels du départ passent avant ceux de l\'inspection', () => {
    const contract = { ...base, snapshotValues: { km_depart: '100' } };
    expect(buildContractHtml(contract, agency, {}, undefined, { kmDepart: 45300 })).toContain('45300');
  });
});

describe('jauge de carburant automatique', () => {
  const { fuelPercent, gaugeSvg } = require('../template-render');
  it('lit le pourcentage relevé', () => {
    expect(fuelPercent('50 %')).toBe(50);
    expect(fuelPercent('')).toBeNull();
    expect(fuelPercent('250 %')).toBe(100);
  });
  it("dessine l'aiguille au bon endroit (50 % = verticale, 100 % = à droite)", () => {
    expect(gaugeSvg(50)).toContain('x2="80.0" y2="12.0"');
    expect(gaugeSvg(100)).toContain('x2="138.0" y2="70.0"');
    expect(gaugeSvg(null)).not.toContain('#B91C1C');
  });
  it('apparaît dans le contrat quand le carburant de départ est connu', () => {
    const base = sampleContract();
    const html = buildContractHtml({ ...base, snapshotValues: { carburant_depart: '75 %' } }, { nom: 'Agence' });
    expect(html).toContain('75 %</text>');
  });
});

describe('correction de contrat', () => {
  it('garde le texte de dommage écrit à la main pour le préremplir à la correction', () => {
    const { departureSnapshotValues } = require('../snapshot');
    const values = departureSnapshotValues({ km: 10, carburant: 50, damages: ['Capot — Rayure'], written: ' Rétroviseur cassé ' });
    expect(values.dommages_ecrits_depart).toBe('Rétroviseur cassé');
    expect(values.dommages_depart).toContain('Capot — Rayure');
    expect(departureSnapshotValues({ km: null, carburant: null, damages: [], written: '' }).dommages_ecrits_depart).toBeUndefined();
  });
});
