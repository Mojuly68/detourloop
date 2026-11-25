import React from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/state/store';
import { color, font } from '@/theme/tokens';
import { Icon, Loading } from '@/components/ui/primitives';

const TABS: { name: string; title: string; icon: string; active: string }[] = [
  { name: 'index', title: 'Discover', icon: 'compass-outline', active: 'compass' },
  { name: 'explore', title: 'Explore', icon: 'map-outline', active: 'map' },
  { name: 'replay', title: 'Replay', icon: 'film-outline', active: 'film' },
  { name: 'journeys', title: 'Journeys', icon: 'albums-outline', active: 'albums' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', active: 'person-circle' },
];

export default function TabLayout() {
  const { ready, profile } = useStore();
  const insets = useSafeAreaInsets();
  if (!ready) return <Loading label="Getting your journeys" />;
  if (!profile) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.sand,
        tabBarInactiveTintColor: 'rgba(233,228,217,0.6)',
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12),
          height: 66, borderRadius: 33, backgroundColor: 'rgba(15,42,56,0.96)', borderTopWidth: 0,
          paddingTop: 8, paddingBottom: 10, marginHorizontal: Platform.OS === 'web' ? 12 : 0,
          shadowColor: '#0F2A38', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 14,
        },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ focused, color: c }) => (
              <View style={{ alignItems: 'center' }}>
                <Icon name={focused ? t.active : t.icon} size={22} color={String(c)} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
