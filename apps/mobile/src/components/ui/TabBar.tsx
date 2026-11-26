// Tab bar: flat white bar on the bottom edge, five equal tabs, thin icons, small labels.
// The active tab gets the filled icon in navy and a short bar above it.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@/theme/tokens';
import { Icon, Press, T } from './primitives';

export type TabDef = { name: string; title: string; icon: string; active: string; center?: boolean };

export function TabBar({ state, emitter, navigateToTab, tabs }: { state: any; emitter: any; navigateToTab: (routeKey: string) => void; tabs: TabDef[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: color.bar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(15,30,40,0.14)', paddingBottom: Math.max(insets.bottom - 6, 6), flexDirection: 'row' }}>
      {state.routes.map((route: any, i: number) => {
        const t = tabs.find((x) => x.name === route.name);
        if (!t) return null;
        const focused = state.index === i;
        const go = () => {
          const e = emitter?.emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e?.defaultPrevented) navigateToTab(route.key);
        };
        const tint = focused ? color.ocean : '#8A9296';
        return (
          <Press key={route.key} onPress={go} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.title} scaleTo={0.94}
            style={{ flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <View style={{ position: 'absolute', top: 0, width: 22, height: 2, borderRadius: 1, backgroundColor: focused ? color.ocean : 'transparent' }} />
            <Icon name={focused ? t.active : t.icon} size={21} color={tint} />
            <T v="micro" c={tint} maxFontSizeMultiplier={1} style={{ fontSize: 10, lineHeight: 12, fontFamily: focused ? 'Roboto_600SemiBold' : 'Roboto_500Medium' }}>{t.title}</T>
          </Press>
        );
      })}
    </View>
  );
}
