import {
  buildDriverCandidates,
  newDriverCandidate,
  type DriverCandidate,
} from '@/features/customers/driver-candidates';
import type { Customer, Driver } from '@/features/customers/types';

import {
  addAdditionalDriver,
  EMPTY_DRIVERS_SELECTION,
  hasOtherDrivers,
  removeAdditionalDriver,
  rentalDriversErrorKey,
  setPrincipalDriver,
} from '../rental-drivers';

function customer(id: string, nom: string, tel: string): Customer {
  return {
    id, agencyId: 'a', nomComplet: nom, prenom: null, nom: null, cinOuPasseport: null, numeroPermis: null,
    telephone: tel, telephoneSecondaire: null, email: null, adresse: null, ville: null, pays: 'Maroc',
    dateNaissance: null, languePreferee: null, typeClient: 'particulier', raisonSociale: null, ice: null,
    notes: null, consentementDonnees: false, consentementDate: null, documents: [], archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}
function driver(id: string, ownerId: string, nom: string, tel: string | null = null): Driver {
  return { id, agencyId: 'a', customerId: ownerId, linkedCustomerId: null, nomComplet: nom, cinOuPasseport: null, numeroPermis: null, telephone: tel, createdAt: '2026-01-01T00:00:00Z' };
}

const customers = [customer('c1', 'Client Un', '0661000001'), customer('c2', 'Client Deux', '0661000002')];
const drivers = [driver('d1', 'c1', 'Conducteur A', '0670000001'), driver('d2', 'c1', 'Conducteur B'), driver('d3', 'c1', 'Conducteur C'), driver('d4', 'c1', 'Conducteur D')];
const candidates = buildDriverCandidates(customers, drivers);
const byKey = (key: string): DriverCandidate => candidates.find((c) => c.key === key) as DriverCandidate;
const ctx = { customerId: 'c1' };

describe('réservation sans conducteur supplémentaire', () => {
  it("par défaut le client conduit : aucun autre conducteur", () => {
    expect(hasOtherDrivers(EMPTY_DRIVERS_SELECTION)).toBe(false);
    expect(EMPTY_DRIVERS_SELECTION.principal).toBeNull();
    expect(EMPTY_DRIVERS_SELECTION.additional).toEqual([]);
  });
});

describe('réservation avec un ou plusieurs conducteurs associés', () => {
  it('ajoute un conducteur existant', () => {
    const result = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    expect(result.ok).toBe(true);
    expect(result.selection.additional.map((c) => c.key)).toEqual(['driver:d1']);
    expect(hasOtherDrivers(result.selection)).toBe(true);
  });

  it('réutilise un autre client existant comme conducteur (sans recréer sa fiche)', () => {
    const result = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('customer:c2'), ctx);
    expect(result.ok).toBe(true);
    expect(result.selection.additional[0].customerId).toBe('c2');
  });

  it('ajoute un nouveau conducteur sans quitter la réservation', () => {
    const fresh = newDriverCandidate({ nomComplet: 'Nouveau', telephone: '0670123456', numeroPermis: null, cinOuPasseport: null });
    const result = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, fresh, ctx);
    expect(result.ok).toBe(true);
    expect(result.selection.additional[0].kind).toBe('new');
  });

  it('accepte plusieurs conducteurs jusqu’au maximum, puis refuse', () => {
    let selection = EMPTY_DRIVERS_SELECTION;
    for (const key of ['driver:d1', 'driver:d2', 'driver:d3']) {
      const result = addAdditionalDriver(selection, byKey(key), ctx);
      expect(result.ok).toBe(true);
      selection = result.selection;
    }
    const overflow = addAdditionalDriver(selection, byKey('driver:d4'), ctx);
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error).toBe('too_many');
  });

  it("respecte un maximum configuré par l'agence", () => {
    const one = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), { ...ctx, maxAdditional: 1 });
    const two = addAdditionalDriver(one.selection, byKey('driver:d2'), { ...ctx, maxAdditional: 1 });
    expect(two.ok).toBe(false);
  });
});

describe('refus des doublons de conducteurs dans une réservation', () => {
  it('refuse le même conducteur ajouté deux fois', () => {
    const first = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    const second = addAdditionalDriver(first.selection, byKey('driver:d1'), ctx);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('duplicate');
  });

  it('refuse la même personne saisie comme nouveau conducteur (même téléphone, autre format)', () => {
    const first = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    const same = newDriverCandidate({ nomComplet: 'Autre graphie', telephone: '+212670000001', numeroPermis: null, cinOuPasseport: null });
    const result = addAdditionalDriver(first.selection, same, ctx);
    expect(result.ok).toBe(false);
  });

  it("refuse d'ajouter comme supplémentaire le client qui conduit déjà", () => {
    const result = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('customer:c1'), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('is_customer');
  });

  it('refuse le conducteur principal ajouté aussi comme supplémentaire', () => {
    const selection = setPrincipalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    const result = addAdditionalDriver(selection, byKey('driver:d1'), ctx);
    expect(result.ok).toBe(false);
  });
});

describe('conducteur principal distinct du client', () => {
  it("désigne un autre conducteur principal sans perdre personne", () => {
    let selection = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx).selection;
    selection = addAdditionalDriver(selection, byKey('driver:d2'), ctx).selection;
    selection = setPrincipalDriver(selection, byKey('driver:d1'), ctx);

    expect(selection.principal?.key).toBe('driver:d1');
    expect(selection.additional.map((c) => c.key)).toEqual(['driver:d2']);
  });

  it("le client peut redevenir conducteur principal ; l'ancien principal reste associé", () => {
    let selection = setPrincipalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    selection = setPrincipalDriver(selection, null, ctx);
    expect(selection.principal).toBeNull();
    expect(selection.additional.map((c) => c.key)).toEqual(['driver:d1']);
  });

  it("le client réservant peut être supplémentaire quand quelqu'un d'autre est principal", () => {
    const selection = setPrincipalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx);
    expect(addAdditionalDriver(selection, byKey('customer:c1'), ctx).ok).toBe(true);
  });
});

describe('retrait avant confirmation', () => {
  it('retire un conducteur supplémentaire', () => {
    let selection = addAdditionalDriver(EMPTY_DRIVERS_SELECTION, byKey('driver:d1'), ctx).selection;
    selection = addAdditionalDriver(selection, byKey('driver:d2'), ctx).selection;
    selection = removeAdditionalDriver(selection, 'driver:d1');
    expect(selection.additional.map((c) => c.key)).toEqual(['driver:d2']);
  });
});

describe('rentalDriversErrorKey', () => {
  it('traduit les refus du serveur', () => {
    expect(rentalDriversErrorKey(new Error('duplicate_driver'))).toBe('locations.drivers.errors.duplicate_driver');
    expect(rentalDriversErrorKey(new Error('too_many_additional_drivers'))).toBe('locations.drivers.errors.too_many_additional_drivers');
    expect(rentalDriversErrorKey(new Error('rental_driver_agency_mismatch'))).toBe('locations.drivers.errors.agency_mismatch');
    expect(rentalDriversErrorKey(new Error('???'))).toBe('locations.drivers.errors.generic');
  });
});
