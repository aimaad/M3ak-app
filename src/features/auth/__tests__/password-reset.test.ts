import { requestPasswordReset, resetPasswordWithCode } from '../api';

const mockResetForEmail = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => mockResetForEmail(...a),
      verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
  }),
}));

beforeEach(() => {
  mockResetForEmail.mockReset().mockResolvedValue({ error: null });
  mockVerifyOtp.mockReset().mockResolvedValue({ error: null });
  mockUpdateUser.mockReset().mockResolvedValue({ error: null });
  mockSignOut.mockReset().mockResolvedValue({ error: null });
});

describe('mot de passe oublié', () => {
  it("demande le code avec l'e-mail nettoyé", async () => {
    await requestPasswordReset('  sara@exemple.ma ');
    expect(mockResetForEmail).toHaveBeenCalledWith('sara@exemple.ma');
  });

  it('vérifie le code (type recovery) AVANT de changer le mot de passe', async () => {
    await resetPasswordWithCode(' sara@exemple.ma', '123456', 'NouveauMdp-2026');
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'sara@exemple.ma', token: '123456', type: 'recovery' });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NouveauMdp-2026' });
    expect(mockVerifyOtp.mock.invocationCallOrder[0]).toBeLessThan(mockUpdateUser.mock.invocationCallOrder[0]);
  });

  it('ne change rien si le code est refusé', async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error('Token has expired or is invalid') });
    await expect(resetPasswordWithCode('a@b.ma', '000000', 'NouveauMdp-2026')).rejects.toThrow('expired');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('referme la session de récupération si le nouveau mot de passe est refusé', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('Password should be at least 6 characters') });
    await expect(resetPasswordWithCode('a@b.ma', '123456', 'abc')).rejects.toThrow('Password');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
