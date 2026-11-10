import { buildOfferMessage, discountedPrice, offerPeriod } from '../offer';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10);
const ymd = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe('offre', () => {
  it('remise arrondie', () => {
    expect(discountedPrice(500, 10)).toBe(450);
    expect(discountedPrice(333, 15)).toBe(283);
    expect(discountedPrice(500, 20)).toBe(400);
    expect(discountedPrice(0, 20)).toBe(0);
  });

  it('week-end : le prochain samedi et dimanche, ou ce qui reste du week-end', () => {
    // lundi 10 juin 2030 → samedi 15 et dimanche 16
    expect([ymd(offerPeriod('weekend', day(2030, 6, 10)).from), ymd(offerPeriod('weekend', day(2030, 6, 10)).to)]).toEqual(['2030-6-15', '2030-6-16']);
    // vendredi 14 → samedi 15 et dimanche 16
    expect(ymd(offerPeriod('weekend', day(2030, 6, 14)).from)).toBe('2030-6-15');
    // samedi 15 → aujourd'hui et demain ; dimanche 16 → aujourd'hui seulement
    expect([ymd(offerPeriod('weekend', day(2030, 6, 15)).from), ymd(offerPeriod('weekend', day(2030, 6, 15)).to)]).toEqual(['2030-6-15', '2030-6-16']);
    expect([ymd(offerPeriod('weekend', day(2030, 6, 16)).from), ymd(offerPeriod('weekend', day(2030, 6, 16)).to)]).toEqual(['2030-6-16', '2030-6-16']);
  });

  it('semaine : les 7 prochains jours', () => {
    const period = offerPeriod('week', day(2030, 6, 10));
    expect([ymd(period.from), ymd(period.to)]).toEqual(['2030-6-10', '2030-6-16']);
  });

  it('message en français : véhicule, prix remisé, prix d’origine, période, agence', () => {
    const message = buildOfferMessage({ vehicleName: 'Dacia Logan', price: 500, percent: 10, days: 'weekend', now: day(2030, 6, 10), language: 'fr', agencyName: 'Atlas Location' });
    expect(message).toContain('Offre week-end : Dacia Logan à 450 MAD/j au lieu de 500.');
    expect(message).toContain('Du ');
    expect(message).toContain(' au ');
    expect(message.endsWith('— Atlas Location')).toBe(true);
  });

  it('message en darija (arabe) et sans agence', () => {
    const message = buildOfferMessage({ vehicleName: 'Dacia Logan', price: 500, percent: 20, days: 'week', now: day(2030, 6, 10), language: 'ar' });
    expect(message).toContain('عرض الأسبوع');
    expect(message).toContain('400');
    expect(message).toContain('500');
    expect(message).not.toContain('—');
  });

  it('jamais deux points de suite (le mois abrégé en a déjà un)', () => {
    for (const language of ['fr', 'ar']) {
      for (const days of ['weekend', 'week'] as const) {
        expect(buildOfferMessage({ vehicleName: 'F1', price: 300, percent: 15, days, now: day(2030, 6, 10), language })).not.toContain('..');
      }
    }
  });

  it('un seul jour : « Le … » et non « Du … au … »', () => {
    const message = buildOfferMessage({ vehicleName: 'F1', price: 300, percent: 15, days: 'weekend', now: day(2030, 6, 16), language: 'fr' });
    expect(message).toContain('Le ');
    expect(message).not.toContain('Du ');
  });
});
