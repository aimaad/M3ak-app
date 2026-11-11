/* eslint-disable import/first -- le « jest.mock » doit précéder les imports */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { normalizeVehicleFields, type VehicleOcrFields } from '../../ocr';
import { draftFromScan, mergeScans, pendingCardDocuments, type ScanItem } from '../scan-session';

const field = <T,>(value: T, confidence: 'high' | 'medium' | 'low' = 'high') => ({ value, confidence });
const read = (patch: Record<string, unknown>): VehicleOcrFields => normalizeVehicleFields(patch);

describe('brouillon issu de la lecture de la carte grise', () => {
  const recto: ScanItem = {
    face: 'recto',
    uri: 'file:///recto.jpg',
    fields: read({ immatriculation: field('68013-ب-72'), dateMiseEnCirculation: field('2022-03-15'), proprietaire: field('Atlas Voyages'), dateFinValidite: field('2031-03-15') }),
  };
  const verso: ScanItem = {
    face: 'verso',
    uri: 'file:///verso.jpg',
    fields: read({ marque: field('Dacia'), modele: field('Sandero', 'medium'), vin: field('UU1HSDAGC56789012'), carburant: field('diesel'), puissanceFiscale: field(6), finition: field('Stepway', 'low') }),
  };

  it('fusionne les deux faces et reprend les valeurs lues, la plaque au format enregistré', () => {
    const merged = mergeScans([recto, verso]);
    const draft = draftFromScan({ merged, scans: [recto, verso], keepPhoto: true });
    expect(draft).toMatchObject({ immatriculation: '68013 | ب | 72', marque: 'Dacia', modele: 'Sandero', vin: 'UU1HSDAGC56789012', carburant: 'diesel', puissanceFiscale: 6, dateMiseEnCirculation: '15/03/2022', annee: 2022, source: 'scan' });
  });

  it('signale les champs de confiance moyenne ou faible, pas les sûrs', () => {
    const draft = draftFromScan({ merged: mergeScans([recto, verso]), scans: [recto, verso], keepPhoto: false });
    expect(draft.uncertainFields).toEqual(expect.arrayContaining(['modele', 'finition']));
    expect(draft.uncertainFields).not.toContain('marque');
    expect(draft.uncertainFields).not.toContain('vin');
  });

  it('ne garde que ce qui a été lu (pas de clé vide) ; une face seule suffit', () => {
    const draft = draftFromScan({ merged: mergeScans([recto]), scans: [recto], keepPhoto: false });
    expect(draft).not.toHaveProperty('marque');
    expect(draft).not.toHaveProperty('vin');
    expect(draft.immatriculation).toBe('68013 | ب | 72');
  });

  it('photos : gardées dans le dossier seulement si l’employé le veut ; le recto porte la fin de validité', () => {
    const merged = mergeScans([recto, verso]);
    expect(draftFromScan({ merged, scans: [recto, verso], keepPhoto: false }).carteGrisePendingDocuments).toBeUndefined();
    expect(draftFromScan({ merged, scans: [recto, verso], keepPhoto: true }).carteGrisePendingDocuments).toEqual([
      { type: 'carte_grise', localUri: 'file:///recto.jpg', expiresAt: '2031-03-15' },
      { type: 'carte_grise_verso', localUri: 'file:///verso.jpg', expiresAt: null },
    ]);
    expect(pendingCardDocuments([verso], '2031-03-15')).toEqual([{ type: 'carte_grise_verso', localUri: 'file:///verso.jpg', expiresAt: null }]);
  });
});
