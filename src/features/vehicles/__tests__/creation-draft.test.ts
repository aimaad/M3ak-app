import { draftFromOcrFields, setVehicleCreationDraft, takeVehicleCreationDraft } from '../creation-draft';
import type { OcrField } from '../ocr';

function field<T>(value: T | null, confidence: 'high' | 'medium' | 'low' = 'high'): OcrField<T> {
  return { value, confidence };
}

describe('draftFromOcrFields', () => {
  it('garde les champs à confiance haute ou moyenne', () => {
    const draft = draftFromOcrFields({
      immatriculation: field<string>('12345-أ-6', 'high'),
      vin: field<string>(null),
      marque: field<string>('Dacia', 'medium'),
      modele: field<string>('Logan', 'high'),
      finition: field<string>(null),
      annee: field<number>(2022, 'high'),
      couleur: field<string>(null),
      nombrePlaces: field<number>(null),
      carburant: field<'diesel'>('diesel', 'high'),
      categorie: field<'economique'>(null),
    });

    expect(draft.immatriculation).toBe('12345-أ-6');
    expect(draft.marque).toBe('Dacia');
    expect(draft.modele).toBe('Logan');
    expect(draft.annee).toBe(2022);
    expect(draft.carburant).toBe('diesel');
    expect(draft.vin).toBeUndefined();
  });

  it('exclut les champs à confiance basse même si une valeur est présente', () => {
    const draft = draftFromOcrFields({
      immatriculation: field<string>('12345', 'low'),
      vin: field<string>(null),
      marque: field<string>(null),
      modele: field<string>(null),
      finition: field<string>(null),
      annee: field<number>(null),
      couleur: field<string>(null),
      nombrePlaces: field<number>(null),
      carburant: field<'diesel'>(null),
      categorie: field<'economique'>(null),
    });
    expect(draft.immatriculation).toBeUndefined();
  });

  it('liste les champs à confiance moyenne comme "à vérifier"', () => {
    const draft = draftFromOcrFields({
      immatriculation: field<string>('12345', 'medium'),
      vin: field<string>(null),
      marque: field<string>(null),
      modele: field<string>(null),
      finition: field<string>(null),
      annee: field<number>(null),
      couleur: field<string>(null),
      nombrePlaces: field<number>(null),
      carburant: field<'diesel'>(null),
      categorie: field<'economique'>(null),
    });
    expect(draft.uncertainFields).toEqual(['immatriculation']);
  });
});

describe('vehicle creation draft store', () => {
  it('restitue le brouillon une seule fois puis le vide', () => {
    setVehicleCreationDraft({ marque: 'Dacia' });
    expect(takeVehicleCreationDraft()).toEqual({ marque: 'Dacia' });
    expect(takeVehicleCreationDraft()).toBeNull();
  });
});
