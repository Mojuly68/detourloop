// Tells the user plainly when the app runs without a backend.
import React from 'react';
import { View } from 'react-native';
import { isCloud } from '@/services/config';
import { color, radius, space } from '@/theme/tokens';
import { Icon, T } from './primitives';

export function ModeBanner({ compact, dark }: { compact?: boolean; dark?: boolean }) {
  if (isCloud) return null;
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: dark ? 'rgba(15,42,56,0.6)' : color.cream, paddingVertical: compact ? 6 : 10, paddingHorizontal: space.md, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Icon name="phone-portrait-outline" size={14} color={dark ? color.sand : color.inkSoft} />
      <T v="micro" c={dark ? color.white : color.inkSoft}>{compact ? 'Demo mode' : 'Demo mode · saved on this device only · AI off'}</T>
    </View>
  );
}
