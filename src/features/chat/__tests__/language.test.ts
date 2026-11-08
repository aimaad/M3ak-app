import { canListen, detectMessageLanguage } from '../language';

describe('langue d’un message', () => {
  it('français', () => {
    expect(detectMessageLanguage('Quelles voitures sont libres demain ?')).toBe('fr');
    expect(detectMessageLanguage('Il y a trois retours cette semaine, dont la Logan.')).toBe('fr');
    expect(detectMessageLanguage('')).toBe('fr');
  });
  it('arabe / darija en lettres arabes', () => {
    expect(detectMessageLanguage('شكون كرا هاد الطوموبيل ملي وقع هاد الضرر؟')).toBe('ar');
    expect(detectMessageLanguage('اليوم عندك 5 سيارات واجدين للكراء')).toBe('ar');
  });
  it('darija en lettres latines', () => {
    expect(detectMessageLanguage('Chnohoma les voitures li aykono dispo simana jaya ?')).toBe('darija-latin');
    expect(detectMessageLanguage('Simana jaya 3 tomobilat ghadi ykouno dispo')).toBe('darija-latin');
    expect(detectMessageLanguage('wach kayn tomobil dispo lyoum')).toBe('darija-latin');
  });
  it('« Écouter » est proposé sauf pour la darija latine', () => {
    expect(canListen('fr')).toBe(true);
    expect(canListen('ar')).toBe(true);
    expect(canListen('darija-latin')).toBe(false);
  });
});
