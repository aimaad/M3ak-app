import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

import { notificationRoute, notificationView, timeAgo } from '../render';

type Dict = Record<string, unknown>;

/** Mini i18n : clés pointées + {{variables}}, renvoie la clé si elle n'existe pas (comme i18next). */
function makeT(dict: Dict) {
  return (key: string, options: Record<string, unknown> = {}) => {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], dict);
    if (typeof value !== 'string') return key;
    return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => (options[name] == null ? '' : String(options[name])));
  };
}

const tFr = makeT(fr);
const tAr = makeT(ar);
const params = { customer: 'Karim Alami', phone: '0661000001', vehicle: 'Dacia Logan', plate: '1-A-1' };

describe('notificationView', () => {
  it('écrit le rappel de retour avec le client, la voiture et le numéro à appeler', () => {
    const view = notificationView({ kind: 'return_tomorrow', params }, tFr, 'fr');
    expect(view.title).toBe('Retour prévu demain');
    expect(view.body).toContain('Karim Alami');
    expect(view.body).toContain('Dacia Logan');
    expect(view.phone).toBe('0661000001');
  });
  it('fonctionne aussi en arabe', () => {
    const view = notificationView({ kind: 'return_tomorrow', params }, tAr, 'ar');
    expect(view.body).toContain('Karim Alami');
    expect(view.title).not.toBe('notifications.kinds.return_tomorrow.title');
  });
  it('ne mentionne la filiale que si elle existe', () => {
    expect(notificationView({ kind: 'rental_created', params: { ...params, branch: 'Casa' } }, tFr, 'fr').branch).toBe('Casa');
    expect(notificationView({ kind: 'rental_created', params }, tFr, 'fr').branch).toBeNull();
  });
  it('remplace une valeur manquante par « — » et ne montre jamais une clé brute', () => {
    const view = notificationView({ kind: 'return_late', params: {} }, tFr, 'fr');
    expect(view.body).toContain('—');
    expect(view.body).not.toMatch(/notifications\.|\{\{/);
    expect(view.phone).toBeNull();
  });
  it('type inconnu : texte neutre', () => {
    expect(notificationView({ kind: 'inconnu', params: {} }, tFr, 'fr').body).toBe('Vous avez une nouvelle notification.');
  });
  it("traduit le type d'entretien", () => {
    const view = notificationView({ kind: 'maintenance_due', params: { vehicle: 'Dacia Logan', plate: '1-A-1', maintenance: 'vidange', date: '2030-06-12' } }, tFr, 'fr');
    expect(view.body).toContain('la vidange');
  });
  it('chaque type de notification existe en français et en arabe', () => {
    const kinds = Object.keys((fr as unknown as { notifications: { kinds: Dict } }).notifications.kinds);
    expect(kinds.length).toBeGreaterThan(15);
    expect(Object.keys((ar as unknown as { notifications: { kinds: Dict } }).notifications.kinds).sort()).toEqual([...kinds].sort());
  });
});

describe('notificationRoute', () => {
  it('ouvre la location, le contrat, le véhicule ou le client concerné', () => {
    expect(notificationRoute('rental', 'r1')).toEqual({ pathname: '/locations/[id]', params: { id: 'r1' } });
    expect(notificationRoute('contract', 'c1')).toEqual({ pathname: '/contrats/[id]', params: { id: 'c1' } });
    expect(notificationRoute('vehicle', 'v1')).toEqual({ pathname: '/flotte/[id]', params: { id: 'v1' } });
    expect(notificationRoute('customer', 'u1')).toEqual({ pathname: '/clients/[id]', params: { id: 'u1' } });
  });
  it('sans identifiant, ouvre la liste ; sans lien, rien', () => {
    expect(notificationRoute('rental', null)).toEqual({ pathname: '/locations' });
    expect(notificationRoute(null, null)).toBeNull();
  });
});

describe('timeAgo', () => {
  const now = new Date('2030-06-10T12:00:00Z');
  it('minutes, heures puis jours', () => {
    expect(timeAgo('2030-06-10T11:59:40Z', now, tFr)).toBe("À l'instant");
    expect(timeAgo('2030-06-10T11:30:00Z', now, tFr)).toBe('Il y a 30 min');
    expect(timeAgo('2030-06-10T09:00:00Z', now, tFr)).toBe('Il y a 3 h');
    expect(timeAgo('2030-06-08T12:00:00Z', now, tFr)).toBe('Il y a 2 j');
  });
});
