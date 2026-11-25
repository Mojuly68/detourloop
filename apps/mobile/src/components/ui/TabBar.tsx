// Floating tab bar: pale bar, thin outline icons, a raised sand circle for the centre tab.
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, shadow } from '@/theme/tokens';
import { Icon, Press, T } from './primitives';

export type TabDef = { name: string; title: string; icon: string; active: string; center?: boolean };

export function TabBar({ state, emitter, navigateToTab, tabs }: { state: any; emitter: any; navigateToTab: (routeKey: string) => void; tabs: TabDef[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 14) }}>
      <View style={[{ height: 70, borderRadius: radius.xl, backgroundColor: color.bar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderWidth: 1, borderColor: color.tileLine }, shadow.float]}>
        {state.routes.map((route: any, i: number) => {
          const t = tabs.find((x) => x.name === route.name);
          if (!t) return null;
          const focused = state.index === i;
          const go = () => {
            const e = emitter?.emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e?.defaultPrevented) navigateToTab(route.key);
          };
          if (t.center) {
            return (
              <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
                <Press onPress={go} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.title}
                  style={[{ width: 64, height: 64, borderRadius: 32, marginTop: -30, backgroundColor: focused ? color.sandDeep : color.sand, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: color.paper }, shadow.card]}>
                  <Icon name={focused ? t.active : t.icon} size={26} color={color.white} />
                </Press>
                <T v="micro" c={focused ? color.ocean : color.gray} style={{ fontSize: 10, marginTop: 2 }}>{t.title}</T>
              </View>
            );
          }
          return (
            <Press key={route.key} onPress={go} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.title} scaleTo={0.92}
              style={{ flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <Icon name={focused ? t.active : t.icon} size={22} color={focused ? color.ocean : color.gray} />
              <T v="micro" c={focused ? color.ocean : color.gray} style={{ fontSize: 10 }}>{t.title}</T>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? color.sandDeep : 'transparent' }} />
            </Press>
          );
        })}
      </View>
    </View>
  );
}
