import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useStore } from '@/state/store';
import { Loading } from '@/components/ui/primitives';
import { TabBar, type TabDef } from '@/components/ui/TabBar';

const TABS: TabDef[] = [
  { name: 'index', title: 'Discover', icon: 'compass-outline', active: 'compass' },
  { name: 'explore', title: 'Explore', icon: 'map-outline', active: 'map' },
  { name: 'replay', title: 'Replay', icon: 'film-outline', active: 'film', center: true },
  { name: 'journeys', title: 'Journeys', icon: 'albums-outline', active: 'albums' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', active: 'person' },
];

export default function TabLayout() {
  const { ready, profile } = useStore();
  if (!ready) return <Loading label="Getting your journeys" />;
  if (!profile) return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} tabs={TABS} />}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
    </Tabs>
  );
}
