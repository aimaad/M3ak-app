import { changedKinds, draftFromRules, enabledKinds, mergeRules, toRule, validateRuleDraft } from '../logic';
import { PROPOSED_RULES } from '../types';

describe('règles d’échéances de l’agence', () => {
  it('sans réglage : les valeurs proposées (vidange 10 000, freins 30 000, pneus 40 000 km), tout activé', () => {
    const rules = mergeRules([]);
    expect(rules.find((rule) => rule.kind === 'vidange')).toMatchObject({ enabled: true, repeatKm: 10_000 });
    expect(rules.find((rule) => rule.kind === 'freins')).toMatchObject({ repeatKm: 30_000 });
    expect(rules.find((rule) => rule.kind === 'pneus')).toMatchObject({ repeatKm: 40_000 });
    expect(rules.every((rule) => rule.enabled)).toBe(true);
    expect(rules).toHaveLength(PROPOSED_RULES.length);
  });

  it('un réglage enregistré remplace la valeur proposée, y compris « désactivé » et « sans périodicité »', () => {
    const rules = mergeRules([{ kind: 'pneus', enabled: false, repeatKm: null, repeatMonths: null }, { kind: 'vidange', enabled: true, repeatKm: 15_000, repeatMonths: 12 }]);
    expect(rules.find((rule) => rule.kind === 'pneus')).toMatchObject({ enabled: false, repeatKm: null });
    expect(rules.find((rule) => rule.kind === 'vidange')).toMatchObject({ repeatKm: 15_000, repeatMonths: 12 });
    expect(rules.find((rule) => rule.kind === 'freins')).toMatchObject({ repeatKm: 30_000 }); // non réglée : proposée
  });

  it('brouillon : chiffres en texte, vide = pas de périodicité', () => {
    const draft = draftFromRules([{ kind: 'vidange', enabled: true, repeatKm: 15_000, repeatMonths: null }]);
    expect(draft.vidange).toEqual({ enabled: true, km: '15000', months: '' });
    expect(draft.assurance).toEqual({ enabled: true, km: '', months: '' });
  });

  it('validation : entiers positifs, km ≤ 1 000 000, mois ≤ 120', () => {
    const draft = draftFromRules([]);
    expect(validateRuleDraft(draft)).toEqual({});
    expect(validateRuleDraft({ ...draft, vidange: { ...draft.vidange, km: '0' } })).toEqual({ vidange: 'invalid_km' });
    expect(validateRuleDraft({ ...draft, freins: { ...draft.freins, km: '12.5' } })).toEqual({ freins: 'invalid_km' });
    expect(validateRuleDraft({ ...draft, pneus: { ...draft.pneus, months: '500' } })).toEqual({ pneus: 'invalid_months' });
  });

  it('seules les règles modifiées sont repérées', () => {
    const initial = draftFromRules([]);
    expect(changedKinds(initial, initial)).toEqual([]);
    expect(changedKinds(initial, { ...initial, pneus: { ...initial.pneus, enabled: false }, vidange: { ...initial.vidange, km: '15000' } })).toEqual(['vidange', 'pneus']);
  });

  it('enregistrement : les obligations n’ont jamais de périodicité', () => {
    const draft = { ...draftFromRules([]), assurance: { enabled: false, km: '5000', months: '6' } };
    expect(toRule('assurance', draft)).toEqual({ kind: 'assurance', enabled: false, repeatKm: null, repeatMonths: null });
    expect(toRule('vidange', { ...draft, vidange: { enabled: true, km: '12000', months: '12' } })).toEqual({ kind: 'vidange', enabled: true, repeatKm: 12_000, repeatMonths: 12 });
  });

  it('une obligation désactivée n’est plus proposée', () => {
    const kinds = enabledKinds([{ kind: 'vignette', enabled: false, repeatKm: null, repeatMonths: null }]);
    expect(kinds.has('vignette')).toBe(false);
    expect(kinds.has('assurance')).toBe(true);
  });
});
