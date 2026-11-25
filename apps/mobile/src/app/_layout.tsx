import React from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold, Roboto_700Bold_Italic } from '@expo-google-fonts/roboto';
import { StoreProvider } from '@/state/store';
import { color } from '@/theme/tokens';
import { Loading } from '@/components/ui/primitives';

export default function RootLayout() {
  const [loaded] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold, Roboto_700Bold_Italic });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.white }}><Loading /></View>;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <View style={Platform.OS === 'web' ? { flex: 1, backgroundColor: '#0F2A38' } : { flex: 1 }}>
            {/* On wide web screens the app is shown at phone width: it is a mobile product. */}
            <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.white, overflow: 'hidden' } : { flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.white }, animation: 'slide_from_right' }}>
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
