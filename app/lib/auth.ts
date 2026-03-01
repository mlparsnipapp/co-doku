import { supabase } from './supabase';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Sign in anonymously (guest account). Called on first launch.
 * Creates an auth.users row and, via trigger, a public.users row.
 */
export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/**
 * Sign in with Apple. Automatically creates or links to an existing account.
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken!,
    nonce: credential.authorizationCode ?? undefined,
  });
  if (error) throw error;
}

/**
 * Sign in with Google.
 */
export async function signInWithGoogle(): Promise<void> {
  // Lazy import so Expo Go doesn't crash on startup (native module not bundled in Expo Go).
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signIn();
  const tokens = await GoogleSignin.getTokens();

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokens.idToken,
  });
  if (error) throw error;
}

/**
 * Link a social identity to the current guest account, preserving all
 * existing data (stats, completions) under the same user_id.
 */
export async function linkAppleAccount(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { error } = await supabase.auth.linkIdentity({
    provider: 'apple',
    options: {
      redirectTo: 'codoku://auth/callback',
    },
  });
  if (error) throw error;
}

/**
 * Sign out completely and return to guest state.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Ensure a public.users row exists for the current auth user.
 * Called after sign-in if the row might not exist yet (e.g. after linking).
 */
export async function ensureUserProfile(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

