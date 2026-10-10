import { getSupabase } from '@/lib/supabase';

import type { PersonName } from './names';

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** @returns true si une session a été ouverte immédiatement (confirmation e-mail désactivée) */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: PersonName
): Promise<boolean> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { prenom: name.prenom.trim(), nom: name.nom.trim() } },
  });
  if (error) throw error;
  return !!data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function verifySignupCode(email: string, code: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) throw error;
}

export async function resendSignupCode(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function updateMyPassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Complète prénom/nom du compte (anciens comptes sans nom) avant de créer/rejoindre une agence. */
export async function saveMyNames(name: PersonName): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({
    data: { prenom: name.prenom.trim(), nom: name.nom.trim() },
  });
  if (error) throw error;
}
