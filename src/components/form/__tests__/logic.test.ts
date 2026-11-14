import { colorKey, digitsOnly, filledCount, formatThousands, MIN_PHOTO_BYTES, photoProblem, relativeDay, round50, suggestWeekMonth, toIsoDay } from '../logic';

const NOW = new Date(2026, 10, 15, 12);
const day = (delta: number) => toIsoDay(new Date(2026, 10, 15 + delta));

describe('nombres', () => {
  it('séparateur de milliers, pas de zéro de tête', () => {
    expect(formatThousands('45200')).toBe('45 200');
    expect(formatThousands('1234567')).toBe('1 234 567');
    expect(formatThousands('007')).toBe('7');
    expect(formatThousands('')).toBe('');
    expect(digitsOnly('45 200 km')).toBe('45200');
  });
  it('arrondi à 50', () => {
    expect(round50(2975)).toBe(3000);
    expect(round50(1024)).toBe(1000);
    expect(round50(1025)).toBe(1050);
  });
});

describe('prix suggérés (semaine −15 %, mois −30 %)', () => {
  it('500/jour → semaine 3 000, mois 10 500', () => {
    expect(suggestWeekMonth(500)).toEqual({ week: 3000, month: 10500, weekPct: 15, monthPct: 30 });
  });
  it('300/jour → 1 800 (1 785) et 6 300', () => {
    expect(suggestWeekMonth(300)).toMatchObject({ week: 1800, month: 6300 });
  });
  it('pas de prix du jour valable : aucune suggestion (jamais de valeur inventée)', () => {
    expect(suggestWeekMonth(null)).toBeNull();
    expect(suggestWeekMonth(0)).toBeNull();
    expect(suggestWeekMonth(Number.NaN)).toBeNull();
  });
});

describe('rappel relatif d’une date', () => {
  it('aujourd’hui, demain, hier', () => {
    expect(relativeDay(day(0), NOW)).toEqual({ key: 'today' });
    expect(relativeDay(day(1), NOW)).toEqual({ key: 'tomorrow' });
    expect(relativeDay(day(-1), NOW)).toEqual({ key: 'yesterday' });
  });
  it('dans N jours puis en mois à partir de 30 jours', () => {
    expect(relativeDay(day(3), NOW)).toEqual({ key: 'inDays', n: 3 });
    expect(relativeDay(day(29), NOW)).toEqual({ key: 'inDays', n: 29 });
    expect(relativeDay(day(30), NOW)).toEqual({ key: 'inMonthOne' });
    expect(relativeDay(day(365), NOW)).toEqual({ key: 'inMonths', n: 12 });
  });
  it('il y a N jours / mois', () => {
    expect(relativeDay(day(-5), NOW)).toEqual({ key: 'agoDays', n: 5 });
    expect(relativeDay(day(-60), NOW)).toEqual({ key: 'agoMonths', n: 2 });
    expect(relativeDay(day(-30), NOW)).toEqual({ key: 'agoMonthOne' });
  });
});

describe('couleurs', () => {
  it('« BLANC », « blanc », « Blanc » → la pastille Blanc', () => {
    for (const raw of ['BLANC', 'blanc', ' Blanc ', 'Blanc']) expect(colorKey(raw)).toBe('blanc');
  });
  it('accents et casse ignorés', () => {
    expect(colorKey('ARGENT')).toBe('argent');
  });
  it('vide : aucune pastille ; inconnue : « Autre »', () => {
    expect(colorKey('')).toBeNull();
    expect(colorKey(null)).toBeNull();
    expect(colorKey('Vert olive')).toBe('other');
  });
});

describe('contrôle d’une photo avant envoi', () => {
  it('côté long < 1000 px : trop petite', () => {
    expect(photoProblem({ width: 800, height: 600, bytes: 500_000 })).toBe('too_small');
  });
  it('fichier < 30 Ko : trop petite', () => {
    expect(photoProblem({ width: 2000, height: 1500, bytes: MIN_PHOTO_BYTES - 1 })).toBe('too_small');
  });
  it('une photo normale passe (le côté long compte, pas l’orientation)', () => {
    expect(photoProblem({ width: 1500, height: 900, bytes: 400_000 })).toBeNull();
    expect(photoProblem({ width: 900, height: 1600, bytes: 400_000 })).toBeNull();
    expect(photoProblem({ width: 1000, height: 700, bytes: MIN_PHOTO_BYTES })).toBeNull();
  });
});

describe('avancement', () => {
  it('compte les cases remplies', () => {
    expect(filledCount([{ uri: 'a' }, { uri: null }, { uri: 'b' }])).toBe(2);
  });
});
