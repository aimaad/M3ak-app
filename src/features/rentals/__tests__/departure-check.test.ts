import {
  canConfirmCheck,
  confirmationState,
  DEFAULT_DEPARTURE_POLICY,
  departureErrorKey,
  issueMessageKey,
  parseDepartureCheck,
  summarizeCheck,
} from '../departure-check';

// Réponse construite à l'image de ce que renvoie rental_departure_check (testée côté SQL, voir
// supabase/tests/customer-module.test.sql).
function serverResponse(overrides: Record<string, unknown> = {}) {
  return {
    rental_id: 'r1',
    policy: {
      block_departure: true,
      require_customer_id_document: true,
      require_driver_licence: true,
      require_licence_valid_until_end: true,
      require_manual_confirmation: true,
      confirmation_role: 'employee',
      max_additional_drivers: 3,
    },
    parties: [
      {
        key: 'c1',
        kind: 'client',
        name: 'Client Un',
        is_driver: true,
        documents: [{ id: 'doc1', type: 'permis', expires_at: '2030-01-01', has_file: true, updated_at: 'x' }],
        issues: [{ code: 'id_missing', severity: 'blocking' }],
      },
      {
        key: 'd1',
        kind: 'conducteur_supplementaire',
        name: 'Conducteur A',
        is_driver: true,
        documents: [],
        issues: [{ code: 'licence_expiry_unknown', severity: 'warning' }],
      },
    ],
    blocking_count: 1,
    warning_count: 1,
    confirmation: { confirmed: false, stale: false, confirmed_by_name: null, confirmed_at: null },
    enforced: true,
    ok: false,
    can_depart: false,
    ...overrides,
  };
}

describe('parseDepartureCheck', () => {
  const check = parseDepartureCheck(serverResponse());

  it('lit les parties (client, conducteurs) avec leurs documents et anomalies', () => {
    expect(check.parties).toHaveLength(2);
    expect(check.parties[0]).toMatchObject({ kind: 'client', name: 'Client Un', isDriver: true });
    expect(check.parties[0].documents[0]).toMatchObject({ type: 'permis', expiresAt: '2030-01-01', hasFile: true });
    expect(check.parties[1].issues[0]).toEqual({ code: 'licence_expiry_unknown', severity: 'warning' });
  });

  it('lit la politique et les compteurs', () => {
    expect(check.policy.blockDeparture).toBe(true);
    expect(check.policy.confirmationRole).toBe('employee');
    expect(check.blockingCount).toBe(1);
    expect(check.warningCount).toBe(1);
    expect(check.canDepart).toBe(false);
  });

  it('ne plante pas et ne laisse rien passer sur une réponse invalide (départ non autorisé)', () => {
    const empty = parseDepartureCheck(null);
    expect(empty.parties).toEqual([]);
    expect(empty.canDepart).toBe(false);
    expect(empty.ok).toBe(false);
  });
});

describe('vérification des documents avant le départ', () => {
  it("signale les documents manquants et les dates à vérifier (anomalies par personne)", () => {
    const check = parseDepartureCheck(serverResponse());
    const codes = check.parties.flatMap((p) => p.issues.map((i) => i.code));
    expect(codes).toEqual(['id_missing', 'licence_expiry_unknown']);
    expect(issueMessageKey({ code: 'id_missing', severity: 'blocking' })).toBe('locations.departureCheck.issues.id_missing');
  });

  it('un blocage documentaire empêche la confirmation', () => {
    const check = parseDepartureCheck(serverResponse());
    expect(summarizeCheck(check)).toBe('blocked');
    expect(canConfirmCheck(check, 'employee')).toBe(false);
  });

  it('sans blocage, la confirmation humaine reste nécessaire (la présence des fichiers ne suffit pas)', () => {
    const check = parseDepartureCheck(serverResponse({ blocking_count: 0, ok: false }));
    expect(confirmationState(check)).toBe('pending');
    expect(summarizeCheck(check)).toBe('confirmation_needed');
    expect(canConfirmCheck(check, 'employee')).toBe(true);
    expect(check.canDepart).toBe(false);
  });

  it('une confirmation périmée (documents modifiés ensuite) doit être refaite', () => {
    const check = parseDepartureCheck(
      serverResponse({ blocking_count: 0, confirmation: { confirmed: true, stale: true, confirmed_by_name: 'Sara', confirmed_at: 'x' } })
    );
    expect(confirmationState(check)).toBe('stale');
    expect(canConfirmCheck(check, 'manager')).toBe(true);
  });

  it('confirmé et sans blocage : prêt au départ', () => {
    const check = parseDepartureCheck(
      serverResponse({
        blocking_count: 0,
        warning_count: 0,
        ok: true,
        can_depart: true,
        confirmation: { confirmed: true, stale: false, confirmed_by_name: 'Sara', confirmed_at: 'x' },
      })
    );
    expect(confirmationState(check)).toBe('confirmed');
    expect(summarizeCheck(check)).toBe('ready');
    expect(canConfirmCheck(check, 'manager')).toBe(false);
    expect(check.canDepart).toBe(true);
  });

  it("une confirmation réservée aux responsables refuse l'employé", () => {
    const check = parseDepartureCheck(
      serverResponse({ blocking_count: 0, policy: { ...serverResponse().policy, confirmation_role: 'manager' } })
    );
    expect(canConfirmCheck(check, 'employee')).toBe(false);
    expect(canConfirmCheck(check, 'manager')).toBe(true);
    expect(canConfirmCheck(check, 'owner')).toBe(true);
  });

  it("politique inactive : la liste informe mais n'empêche pas le départ", () => {
    const check = parseDepartureCheck(serverResponse({ enforced: false, can_depart: true, policy: { ...serverResponse().policy, block_departure: false } }));
    expect(check.enforced).toBe(false);
    expect(check.canDepart).toBe(true);
  });

  it('sans confirmation requise par la politique, aucun état de confirmation', () => {
    const check = parseDepartureCheck(serverResponse({ blocking_count: 0, policy: { ...serverResponse().policy, require_manual_confirmation: false } }));
    expect(confirmationState(check)).toBe('not_required');
  });
});

describe('politique par défaut et messages', () => {
  it("ne bloque rien tant que l'agence n'a pas activé le blocage (aucune règle juridique imposée)", () => {
    expect(DEFAULT_DEPARTURE_POLICY.blockDeparture).toBe(false);
  });

  it('traduit les refus du serveur', () => {
    expect(departureErrorKey(new Error('departure_requirements_not_met'))).toBe('locations.departureCheck.errors.departure_requirements_not_met');
    expect(departureErrorKey(new Error('confirmation_requires_manager'))).toBe('locations.departureCheck.errors.confirmation_requires_manager');
    expect(departureErrorKey(new Error('boom'))).toBe('locations.departureCheck.errors.generic');
  });
});
