import { chargeableDamages, countDamages, effectiveCost, needsCheck, pendingNewDamages, sortDamages, totalCharge, type Damage } from '../damages';

const base: Damage = {
  id: 'd1',
  inspectionId: 'i1',
  photoId: null,
  angle: 'arriere_droit',
  zone: 'pare_choc_arriere',
  type: 'rayure',
  gravite: 'modere',
  confiance: 0.96,
  nouveau: true,
  description: null,
  coutEstime: 850,
  coutValide: null,
  bbox: null,
  comparaison: 'comparee',
  statut: 'propose',
  source: 'ia',
};
const damage = (over: Partial<Damage>): Damage => ({ ...base, ...over });

describe('coût et retenue', () => {
  it("utilise le coût validé par l'employé, sinon l'estimation de l'IA", () => {
    expect(effectiveCost(damage({}))).toBe(850);
    expect(effectiveCost(damage({ coutValide: 600 }))).toBe(600);
    expect(effectiveCost(damage({ coutEstime: null }))).toBe(0);
  });

  it('ne retient que les dommages nouveaux ET confirmés', () => {
    const list = [
      damage({ id: 'a', statut: 'confirme', coutEstime: 850 }),
      damage({ id: 'b', statut: 'confirme', nouveau: false, coutEstime: 300 }), // déjà là au départ
      damage({ id: 'c', statut: 'propose', coutEstime: 500 }), // pas encore validé
      damage({ id: 'd', statut: 'rejete', coutEstime: 700 }), // rejeté
      damage({ id: 'e', statut: 'confirme', coutEstime: 300, coutValide: 250 }),
    ];
    expect(chargeableDamages(list).map((d) => d.id)).toEqual(['a', 'e']);
    expect(totalCharge(list)).toBe(1100);
  });

  it('signale les nouveaux dommages encore à décider', () => {
    const list = [damage({ id: 'a' }), damage({ id: 'b', nouveau: false }), damage({ id: 'c', statut: 'confirme' })];
    expect(pendingNewDamages(list).map((d) => d.id)).toEqual(['a']);
  });
});

describe('contrôle et tri', () => {
  it('demande une vérification : confiance basse ou pas de photo de départ', () => {
    expect(needsCheck(damage({ confiance: 0.45 }))).toBe(true);
    expect(needsCheck(damage({ comparaison: 'retour_seul' }))).toBe(true);
    expect(needsCheck(damage({}))).toBe(false);
    expect(needsCheck(damage({ confiance: 0.2, statut: 'confirme' }))).toBe(false);
    expect(needsCheck(damage({ confiance: null, source: 'manuel' }))).toBe(false);
  });

  it('compte les dommages hors rejetés', () => {
    const counts = countDamages([damage({}), damage({ id: 'b', nouveau: false }), damage({ id: 'c', statut: 'rejete' }), damage({ id: 'd', statut: 'confirme' })]);
    expect(counts).toMatchObject({ total: 3, nouveaux: 2, existants: 1, confirmes: 1, rejetes: 1 });
  });

  it('trie : nouveaux, plus graves, plus sûrs', () => {
    const sorted = sortDamages([
      damage({ id: 'old', nouveau: false, gravite: 'grave' }),
      damage({ id: 'light', gravite: 'leger', confiance: 0.99 }),
      damage({ id: 'grave', gravite: 'grave', confiance: 0.7 }),
      damage({ id: 'mod', gravite: 'modere', confiance: 0.9 }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['grave', 'mod', 'light', 'old']);
  });
});
