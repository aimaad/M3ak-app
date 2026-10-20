import { inspectionPermissions } from '../permissions';

jest.mock('@/features/agency/hooks', () => ({ useMyAgency: jest.fn() }));
jest.mock('@/features/rentals/hooks', () => ({ useDeparturePolicy: jest.fn() }));

describe('inspectionPermissions', () => {
  const closed = { allowSkipInspection: false, allowDeclineAi: false };
  const open = { allowSkipInspection: true, allowDeclineAi: true };

  it("l'employé suit la décision du propriétaire", () => {
    expect(inspectionPermissions(open, 'employee')).toEqual({ canSkip: true, canDecline: true });
    expect(inspectionPermissions(closed, 'employee')).toEqual({ canSkip: false, canDecline: false });
    expect(inspectionPermissions({ allowSkipInspection: true, allowDeclineAi: false }, 'employee')).toEqual({ canSkip: true, canDecline: false });
  });
  it('le gérant et le propriétaire peuvent toujours', () => {
    expect(inspectionPermissions(closed, 'manager')).toEqual({ canSkip: true, canDecline: true });
    expect(inspectionPermissions(closed, 'owner')).toEqual({ canSkip: true, canDecline: true });
  });
});
