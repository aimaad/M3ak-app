import { departureSnapshotValues } from '@/features/contracts/snapshot';

import { contractDamageCandidates, damageLine } from '../damage-text';

const labels: Record<string, string> = {
  'inspection.analysis.zonesLabel.portiere_arriere_droit': 'Portière arrière droite',
  'inspection.analysis.types.rayure': 'Rayure',
  'inspection.analysis.damages.severity.modere': 'Moyen',
};
const t = (key: string) => labels[key] ?? key;
const damage = { zone: 'portiere_arriere_droit', type: 'rayure', gravite: 'modere', description: ' rayure profonde de 12 cm ' } as const;

describe('dommages inscrits au contrat', () => {
  it('écrit une ligne lisible pour le contrat', () => {
    expect(damageLine(damage, t)).toBe('Portière arrière droite — Rayure (Moyen) : rayure profonde de 12 cm');
    expect(damageLine({ ...damage, description: null }, t)).toBe('Portière arrière droite — Rayure (Moyen)');
  });

  it("ne propose que les dommages confirmés à l'inspection de départ", () => {
    const list = [{ statut: 'confirme' }, { statut: 'propose' }, { statut: 'rejete' }] as const;
    expect(contractDamageCandidates([...list])).toEqual([{ statut: 'confirme' }]);
  });

  it("fige dans le contrat les dommages choisis, ceux écrits à la main et les relevés", () => {
    const values = departureSnapshotValues({ km: 45210, carburant: 50, damages: ['Capot — Rayure (Léger)'], written: ' Petite rayure pare-chocs ' });
    expect(values.km_depart).toBe('45210');
    expect(values.carburant_depart).toBe('50 %');
    expect(values.dommages_depart).toBe('Capot — Rayure (Léger)\nPetite rayure pare-chocs');
  });

  it("n'écrit rien quand il n'y a ni dommage ni relevé (lignes laissées vides)", () => {
    expect(departureSnapshotValues({ km: null, carburant: null, damages: [], written: '   ' })).toEqual({});
  });

  it("un dommage écarté par l'employé n'entre pas dans le contrat", () => {
    const kept = departureSnapshotValues({ km: null, carburant: null, damages: [], written: '' });
    expect(kept.dommages_depart).toBeUndefined();
  });
});
