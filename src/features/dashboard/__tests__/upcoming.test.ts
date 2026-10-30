import type { Rental } from '@/features/rentals/types';

import { upcomingRentals } from '../upcoming';

const NOW = new Date(2030, 5, 10, 15, 0, 0); // 10 juin 2030, 15 h (heure locale)

const rental = (id: string, statut: Rental['statut'], start: Date): Rental => ({ id, statut, dateDebutPrevue: start.toISOString() } as Rental);
const at = (day: number, hour = 9) => new Date(2030, 5, day, hour, 0, 0);

describe('upcomingRentals', () => {
  it('garde les locations à venir, la plus proche d\'abord', () => {
    const list = [rental('c', 'confirmee', at(14)), rental('a', 'reservee', at(11)), rental('b', 'en_attente_confirmation', at(12))];
    expect(upcomingRentals(list, NOW, 5).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('compte une location qui commence plus tard aujourd\'hui, même déjà passée dans la matinée', () => {
    expect(upcomingRentals([rental('today', 'confirmee', at(10, 8))], NOW, 5)).toHaveLength(1);
  });

  it('ignore les jours passés, les locations en cours, terminées et annulées', () => {
    const list = [rental('past', 'confirmee', at(9)), rental('run', 'en_cours', at(11)), rental('done', 'terminee', at(11)), rental('off', 'annulee', at(11))];
    expect(upcomingRentals(list, NOW, 5)).toEqual([]);
  });

  it('respecte la limite', () => {
    const list = [1, 2, 3, 4].map((d) => rental(`r${d}`, 'confirmee', at(10 + d)));
    expect(upcomingRentals(list, NOW, 3)).toHaveLength(3);
    expect(upcomingRentals(list, NOW, 0)).toEqual([]);
  });

  it('ne modifie pas la liste d\'origine', () => {
    const list = [rental('b', 'confirmee', at(12)), rental('a', 'confirmee', at(11))];
    upcomingRentals(list, NOW, 5);
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
