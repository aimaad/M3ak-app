import { isRTL } from '@/i18n';

describe('isRTL', () => {
  it('considère l\'arabe comme RTL', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('considère le français comme LTR', () => {
    expect(isRTL('fr')).toBe(false);
  });

  it('renvoie false pour une langue inconnue', () => {
    expect(isRTL('en')).toBe(false);
  });
});
