import { buildCards, parseModelStep, redactMoney, redactMoneyText, resultForRole, systemPrompt } from '../../../../supabase/functions/chat-m3ak/logic';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const R1 = '33333333-3333-4333-8333-333333333333';

/** Lignes d'outils telles que les renvoient les fonctions SQL (extraits de supabase/migrations 0054, 0058, 0059). */
const available = [
  { vehicle_id: V1, vehicle: 'Dacia Logan', plate: '8921-ب-14', price_per_day: 250, branch: 'Centre' },
  { vehicle_id: V2, vehicle: 'Renault Clio 5', plate: '45123-أ-1', price_per_day: 350, branch: null },
];
const history = [{ rental_id: R1, numero: 'LOC-1', vehicle: 'Dacia Logan', total_price: 1500, paid: 500, customer: 'Karim', start: '2026-11-01T10:00:00Z', end: '2026-11-05T10:00:00Z' }];
const finance = { collected: 12000, pending_payments: 800, refunds: 0, booked_revenue: 30000, unpaid_total: 6100, unpaid_rentals: [{ rental_id: R1, balance: 1000, total_price: 1500 }], deposits: { currently_blocked: 2000, retained_total: 600 } };
const fleet = { total_vehicles: 8, vehicles: [{ model: 'Logan', plate: '8921', status: 'disponible', km: 47900, daily_price: 250 }] };
const damages = [{ vehicle: 'Dacia Logan', type: 'rayure', validated_cost: 300, estimated_cost: 350, new_since_departure: true }];

const MONEY_WORDS = /(price|prix|paid|balance|revenue|cost|deposit|collected|unpaid|pending|booked|retained|refund)/i;
const keysDeep = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysDeep) : typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]) : [];

describe('chat : aucun montant pour un non-propriétaire', () => {
  it.each(['manager', 'employee'] as const)('%s : tous les champs d’argent sont retirés de chaque outil', (role) => {
    for (const [tool, data] of [['available_vehicles', available], ['customer_history', history], ['fleet', fleet], ['vehicle_damages', damages]] as const) {
      const visible = resultForRole(tool, data, role);
      expect(keysDeep(visible).filter((k) => MONEY_WORDS.test(k))).toEqual([]);
    }
  });

  it('le reste des données est conservé (noms, plaques, dates, nombres de véhicules)', () => {
    const visible = resultForRole('customer_history', history, 'employee') as Record<string, unknown>[];
    expect(visible[0]).toEqual({ rental_id: R1, numero: 'LOC-1', vehicle: 'Dacia Logan', customer: 'Karim', start: '2026-11-01T10:00:00Z', end: '2026-11-05T10:00:00Z' });
    const stock = resultForRole('fleet', fleet, 'manager') as { total_vehicles: number; vehicles: Record<string, unknown>[] };
    expect(stock.total_vehicles).toBe(8);
    expect(stock.vehicles[0]).toEqual({ model: 'Logan', plate: '8921', status: 'disponible', km: 47900 });
  });

  it('l’outil « finance » ne renvoie rien d’autre qu’un refus', () => {
    expect(resultForRole('finance', finance, 'manager')).toEqual({ restricted: 'owner_only' });
    expect(resultForRole('finance', finance, 'employee')).toEqual({ restricted: 'owner_only' });
    expect(JSON.stringify(resultForRole('finance', finance, 'employee'))).not.toMatch(/12000|30000|6100/);
  });

  it('le propriétaire voit tout, inchangé', () => {
    expect(resultForRole('finance', finance, 'owner')).toBe(finance);
    expect(resultForRole('available_vehicles', available, 'owner')).toBe(available);
  });

  it('redactMoney retire les champs à tous les niveaux', () => {
    expect(redactMoney({ a: 1, unpaid_total: 5, nested: [{ balance: 3, ok: 'x' }] })).toEqual({ a: 1, nested: [{ ok: 'x' }] });
  });

  it('filet de sécurité : un montant écrit dans la réponse est masqué (hors propriétaire)', () => {
    expect(redactMoneyText('Le Tucson coûte 650 MAD par jour.', 'employee')).toBe('Le Tucson coûte — (réservé au propriétaire) par jour.');
    expect(redactMoneyText('Reste 1 200,50 DH et 300 dirhams.', 'manager')).not.toMatch(/\d/);
    expect(redactMoneyText('Il y a 3 voitures libres.', 'employee')).toBe('Il y a 3 voitures libres.');
    expect(redactMoneyText('Le Tucson coûte 650 MAD par jour.', 'owner')).toBe('Le Tucson coûte 650 MAD par jour.');
  });

  it('la consigne est ajoutée au modèle pour le responsable et l’employé, pas pour le propriétaire', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(systemPrompt(now, 'fr', 'employee')).toContain('INTERDIT pour cet utilisateur');
    expect(systemPrompt(now, 'fr', 'manager')).toContain('JAMAIS un prix');
    expect(systemPrompt(now, 'fr', 'owner')).not.toContain('INTERDIT pour cet utilisateur');
    expect(systemPrompt(now, 'ar')).not.toContain('INTERDIT pour cet utilisateur');
  });
});

describe('chat : cartes de données construites à partir des résultats réels', () => {
  const now = new Date('2026-11-08T12:00:00Z');

  it('véhicules libres : une ligne par véhicule des résultats, sans aucun prix', () => {
    const cards = buildCards([{ tool: 'available_vehicles', data: available }], undefined, now);
    expect(cards).toEqual([
      {
        type: 'vehicles',
        items: [
          { kind: 'vehicle', id: V1, title: 'Dacia Logan', plate: '8921-ب-14', customer: null, date: null, tone: 'free' },
          { kind: 'vehicle', id: V2, title: 'Renault Clio 5', plate: '45123-أ-1', customer: null, date: null, tone: 'free' },
        ],
      },
    ]);
    expect(JSON.stringify(cards)).not.toMatch(/price|250|350/);
  });

  it('retours prévus : « en retard » seulement si la date est passée', () => {
    const rows = [
      { rental_id: R1, numero: 'LOC-1', vehicle: 'Dacia Logan', plate: '8921', customer: 'Karim', end: '2026-11-05T10:00:00Z' },
      { rental_id: V1, numero: 'LOC-2', vehicle: 'Clio', plate: '1', customer: 'Sara', end: '2026-11-20T10:00:00Z' },
    ];
    const items = buildCards([{ tool: 'returns_due', data: rows }], 'returns_due', now)[0].items;
    expect(items.map((i) => [i.id, i.tone])).toEqual([[R1, 'late'], [V1, 'rented']]);
  });

  it('une carte n’est jamais inventée : identifiant invalide ou outil non exécuté = aucune ligne', () => {
    expect(buildCards([{ tool: 'available_vehicles', data: [{ vehicle_id: 'pas-un-uuid', vehicle: 'X' }] }], undefined, now)).toEqual([]);
    expect(buildCards([{ tool: 'available_vehicles', data: available }], 'returns_due', now)).toHaveLength(1);
    expect(buildCards([{ tool: 'fleet', data: fleet }], 'fleet', now)).toEqual([]);
    expect(buildCards([], 'available_vehicles', now)).toEqual([]);
  });

  it('deux outils possibles sans choix du modèle : aucune carte (ambigu) ; avec choix : celle demandée', () => {
    const executed = [{ tool: 'available_vehicles', data: available }, { tool: 'returns_due', data: [{ rental_id: R1, vehicle: 'Logan', end: '2026-11-09T10:00:00Z' }] }];
    expect(buildCards(executed, undefined, now)).toEqual([]);
    expect(buildCards(executed, 'returns_due', now)[0].type).toBe('rentals');
  });

  it('8 lignes au plus', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ vehicle_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, vehicle: `V${i}`, plate: String(i) }));
    expect(buildCards([{ tool: 'available_vehicles', data: many }], undefined, now)[0].items).toHaveLength(8);
  });

  it('le choix du modèle (« show ») est lu dans sa réponse', () => {
    const step = parseModelStep({ action: 'answer', answer: 'Trois voitures libres.', show: 'available_vehicles' });
    expect(step.kind === 'answer' && step.show).toBe('available_vehicles');
  });
});
