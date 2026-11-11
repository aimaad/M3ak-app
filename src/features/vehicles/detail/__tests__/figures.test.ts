import type { Payment } from '@/features/payments/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '../../types';
import {
  calendarDays,
  calendarRuns,
  calendarTap,
  cashedLast30,
  monthlyRevenue,
  rentalsSinceAdded,
  revenueBetween,
  revenueLast30,
  sparkPoints,
} from '../figures';

const NOW = new Date(2026, 10, 15, 12); // 15 nov. 2026
const day = (offset: number, hour = 9) => new Date(2026, 10, 15 + offset, hour).toISOString();

function rental(extra: Partial<Rental>): Rental {
  return { id: 'r', vehicleId: 'v1', statut: 'terminee', dateDebutPrevue: day(-3), dateFinPrevue: day(-1), dateDepartReel: day(-3), dateRetourReel: day(-1), prixTotal: 1500, ...extra } as Rental;
}
const vehicle = { id: 'v1', marque: 'Dacia', modele: 'Logan', statut: 'disponible', archivedAt: null } as unknown as Vehicle;

describe('revenus au prorata', () => {
  it('une location entièrement dans la période compte pour son prix total', () => {
    expect(revenueLast30([rental({})], NOW).current).toBe(1500);
  });

  it('une location à cheval sur deux périodes est coupée au prorata des jours', () => {
    // 10 jours, du 26 oct. (jour -20) au 4 nov. (-11)… ici : du -35 au -26 (10 jours) = 5 jours dans la fenêtre précédente, hors fenêtre courante
    const straddle = rental({ dateDepartReel: day(-34), dateRetourReel: day(-25), dateDebutPrevue: day(-34), dateFinPrevue: day(-25), prixTotal: 1000 });
    const figure = revenueLast30([straddle], NOW);
    // fenêtre courante = jours -29..0 → jours -29 à -25 = 5 jours sur 10 ; fenêtre précédente = -59..-30 → jours -34 à -30 = 5 jours
    expect(figure.current).toBe(500);
    expect(figure.previous).toBe(500);
  });

  it('exclut les locations annulées, en attente de confirmation et réservées', () => {
    const rentals = ['annulee', 'en_attente_confirmation', 'reservee', 'confirmee'].map((statut) => rental({ statut: statut as Rental['statut'] }));
    expect(revenueLast30(rentals, NOW).current).toBe(0);
  });

  it('une location en cours compte ses jours écoulés (les jours à venir sont hors fenêtre)', () => {
    const running = rental({ statut: 'en_cours', dateDepartReel: day(-1), dateRetourReel: null, dateDebutPrevue: day(-1), dateFinPrevue: day(2), prixTotal: 4000 });
    // 4 jours (-1, 0, 1, 2) ; 2 dans la fenêtre (jusqu'à aujourd'hui)
    expect(revenueLast30([running], NOW).current).toBe(2000);
  });

  it('un prix manquant compte pour zéro', () => {
    expect(revenueLast30([rental({ prixTotal: null })], NOW).current).toBe(0);
  });

  it('variation : +/− en % ; période précédente vide → aucune variation', () => {
    const before = rental({ dateDepartReel: day(-40), dateRetourReel: day(-40), dateDebutPrevue: day(-40), dateFinPrevue: day(-40), prixTotal: 1000 });
    expect(revenueLast30([rental({ prixTotal: 1180 }), before], NOW)).toEqual({ current: 1180, previous: 1000, variation: 18 });
    expect(revenueLast30([rental({ prixTotal: 600 }), before], NOW).variation).toBe(-40);
    expect(revenueLast30([rental({})], NOW).variation).toBeNull();
  });

  it('aucune location : 0 partout, pas de variation', () => {
    expect(revenueLast30([], NOW)).toEqual({ current: 0, previous: 0, variation: null });
    expect(monthlyRevenue([], NOW)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('courbe : 6 mois civils du plus ancien au mois en cours', () => {
    const october = rental({ dateDepartReel: new Date(2026, 9, 10).toISOString(), dateRetourReel: new Date(2026, 9, 12).toISOString(), prixTotal: 900 });
    const curve = monthlyRevenue([october, rental({})], NOW);
    expect(curve).toHaveLength(6);
    expect(curve[4]).toBe(900);
    expect(curve[5]).toBe(1500);
  });

  it('revenueBetween ignore une période sans chevauchement', () => {
    expect(revenueBetween([rental({})], new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(0);
  });
});

describe('autres chiffres', () => {
  it('locations depuis l’ajout : sans les annulées', () => {
    expect(rentalsSinceAdded([rental({}), rental({ statut: 'annulee' }), rental({ statut: 'en_cours' })])).toBe(2);
  });

  it('encaissé : paiements réglés de ce véhicule, dans les 30 jours', () => {
    const pay = (rentalId: string, montant: number, offset: number, statut: Payment['statut'] = 'paye'): Payment => ({ id: `${rentalId}${offset}`, agencyId: 'a', rentalId, montant, methode: 'especes', statut, datePaiement: day(offset) });
    const payments = [pay('r', 500, -2), pay('r', 300, -40), pay('r', 200, -1, 'echoue'), pay('autre', 900, -1)];
    expect(cashedLast30(payments, [rental({ id: 'r' })], NOW)).toBe(500);
  });

  it('courbe : points dans le cadre, plate si tout est égal', () => {
    const points = sparkPoints([0, 5, 10], 120, 48);
    expect(points[0]).toEqual({ x: 4, y: 44 });
    expect(points[2]).toEqual({ x: 116, y: 4 });
    expect(sparkPoints([3, 3], 120, 48).map((p) => p.y)).toEqual([24, 24]);
  });
});

describe('14 prochains jours', () => {
  it('14 jours, tous libres sans location', () => {
    const days = calendarDays({ vehicle, rentals: [], maintenance: [], now: NOW });
    expect(days).toHaveLength(14);
    expect(days.every((d) => d.kind === 'free')).toBe(true);
    expect(calendarRuns(days)).toEqual([{ kind: 'free', firstDay: days[0].key, lastDay: days[13].key }]);
  });

  it('réservation à venir : jours loués, tap → la location ; jour libre → louer à partir de ce jour', () => {
    const booked = rental({ id: 'res', statut: 'confirmee', dateDebutPrevue: day(3), dateFinPrevue: day(5), dateDepartReel: null, dateRetourReel: null });
    const days = calendarDays({ vehicle, rentals: [booked], maintenance: [], now: NOW });
    expect(days.slice(3, 6).every((d) => d.kind === 'rented')).toBe(true);
    expect(calendarTap(days[4])).toEqual({ type: 'rental', rentalId: 'res' });
    expect(calendarTap(days[0])).toEqual({ type: 'rent', day: days[0].key });
    expect(calendarRuns(days).map((run) => run.kind)).toEqual(['free', 'rented', 'free']);
  });

  it('véhicule immobilisé : jours immobilisés, aucun appui', () => {
    const days = calendarDays({ vehicle: { ...vehicle, statut: 'indisponible' } as Vehicle, rentals: [], maintenance: [], now: NOW });
    expect(days[0].kind).toBe('immobilised');
    expect(calendarTap(days[0])).toBeNull();
  });

  it('véhicule archivé : aucun jour', () => {
    expect(calendarDays({ vehicle: { ...vehicle, archivedAt: day(-1) } as Vehicle, rentals: [], maintenance: [], now: NOW })).toEqual([]);
  });
});
