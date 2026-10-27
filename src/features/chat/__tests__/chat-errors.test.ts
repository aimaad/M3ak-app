import { ChatError, chatErrorMessageKey } from '../api';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

describe('messages d’erreur du chat', () => {
  it('distingue le quota de la clé d’une simple surcharge', () => {
    expect(chatErrorMessageKey(new ChatError('ocr_quota'))).toBe('chat.errors.quota');
    expect(chatErrorMessageKey(new ChatError('ocr_busy'))).toBe('chat.errors.busy');
    expect(chatErrorMessageKey(new Error('x'))).toBe('chat.errors.unavailable');
  });
});
