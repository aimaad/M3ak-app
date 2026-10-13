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

/**
 * Envoie un code de réinitialisation par e-mail. Aucune erreur n'est levée pour une adresse inconnue
 * (Supabase répond pareil) : l'écran ne révèle donc jamais si un compte existe.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

/** Vérifie le code reçu par e-mail (ouvre une session de récupération) puis enregistre le nouveau mot de passe. */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
  if (verifyError) throw verifyError;
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    // Le code est consommé : on referme la session de récupération pour ne pas laisser l'appareil connecté
    // sans que le mot de passe ait changé ; l'utilisateur redemandera un code.
    await supabase.auth.signOut();
    throw updateError;
  }
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
