import { inviteErrorKey } from '../invite-errors';

describe('inviteErrorKey', () => {
  it('reconnaît les codes de refus du serveur', () => {
    expect(inviteErrorKey(new Error('invite_already_pending'))).toBe('equipe.invite.errors.invite_already_pending');
    expect(inviteErrorKey(new Error('invite_email_mismatch'))).toBe('equipe.invite.errors.invite_email_mismatch');
  });

  it('retombe sur un message générique', () => {
    expect(inviteErrorKey(new Error('boom'))).toBe('equipe.invite.errors.generic');
    expect(inviteErrorKey(undefined)).toBe('equipe.invite.errors.generic');
  });
});
