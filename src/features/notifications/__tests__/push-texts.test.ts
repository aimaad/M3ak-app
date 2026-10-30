import { PUSH_KINDS, renderPush } from '../../../../supabase/functions/send-push/texts';

describe('textes des notifications push', () => {
  const params = { customer: 'Karim Alami', phone: '0661000001', vehicle: 'Dacia Logan', plate: '1-A-1' };

  it('rappel de retour : nom, voiture et numéro à appeler', () => {
    const fr = renderPush('return_tomorrow', params, 'fr');
    expect(fr.title).toBe('Retour prévu demain');
    expect(fr.body).toContain('Karim Alami');
    expect(fr.body).toContain('0661000001');
    expect(renderPush('return_tomorrow', params, 'ar').body).toContain('0661000001');
  });
  it("mentionne la filiale seulement si elle existe", () => {
    expect(renderPush('rental_created', { ...params, branch: 'Casa' }, 'fr').body).toContain('Filiale : Casa');
    expect(renderPush('rental_created', params, 'fr').body).not.toContain('Filiale');
    expect(renderPush('rental_created', { ...params, branch: 'الدار البيضاء' }, 'ar').body).toContain('الفرع');
  });
  it('traduit le type d’entretien et ne laisse aucune variable vide', () => {
    const text = renderPush('maintenance_due', { vehicle: 'Dacia Logan', plate: '1-A-1', maintenance: 'vidange', date: '2030-06-12' }, 'fr');
    expect(text.body).toContain('la vidange');
    expect(text.body).not.toMatch(/[{}]/);
    expect(renderPush('return_late', {}, 'fr').body).not.toMatch(/[{}]/);
  });
  it('type inconnu : message neutre, jamais d’erreur', () => {
    expect(renderPush('inconnu', {}, 'fr').body).toBe('Vous avez une nouvelle notification.');
  });
  it('chaque type existe en français ET en arabe', () => {
    for (const kind of PUSH_KINDS) {
      expect(renderPush(kind, params, 'fr').title).not.toBe('M3ak');
      expect(renderPush(kind, params, 'ar').title).not.toBe('M3ak');
    }
  });
});
