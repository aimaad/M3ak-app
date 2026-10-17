import fr from '@/i18n/locales/fr.json';

import { buildAuditHtml, escapeHtml } from '../audit-pdf';
import { describeAuditEntry } from '../describe';
import { toAuditQuery } from '../hooks';
import { auditPeriodStart, type AuditEntry } from '../types';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

/** Traducteur minimal basé sur fr.json, avec interpolation {{x}}. */
function t(key: string, params: Record<string, unknown> = {}): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr);
  const text = typeof value === 'string' ? value : typeof params.defaultValue === 'string' ? params.defaultValue : key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''));
}

const base: AuditEntry = {
  id: '1', actorId: 'u1', actorName: 'Sara', actorRole: 'employee', category: 'rental',
  action: 'rental_created', targetLabel: 'RES-2026-00003', details: { vehicle: 'Dacia Logan', customer: 'Fouad B.', total: 1500 },
  createdAt: '2026-10-01T10:00:00Z',
};

describe('describeAuditEntry', () => {
  it('décrit une location en français lisible', () => {
    const text = describeAuditEntry(base, t);
    expect(text).toContain('Sara');
    expect(text).toContain('RES-2026-00003');
    expect(text).toContain('Dacia Logan');
    expect(text).toContain('Fouad B.');
    expect(text).toMatch(/1\s?500 MAD/);
  });

  it("n'affiche jamais un code technique pour une action inconnue", () => {
    const text = describeAuditEntry({ ...base, action: 'quelque_chose_de_nouveau' }, t);
    expect(text).toBe('Sara a effectué une action');
    expect(text).not.toContain('quelque_chose');
  });

  it('cite le nom des champs modifiés mais jamais leur valeur ni une colonne inconnue', () => {
    const text = describeAuditEntry(
      { ...base, action: 'customer_updated', targetLabel: 'Ali', details: { fields: ['telephone', 'mot_de_passe_secret'] } },
      t
    );
    expect(text).toContain('téléphone');
    expect(text).not.toContain('secret');
  });

  it("remplace l'auteur manquant par un texte neutre", () => {
    expect(describeAuditEntry({ ...base, actorName: null }, t)).toContain('Quelqu');
  });

  it('couvre toutes les actions déclarées dans fr.json par un texte non vide', () => {
    for (const [action, text] of Object.entries(fr.journal.actions)) {
      expect(text.length).toBeGreaterThan(5);
      expect(action).toMatch(/^[a-z_]+$/);
    }
  });
});

describe('PDF', () => {
  const input = {
    agencyName: 'Agence <script>alert(1)</script>',
    entries: [{ ...base, actorName: '<b>Hack</b>', targetLabel: '"x" & y' }],
    truncated: true,
    filterLabels: ['7 jours', 'Tous les employés'],
    generatedBy: 'Imad',
    generatedAt: new Date('2026-10-17T08:00:00Z'),
    language: 'fr' as const,
    t,
  };

  it('échappe tout texte venant de la base', () => {
    const html = buildAuditHtml(input);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Hack');
    expect(html).toContain('&lt;b&gt;Hack');
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;');
  });

  it('contient en-tête, rôle traduit, avertissement de troncature et mention de confidentialité', () => {
    const html = buildAuditHtml(input);
    expect(html).toContain('Rapport de traçabilité');
    expect(html).toContain('Employé');
    expect(html).toContain('Imad');
    expect(html).toContain('Seules les 2000');
    expect(html).toContain('confidentiel');
  });

  it("passe en RTL en arabe et affiche un message si la sélection est vide", () => {
    const html = buildAuditHtml({ ...input, entries: [], truncated: false, language: 'ar' });
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('Seules les 2000');
  });
});

describe('période', () => {
  const now = new Date(2026, 9, 17, 15, 30);
  it('calcule le début de chaque période', () => {
    expect(auditPeriodStart('all', now)).toBeNull();
    expect(new Date(auditPeriodStart('today', now) as string)).toEqual(new Date(2026, 9, 17));
    expect(new Date(auditPeriodStart('7d', now) as string)).toEqual(new Date(2026, 9, 11));
    expect(new Date(auditPeriodStart('30d', now) as string)).toEqual(new Date(2026, 8, 18));
  });

  it('transforme les filtres en requête', () => {
    const q = toAuditQuery('a1', { period: 'today', actorId: 'u1', category: 'payment' }, now);
    expect(q).toEqual({ agencyId: 'a1', from: new Date(2026, 9, 17).toISOString(), actorId: 'u1', category: 'payment' });
  });
});
