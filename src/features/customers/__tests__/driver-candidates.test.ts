import {
  buildDriverCandidates,
  canonicalPhone,
  isSamePerson,
  newDriverCandidate,
  searchDriverCandidates,
} from '../driver-candidates';
import type { Customer, Driver } from '../types';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    agencyId: 'a1',
    nomComplet: 'Karim Benali',
    prenom: null,
    nom: null,
    cinOuPasseport: null,
    numeroPermis: null,
    telephone: '0661234567',
    telephoneSecondaire: null,
    email: null,
    adresse: null,
    ville: null,
    pays: 'Maroc',
    dateNaissance: null,
    languePreferee: null,
    typeClient: 'particulier',
    raisonSociale: null,
    ice: null,
    notes: null,
    consentementDonnees: false,
    consentementDate: null,
    documents: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'd1',
    agencyId: 'a1',
    customerId: 'c1',
    linkedCustomerId: null,
    nomComplet: 'Youssef Benali',
    cinOuPasseport: null,
    numeroPermis: null,
    telephone: '0670000001',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildDriverCandidates', () => {
  const customers = [
    makeCustomer(),
    makeCustomer({ id: 'c2', nomComplet: 'Sara Idrissi', telephone: '+212 6 55 55 55 55' }),
    makeCustomer({ id: 'c3', nomComplet: 'Archivé', archivedAt: '2026-02-01T00:00:00Z' }),
  ];
  const drivers = [
    makeDriver(),
    makeDriver({ id: 'd2', customerId: 'c2', linkedCustomerId: 'c2', nomComplet: 'Sara Idrissi' }),
  ];
  const candidates = buildDriverCandidates(customers, drivers);

  it('propose les clients non archivés et les conducteurs enregistrés', () => {
    expect(candidates.map((c) => c.key).sort()).toEqual(['customer:c1', 'customer:c2', 'driver:d1']);
  });

  it("ne propose pas deux fois un client qui est déjà « conducteur lié » (réutilisation de son identité)", () => {
    expect(candidates.filter((c) => c.nomComplet === 'Sara Idrissi')).toHaveLength(1);
    expect(candidates.find((c) => c.key === 'customer:c2')?.driverId).toBe('d2');
  });

  it("indique le client auquel un conducteur est rattaché", () => {
    expect(candidates.find((c) => c.key === 'driver:d1')?.ownerCustomerName).toBe('Karim Benali');
  });
});

describe('searchDriverCandidates', () => {
  const candidates = buildDriverCandidates(
    [makeCustomer(), makeCustomer({ id: 'c2', nomComplet: 'Hélène Dupont', telephone: '+212 6 55 55 55 55', numeroPermis: '12/345678' })],
    [makeDriver()]
  );

  it('cherche par nom sans tenir compte des accents ni de la casse', () => {
    expect(searchDriverCandidates(candidates, 'helene').map((c) => c.key)).toEqual(['customer:c2']);
    expect(searchDriverCandidates(candidates, 'BENALI').map((c) => c.key).sort()).toEqual(['customer:c1', 'driver:d1']);
  });

  it('cherche par numéro de téléphone quel que soit le format', () => {
    expect(searchDriverCandidates(candidates, '0655555555').map((c) => c.key)).toEqual(['customer:c2']);
    expect(searchDriverCandidates(candidates, '+212655555555').map((c) => c.key)).toEqual(['customer:c2']);
    expect(searchDriverCandidates(candidates, '66123').map((c) => c.key)).toEqual(['customer:c1']);
  });

  it('cherche par numéro de permis', () => {
    expect(searchDriverCandidates(candidates, '12345678').map((c) => c.key)).toEqual(['customer:c2']);
  });

  it('renvoie tout sans recherche et rien si aucune correspondance', () => {
    expect(searchDriverCandidates(candidates, '')).toHaveLength(3);
    expect(searchDriverCandidates(candidates, 'zzz')).toHaveLength(0);
  });
});

describe('isSamePerson (anti-doublon)', () => {
  it("reconnaît le même téléphone sous deux formats", () => {
    const a = newDriverCandidate({ nomComplet: 'A', telephone: '0661234567', numeroPermis: null, cinOuPasseport: null });
    const b = newDriverCandidate({ nomComplet: 'B', telephone: '+212661234567', numeroPermis: null, cinOuPasseport: null });
    expect(isSamePerson(a, b)).toBe(true);
  });

  it('reconnaît le même numéro de permis malgré la mise en forme', () => {
    const a = newDriverCandidate({ nomComplet: 'A', telephone: null, numeroPermis: '12/345678', cinOuPasseport: null });
    const b = newDriverCandidate({ nomComplet: 'B', telephone: null, numeroPermis: '12-345678', cinOuPasseport: null });
    expect(isSamePerson(a, b)).toBe(true);
  });

  it('distingue deux personnes différentes', () => {
    const a = newDriverCandidate({ nomComplet: 'A', telephone: '0661111111', numeroPermis: 'X1', cinOuPasseport: null });
    const b = newDriverCandidate({ nomComplet: 'B', telephone: '0662222222', numeroPermis: 'X2', cinOuPasseport: null });
    expect(isSamePerson(a, b)).toBe(false);
  });

  it('un client et son conducteur lié sont la même personne', () => {
    const [customer] = buildDriverCandidates([makeCustomer()], [makeDriver({ id: 'dl', linkedCustomerId: 'c1' })]);
    const asDriver = { ...customer, key: 'driver:dl', kind: 'driver' as const };
    expect(isSamePerson(customer, asDriver)).toBe(true);
  });
});

describe('canonicalPhone', () => {
  it('garde les 9 derniers chiffres', () => {
    expect(canonicalPhone('+212 6 61-23-45-67')).toBe('661234567');
    expect(canonicalPhone(null)).toBe('');
  });
});
