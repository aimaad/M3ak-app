import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | undefined;

// Clé "anon" publique : elle est faite pour être présente côté client.
// La sécurité repose sur les policies RLS de Supabase, pas sur le secret de cette clé.
// Le client n'est créé qu'à la première utilisation, pour ne pas faire planter l'app
// tant que le projet Supabase (Étape 0, partie authentification) n'est pas branché.
export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définis dans .env (voir .env.example).'
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

/**
 * Identifiant de l'utilisateur connecté, lu depuis la session locale (déjà
 * rafraîchie automatiquement par le client). Préférer à `auth.getUser()`,
 * qui revalide via un appel réseau séparé et peut échouer ponctuellement
 * sur mobile alors que la session est bien valide.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}
