import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Roboto_300Light, Roboto_300Light_Italic, Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { StoreProvider, useStore } from '@/state/store';
import { initPurchases } from '@/services/subscriptions';
import { isCloud } from '@/services/config';
import { color } from '@/theme/tokens';
import { Loading } from '@/components/ui/primitives';

export default function RootLayout() {
  const [loaded] = useFonts({ Roboto_300Light, Roboto_300Light_Italic, Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.paper }}><Loading /></View>;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <PurchasesBridge />
          <StatusBar style="dark" />
          <View style={Platform.OS === 'web' ? { flex: 1, backgroundColor: '#E7E2D9' } : { flex: 1 }}>
            {/* On wide web screens the app is shown at phone width: it is a mobile product. */}
            <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.paper, overflow: 'hidden' } : { flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper }, animation: 'slide_from_right' }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                <Stack.Screen name="plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="trip/[id]" />
                <Stack.Screen name="replay/[id]" />
              </Stack>
            </View>
          </View>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Starts RevenueCat once a profile exists (no-op on web or without a key). */
function PurchasesBridge() {
  const { profile } = useStore();
  const id = profile?.id;
  useEffect(() => { if (id) initPurchases(isCloud ? id : undefined).catch(() => {}); }, [id]);
  return null;
}
