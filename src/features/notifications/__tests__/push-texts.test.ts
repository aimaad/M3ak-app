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
      expect(renderPush(kind, params, 'fr').title).not.toBe('BIBIP');
      expect(renderPush(kind, params, 'ar').title).not.toBe('BIBIP');
    }
  });
  it('rappels des obligations : assurance, visite technique et vignette, en français et en arabe, sans variable vide', () => {
    for (const maintenance of ['assurance', 'visite_technique', 'vignette']) {
      for (const kind of ['compliance_due', 'compliance_expired']) {
        for (const locale of ['fr', 'ar'] as const) {
          const text = renderPush(kind, { vehicle: 'Dacia Logan', plate: '1-A-1', maintenance, date: '2030-06-12' }, locale);
          expect(text.body).not.toMatch(/[{}—]/);
          expect(text.title).not.toMatch(/[{}]/);
        }
      }
    }
    expect(renderPush('compliance_due', { vehicle: 'Dacia Logan', plate: '1-A-1', maintenance: 'vignette', date: '2030-06-12' }, 'fr').body).toContain('la vignette');
  });
});

describe('push : notifications d’entretien', () => {
  it('veille, jour même, kilométrage et suivi : français et arabe, sans variable vide', () => {
    const params = { maintenance: 'vidange', vehicle: 'Dacia Logan', plate: '1-A-1', date: '2026-11-16', km: 50000, left: 400 };
    for (const kind of ['maintenance_eve', 'maintenance_today', 'maintenance_km_soon', 'maintenance_km_reached', 'maintenance_followup']) {
      for (const locale of ['fr', 'ar'] as const) {
        const text = renderPush(kind, params, locale);
        expect(text.title).not.toBe('BIBIP');
        expect(text.body).not.toMatch(/[{}—]/);
      }
    }
    expect(renderPush('maintenance_followup', params, 'fr').body).toContain('Avez-vous fait la vidange');
  });
});

describe('push : entretien « Autre » nommé', () => {
  it('le nom est dit, en français et en arabe', () => {
    const params = { maintenance: 'autre', label: 'Courroie de distribution', vehicle: 'Dacia Logan', plate: '1-A-1' };
    expect(renderPush('maintenance_followup', params, 'fr').body).toContain('l\'entretien « Courroie de distribution »');
    expect(renderPush('maintenance_followup', params, 'ar').body).toContain('«Courroie de distribution»');
  });
});

describe('push : planification et conflits', () => {
  it('rappels du rendez-vous et conflit : français et arabe, sans variable vide', () => {
    const params = { maintenance: 'vidange', vehicle: 'Dacia Logan', plate: '1-A-1', customer: 'Karim Alami', date: '2030-12-21', time: '10:00' };
    for (const kind of ['maintenance_planned_eve', 'maintenance_planned_today', 'maintenance_conflict']) {
      for (const locale of ['fr', 'ar'] as const) {
        const text = renderPush(kind, params, locale);
        expect(text.title).not.toBe('BIBIP');
        expect(text.body).not.toMatch(/[{}—]/);
      }
    }
    expect(renderPush('maintenance_conflict', params, 'fr').body).toContain('Karim Alami');
    expect(renderPush('maintenance_planned_eve', params, 'fr').body).toContain('10:00');
  });
});
