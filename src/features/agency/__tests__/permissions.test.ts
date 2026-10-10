import { canRemoveMember } from '../permissions';

describe('canRemoveMember', () => {
  it('le owner peut retirer un manager ou un employee', () => {
    expect(canRemoveMember('owner', 'manager', false)).toBe(true);
    expect(canRemoveMember('owner', 'employee', false)).toBe(true);
  });

  it('un manager peut retirer un employee', () => {
    expect(canRemoveMember('manager', 'employee', false)).toBe(true);
  });

  it('un manager ne peut PAS retirer un autre manager ni le owner', () => {
    expect(canRemoveMember('manager', 'manager', false)).toBe(false);
    expect(canRemoveMember('manager', 'owner', false)).toBe(false);
  });

  it('un employee ne peut retirer personne', () => {
    expect(canRemoveMember('employee', 'employee', false)).toBe(false);
  });

  it('personne ne peut se retirer soi-même depuis cet écran', () => {
    expect(canRemoveMember('owner', 'manager', true)).toBe(false);
  });

  it('le owner ne peut jamais être retiré', () => {
    expect(canRemoveMember('owner', 'owner', false)).toBe(false);
  });
});
