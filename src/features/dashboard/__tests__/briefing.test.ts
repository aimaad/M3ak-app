import { buildBriefing, parseTemplate, pickPriority, type BriefingInput } from '../briefing';

const base: BriefingInput = { free: 5, total: 10, late: 0, insp: 0, conflicts: 0, unpaid: 0, expiredDocs: 0, showMoney: true };
const main = (lang: 'fr' | 'darija', over: Partial<BriefingInput>) => {
  const b = buildBriefing(lang, { ...base, ...over });
  return b.main.map((p) => p.text).join('');
};
const priority = (lang: 'fr' | 'darija', over: Partial<BriefingInput>) =>
  buildBriefing(lang, { ...base, ...over }).priority.map((p) => p.text).join('');

describe('briefing : modèles', () => {
  it('« ** » met en évidence, {n} est remplacé', () => {
    expect(parseTemplate('A **{n} voitures** B', { n: 4 })).toEqual([
      { text: 'A ', strong: false },
      { text: '4 voitures', strong: true },
      { text: ' B', strong: false },
    ]);
  });
});

describe('briefing FR : phrase principale', () => {
  it('libres : aucune, une, plusieurs', () => {
    expect(main('fr', { free: 0 })).toBe("Aujourd'hui, aucune voiture n'est libre à la location. Rien à signaler.");
    expect(main('fr', { free: 1 })).toBe("Aujourd'hui, 1 voiture est prête à louer. Rien à signaler.");
    expect(main('fr', { free: 5 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer. Rien à signaler.");
  });
  it('retards seuls', () => {
    expect(main('fr', { late: 1 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer et 1 retour est en retard.");
    expect(main('fr', { late: 2 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer et 2 retours sont en retard.");
  });
  it('inspections seules', () => {
    expect(main('fr', { insp: 1 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer et 1 voiture attend une inspection.");
    expect(main('fr', { insp: 3 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer et 3 voitures attendent une inspection.");
  });
  it('retards et inspections : « A, B et C. » (la maquette)', () => {
    expect(main('fr', { late: 2, insp: 1 })).toBe("Aujourd'hui, 5 voitures sont prêtes à louer, 2 retours sont en retard et 1 voiture attend une inspection.");
    expect(main('fr', { free: 0, late: 1, insp: 2 })).toBe("Aujourd'hui, aucune voiture n'est libre à la location, 1 retour est en retard et 2 voitures attendent une inspection.");
  });
});

describe('briefing darija : phrase principale', () => {
  it('libres : aucune, une, plusieurs, « كلشي مزيان » quand rien à signaler', () => {
    expect(main('darija', { free: 0 })).toBe('اليوم ما عندك حتى سيارة واجدة للكراء. كلشي مزيان.');
    expect(main('darija', { free: 1 })).toBe('اليوم عندك 1 سيارة واجدة للكراء. كلشي مزيان.');
    expect(main('darija', { free: 5 })).toBe('اليوم عندك 5 سيارات واجدين للكراء. كلشي مزيان.');
  });
  it('retards, inspections et les deux : « A، B، و C. »', () => {
    expect(main('darija', { late: 1 })).toBe('اليوم عندك 5 سيارات واجدين للكراء، 1 رجوع متأخر.');
    expect(main('darija', { late: 2 })).toBe('اليوم عندك 5 سيارات واجدين للكراء، 2 رجوعات متأخرة.');
    expect(main('darija', { insp: 1 })).toBe('اليوم عندك 5 سيارات واجدين للكراء، و 1 سيارة خاصها فحص.');
    expect(main('darija', { late: 2, insp: 3 })).toBe('اليوم عندك 5 سيارات واجدين للكراء، 2 رجوعات متأخرة، و 3 سيارات خاصها فحص.');
  });
});

describe('briefing : tous les cas sont bien formés', () => {
  it('jamais de double espace, de séparateur orphelin, ni de phrase vide ; toujours un point final', () => {
    for (const lang of ['fr', 'darija'] as const) {
      for (const free of [0, 1, 2, 7]) for (const late of [0, 1, 2]) for (const insp of [0, 1, 4]) {
        const m = main(lang, { free, late, insp });
        expect(m).not.toMatch(/\s{2,}|undefined|NaN|\{|\*\*/);
        expect(m.length).toBeGreaterThan(10);
        expect(m.trim().endsWith('.')).toBe(true);
        expect(m).toContain('.');
        if (late === 0 && insp === 0) expect(m).toContain(lang === 'fr' ? 'Rien à signaler.' : 'كلشي مزيان.');
        else expect(m).not.toContain(lang === 'fr' ? 'Rien à signaler.' : 'كلشي مزيان.');
      }
    }
  });
  it('les chiffres sont en évidence (FR : « 5 voitures », darija : « 5 »)', () => {
    const fr = buildBriefing('fr', { ...base, free: 5, late: 2 }).main.filter((p) => p.strong).map((p) => p.text);
    expect(fr).toEqual(['5 voitures', '2 retours']);
    const ar = buildBriefing('darija', { ...base, free: 5, late: 2 }).main.filter((p) => p.strong).map((p) => p.text);
    expect(ar).toEqual(['5', '2']);
  });
});

describe('briefing : priorité', () => {
  it('ordre : conflit > retards > impayés > documents > rien', () => {
    expect(pickPriority({ ...base, conflicts: 1, late: 2, unpaid: 3, expiredDocs: 1 })).toBe('conflict');
    expect(pickPriority({ ...base, late: 2, unpaid: 3, expiredDocs: 1 })).toBe('late');
    expect(pickPriority({ ...base, unpaid: 3, expiredDocs: 1 })).toBe('unpaid');
    expect(pickPriority({ ...base, expiredDocs: 1 })).toBe('documents');
    expect(pickPriority(base)).toBeNull();
  });
  it('responsable et employé : jamais la priorité « Impayés »', () => {
    expect(pickPriority({ ...base, showMoney: false, unpaid: 4 })).toBeNull();
    expect(pickPriority({ ...base, showMoney: false, unpaid: 4, expiredDocs: 2 })).toBe('documents');
  });
  it('FR : part du parc libre puis la priorité', () => {
    expect(priority('fr', { free: 5, total: 10, late: 2 })).toBe('Flotte prête à 50 %. Priorité : appeler les 2 clients en retard.');
    expect(priority('fr', { late: 1 })).toBe('Flotte prête à 50 %. Priorité : appeler le client en retard.');
    expect(priority('fr', { conflicts: 2 })).toBe('Flotte prête à 50 %. Priorité : réaffecter 2 réservations menacées.');
    expect(priority('fr', { unpaid: 1 })).toBe('Flotte prête à 50 %. Priorité : relancer 1 dossier impayé.');
    expect(priority('fr', { expiredDocs: 3 })).toBe('Flotte prête à 50 %. Priorité : mettre à jour 3 documents.');
    expect(priority('fr', {})).toBe('Flotte prête à 50 %. Belle journée !');
  });
  it('darija : même logique', () => {
    expect(priority('darija', { late: 2 })).toBe('الأسطول واجد ب 50%. الأولوية: اتصل بـ 2 ديال الزبناء لي رجوعهم متأخر.');
    expect(priority('darija', { conflicts: 1 })).toBe('الأسطول واجد ب 50%. الأولوية: بدّل السيارة ل 1 حجز.');
    expect(priority('darija', { unpaid: 3 })).toBe('الأسطول واجد ب 50%. الأولوية: تبّع الخلاص، 3 كراءات باقي خاصها تتقبض.');
    expect(priority('darija', { expiredDocs: 2 })).toBe('الأسطول واجد ب 50%. الأولوية: 2 ديال الوثائق خاصها تجديد.');
    expect(priority('darija', {})).toBe('الأسطول واجد ب 50%. نهار مبروك!');
  });
  it('parc vide : pas de pourcentage', () => {
    expect(priority('fr', { total: 0, free: 0 })).toBe('Belle journée !');
  });
  it('texte complet pour le lecteur d’écran', () => {
    expect(buildBriefing('fr', { ...base, late: 2 }).plain).toBe("Aujourd'hui, 5 voitures sont prêtes à louer et 2 retours sont en retard. Flotte prête à 50 %. Priorité : appeler les 2 clients en retard.");
  });
});
