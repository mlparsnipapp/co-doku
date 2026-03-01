import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { signInAsGuest, ensureUserProfile } from '../lib/auth';
import { drainSyncQueue } from '../lib/gameSession';
// initGameSessionDB and initPuzzleCacheDB run automatically at module load time.

// Initialize Sentry (DSN comes from .env)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.2,
  });
}

function RootLayout() {
  const { setSession, setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // Listen for connectivity changes to drain sync queue
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        drainSyncQueue().catch(() => null);
      }
    });

    // Restore existing Supabase session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        await loadProfile(session.user.id);
        setLoading(false);
        router.replace('/(tabs)');
      } else {
        // First launch → create guest account
        try {
          await signInAsGuest();
          const { data: { session: newSession } } = await supabase.auth.getSession();
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            // Generate a guest username
            const guestName = `player_${newSession.user.id.slice(0, 6)}`;
            await ensureUserProfile(newSession.user.id, guestName).catch(() => null);
            await loadProfile(newSession.user.id);
          }
        } catch {
          // Offline on first launch — proceed without session
        }
        setLoading(false);
        router.replace('/(tabs)');
      }
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }

        if (event === 'SIGNED_OUT') {
          router.replace('/auth/welcome');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      unsubNet();
    };
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/welcome" options={{ animation: 'fade' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
