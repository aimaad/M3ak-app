import { DeferredDeleter } from '../deferred-delete';
import { groupConversations, matchesSearch } from '../history';
import { makeTitle } from '../titles';
import type { ChatConversation } from '../types';
import { newId } from '../uuid';

const NOW = new Date(2026, 10, 8, 15, 0, 0); // dim. 8 nov. 2026
const conv = (id: string, daysAgo: number, hour = 10, title = id, preview: string | null = null): ChatConversation => ({
  id,
  title,
  preview,
  viaVoice: false,
  updatedAt: new Date(2026, 10, 8 - daysAgo, hour).toISOString(),
});

describe('historique : regroupement par date', () => {
  it('aujourd’hui, hier, cette semaine, puis un groupe par mois', () => {
    const sections = groupConversations(
      [conv('a', 0, 14), conv('b', 0, 9), conv('c', 1), conv('d', 3), conv('e', 6), conv('j', 7), conv('f', 9), conv('g', 15), conv('h', 20, 10), conv('i', 40)],
      NOW
    );
    expect(sections.map((s) => [s.key, s.items.map((i) => i.id)])).toEqual([
      ['today', ['a', 'b']],
      ['yesterday', ['c']],
      ['week', ['d', 'e']],
      ['2026-11', ['j']],
      ['2026-10', ['f', 'g', 'h']],
      ['2026-09', ['i']],
    ]);
    expect(sections[3].kind).toBe('month');
    expect(sections[3].month?.getMonth()).toBe(10);
  });
  it('liste vide : aucun groupe', () => {
    expect(groupConversations([], NOW)).toEqual([]);
  });
});

describe('historique : recherche', () => {
  it('titre ou aperçu, sans casse ni accents', () => {
    const c = conv('x', 0, 10, 'Voitures dispo la semaine prochaine', 'Trois véhicules sont libres');
    expect(matchesSearch(c, 'DISPO')).toBe(true);
    expect(matchesSearch(c, 'vehicules')).toBe(true);
    expect(matchesSearch(c, 'retard')).toBe(false);
    expect(matchesSearch(c, '')).toBe(true);
  });
});

describe('titre automatique', () => {
  it('court, dans la langue de la question, majuscule initiale', () => {
    expect(makeTitle('  qui est en retard ? ')).toBe('Qui est en retard');
    expect(makeTitle('chnohoma les voitures li aykono dispo simana jaya')).toBe('Chnohoma les voitures li aykono dispo simana…');
    expect(makeTitle('شكون كرا هاد الطوموبيل؟')).toBe('شكون كرا هاد الطوموبيل');
  });
  it('première phrase seulement, coupé à un mot entier avec « … »', () => {
    expect(makeTitle('Combien de voitures ? Et aussi les clients')).toBe('Combien de voitures');
    const long = makeTitle('Quelles voitures reviennent cette semaine avec un retard de plus de deux jours chez les clients');
    expect(long.length).toBeLessThanOrEqual(49);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });
  it('texte vide : titre vide', () => {
    expect(makeTitle('   ')).toBe('');
  });
});

describe('suppression avec annulation (5 s)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const make = () => {
    const committed: string[] = [];
    const hiddenLog: string[][] = [];
    const d = new DeferredDeleter<{ id: string }>({
      delayMs: 5000,
      commit: (item) => committed.push(item.id),
      onChange: (ids) => hiddenLog.push([...ids]),
    });
    return { d, committed, hiddenLog };
  };

  it('la conversation disparaît tout de suite et n’est supprimée qu’après 5 s', () => {
    const { d, committed } = make();
    d.schedule('a', { id: 'a' });
    expect([...d.hiddenIds()]).toEqual(['a']);
    jest.advanceTimersByTime(4999);
    expect(committed).toEqual([]);
    jest.advanceTimersByTime(2);
    expect(committed).toEqual(['a']);
    expect([...d.hiddenIds()]).toEqual([]);
  });
  it('« Annuler » remet la conversation et rien n’est supprimé', () => {
    const { d, committed } = make();
    d.schedule('a', { id: 'a' });
    d.undo('a');
    expect([...d.hiddenIds()]).toEqual([]);
    jest.advanceTimersByTime(10_000);
    expect(committed).toEqual([]);
  });
  it('fermer l’écran termine les suppressions en attente', () => {
    const { d, committed } = make();
    d.schedule('a', { id: 'a' });
    d.schedule('b', { id: 'b' });
    d.flush();
    expect(committed.sort()).toEqual(['a', 'b']);
    jest.advanceTimersByTime(10_000);
    expect(committed).toHaveLength(2);
  });
});

describe('conversation neuve : identifiant créé par l’app', () => {
  it('UUID v4 valide, différent à chaque appel', () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(a);
  });
});
