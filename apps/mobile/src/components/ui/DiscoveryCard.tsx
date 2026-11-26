// The destination card: real place, real photo (if one exists), honest labels.
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { Discovery } from '@/data/types';
import { color, radius, shadow, space } from '@/theme/tokens';
import { categoryByKey } from '@/services/places';
import { fmtKm, fmtMin } from '@/services/geo';
import { navigationLinks } from '@/services/routing';
import { Button, Icon, Pill, Press, SourceTag, T } from './primitives';
import { Photo } from './media';

export function DiscoveryCard({
  d, index = 0, onAdd, onSave, onDismiss, saved, added, compact, offRouteLabel = 'off route',
}: {
  d: Discovery; index?: number; onAdd?: () => void; onSave?: () => void; onDismiss?: () => void; saved?: boolean; added?: boolean; compact?: boolean; offRouteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const cat = categoryByKey[d.category];
  const nav = navigationLinks(d);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)} layout={LinearTransition.springify().damping(20)}
      style={[{ backgroundColor: color.card, borderRadius: radius.lg, padding: 10 }, shadow.card]}>
      <Press onPress={() => setOpen((o) => !o)} scaleTo={0.99} accessibilityLabel={`${d.name}, ${d.categoryLabel}. ${open ? 'Collapse' : 'Expand'} details`} accessibilityState={{ expanded: open }}>
        <Photo uri={d.imageUrl} label={d.name} icon={cat?.icon} style={{ height: compact ? 130 : open ? 220 : 170, borderRadius: radius.md }} />
        <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 }}>
          <Pill tone="glass" icon={cat?.icon} label={d.categoryLabel} />
        </View>
        <View style={{ paddingHorizontal: space.sm, paddingTop: space.md, paddingBottom: space.sm, gap: space.sm }}>
          <T v="h3" style={{ fontFamily: 'Roboto_400Regular', fontSize: 21, lineHeight: 26 }} numberOfLines={2}>{d.name}</T>
          <View style={{ width: 56, height: 1.5, backgroundColor: color.sand, borderRadius: 1 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <Meta icon="navigate-outline" text={`${fmtKm(d.distanceKm)} ${offRouteLabel}`} />
            <Meta icon="car-outline" text={`+${fmtMin(d.detourMin)} est.`} />
            {d.visitMin ? <Meta icon="hourglass-outline" text={`~${fmtMin(d.visitMin)} visit est.`} /> : null}
          </View>
          {d.why ? (
            <View style={{ gap: 6, backgroundColor: color.tile, borderWidth: 1, borderColor: color.tileLine, padding: space.md, borderRadius: radius.md }}>
              <T v="small" c={color.charcoal}>{d.why}</T>
              <SourceTag source={d.whySource ?? 'map-data'} />
            </View>
          ) : null}
          {open ? (
            <View style={{ gap: space.sm }}>
              {d.summary ? <T v="small" c={color.inkSoft}>{d.summary}</T> : <T v="small" c={color.inkSoft}>No description is available for this place yet.</T>}
              <T v="micro" c={color.inkSoft}>
                {d.openingHours ? `Opening hours (OpenStreetMap, unverified): ${d.openingHours}` : 'Opening hours: unknown'}
                {'  ·  '}Rating: not available
              </T>
              <T v="micro" c={color.inkSoft}>Location {d.lat.toFixed(4)}, {d.lng.toFixed(4)} · source: {d.source === 'wikipedia' ? 'Wikipedia' : 'OpenStreetMap'}{d.source !== 'wikipedia' && d.summarySource ? ' · Wikipedia' : ''}</T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Button small v="secondary" icon="navigate" label="Apple Maps" onPress={() => Linking.openURL(nav.apple)} />
                <Button small v="secondary" icon="logo-google" label="Google Maps" onPress={() => Linking.openURL(nav.google)} />
                {d.wikiUrl ? <Button small v="ghost" icon="book-outline" label="Wikipedia" onPress={() => Linking.openURL(d.wikiUrl!)} /> : null}
              </View>
            </View>
          ) : null}
        </View>
      </Press>
      {(onAdd || onSave || onDismiss) && (
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm, paddingTop: space.sm }}>
          {onAdd ? <Button style={{ flex: 1 }} small icon={added ? 'checkmark' : 'add'} label={added ? 'Added' : 'Add to trip'} v={added ? 'sand' : 'primary'} onPress={added ? undefined : onAdd} /> : null}
          {onSave ? <Button small v="secondary" icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Saved' : 'Save'} onPress={onSave} /> : null}
          {onDismiss ? (
            <Press onPress={onDismiss} accessibilityLabel={`Not interested in ${d.name}`} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={20} color={color.gray} />
            </Press>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={14} color={color.teal} />
      <T v="micro" c={color.inkSoft}>{text}</T>
    </View>
  );
}
