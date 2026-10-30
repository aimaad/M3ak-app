import type { Customer } from '@/features/customers/types';

import { buildSnapshotValues } from '../snapshot';

const customer = { id: 'c', prenom: 'Sara', nom: 'Alaoui', nomComplet: 'Sara Alaoui', pays: 'Maroc', adresse: '5 rue Atlas', ville: 'Settat', documents: [], dateNaissance: null, numeroPermis: null } as unknown as Customer;

describe('informations figées sur le contrat', () => {
  it('reprend le CIN de la fiche, sinon celui du document « CIN »', () => {
    expect(buildSnapshotValues({ ...customer, cinOuPasseport: 'Z188822' } as Customer, []).client_cin).toBe('Z188822');
    const withDoc = { ...customer, cinOuPasseport: null, documents: [{ type: 'cin', reference: 'F670782' }] } as unknown as Customer;
    expect(buildSnapshotValues(withDoc, []).client_cin).toBe('F670782');
    expect(buildSnapshotValues(customer, []).client_cin).toBeUndefined();
  });

  it('sépare prénom et nom du conducteur 2', () => {
    const v = buildSnapshotValues(customer, [{ nomComplet: 'Karim Benali', prenom: 'Karim', nom: 'Benali', cinOuPasseport: 'AB1', numeroPermis: 'P1' }]);
    expect(v.conducteur2_prenom).toBe('Karim');
    expect(v.conducteur2_nom).toBe('Benali');
    expect(v.conducteur2_cin).toBe('AB1');
  });

  it('un ancien conducteur (sans prénom enregistré) garde son nom complet dans « Nom »', () => {
    const v = buildSnapshotValues(customer, [{ nomComplet: 'Karim Benali', cinOuPasseport: null, numeroPermis: null }]);
    expect(v.conducteur2_nom).toBe('Karim Benali');
    expect(v.conducteur2_prenom).toBeUndefined();
  });

  it('sans deuxième conducteur, rien n\'est figé pour lui', () => {
    const v = buildSnapshotValues(customer, []);
    expect(v.conducteur2_nom).toBeUndefined();
    expect(v.client_prenom).toBe('Sara');
    expect(v.client_nom_famille).toBe('Alaoui');
  });
});
