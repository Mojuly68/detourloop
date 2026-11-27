// PROFILE — a short settings list. Each row shows the current choice; tapping it opens a sheet
// with the options, so the screen itself stays calm.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Profile } from '@/data/types';
import { useStore } from '@/state/store';
import { PERSONALITIES, personalityOf } from '@/services/personalization';
import { detourChoices, fmtDetour, getUnits } from '@/services/units';
import { permissionStatus } from '@/services/location';
import { isCloud, providers } from '@/services/config';
import { usePlan } from '@/services/subscriptions';
import { appleAvailable } from '@/services/apple';
import { BUDGETS, INTERESTS, STYLES, TRANSPORT } from '@/content/options';
import { color, radius, space } from '@/theme/tokens';
import { Button, Chip, Field, Icon, Press, T, useToast } from '@/components/ui/primitives';
import { Photo } from '@/components/ui/media';
import { Sheet } from '@/components/ui/Sheet';
import { confirm, notify } from '@/components/ui/confirm';

const STAYS = ['Campgrounds', 'Cabins', 'Boutique hotels', 'Hostels', 'Glamping', 'Mountain huts'];
const PACES = ['slow', 'balanced', 'packed'] as const;
type Pick = 'personality' | 'interests' | 'style' | 'pace' | 'budget' | 'transport' | 'stays' | 'detour' | 'units' | 'name' | null;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const list = (xs: string[], none = 'None') => (xs.length === 0 ? none : xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} +${xs.length - 2}`);

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile, trips, saved, signOut, refresh } = useStore();
  const toast = useToast();
  const [locPerm, setLocPerm] = useState<string>('…');
  const [mediaPerm, setMediaPerm] = useState<string>('…');
  const [name, setName] = useState(profile?.displayName ?? '');
  const [pick, setPick] = useState<Pick>(null);
  const plan = usePlan(profile);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    if (isCloud) appleAvailable().then(setApple);
    permissionStatus().then(setLocPerm);
    ImagePicker.getMediaLibraryPermissionsAsync().then((p) => setMediaPerm(p.status)).catch(() => setMediaPerm('unknown'));
  }, []);

  if (!profile) return null;
  const p = profile;
  const persona = personalityOf(p);
  const update = (patch: Partial<Profile>) => setProfile({ ...p, ...patch });
  const prefs = (patch: Partial<Profile['prefs']>) => update({ prefs: { ...p.prefs, ...patch } });
  const done = trips.filter((t) => t.status === 'completed').length;
  const stops = trips.reduce((a, t) => a + t.stops.filter((s) => s.status !== 'skipped').length, 0);
  const toggleIn = <K extends string>(arr: K[], k: K) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  async function exportData() {
    const data = JSON.stringify(await repo.exportAll(), null, 2);
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `detour-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.show('Export downloaded');
    } else {
      await Share.share({ message: data, title: 'DetourLoop data export' });
    }
  }

  function saveName() {
    update({ displayName: name.trim() });
    setPick(null);
    toast.show('Name saved');
  }

  async function linkApple() {
    try {
      const r = await repo.appleSignIn();
      if (r === 'cancelled') return;
      await refresh();
      if (r === 'linked') toast.show('Signed in with Apple. Your trips are kept with your Apple ID.');
      else notify('Signed in to your existing account', 'This Apple ID already had a DetourLoop account, so you are now signed in to it. Trips made as a guest on this phone stay with the guest account.');
    } catch (e: any) {
      notify('Sign in with Apple did not work', e?.message ?? 'Please try again.');
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Photo access is off', 'Allow photo access in Settings to choose a profile picture.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets?.[0]) update({ avatarUrl: r.assets[0].uri });
  }

  const label = (xs: { key: string; label: string }[], k: string) => xs.find((x) => x.key === k)?.label ?? '—';

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: 40, paddingHorizontal: space.lg, gap: space.xl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Press onPress={pickAvatar} accessibilityLabel="Change profile photo" style={{ width: 60, height: 60 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden' }}>
              {p.avatarUrl ? <Photo uri={p.avatarUrl} style={{ width: 56, height: 56 }} /> : (
                <View style={{ width: 56, height: 56, backgroundColor: color.ocean, alignItems: 'center', justifyContent: 'center' }}><T v="h2" c={color.sand}>{(p.displayName || 'T')[0].toUpperCase()}</T></View>
              )}
            </View>
            {/* Edit badge: makes it obvious the photo can be changed. */}
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: color.teal, borderWidth: 2, borderColor: color.paper, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={12} color={color.white} />
            </View>
          </Press>
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={1}>{p.displayName || 'Traveller'}</T>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', borderRadius: radius.lg, backgroundColor: color.tile, paddingVertical: space.md }}>
          {[[trips.length, 'Trips'], [stops, 'Stops'], [done, 'Replays'], [saved.length, 'Saved']].map(([n, l], i) => (
            <View key={l as string} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: color.tileLine }}>
              <T v="h3">{String(n)}</T>
              <T v="micro" c={color.inkSoft}>{l as string}</T>
            </View>
          ))}
        </View>

        <Group>
          <Row icon={persona.icon} label="Personality" value={persona.title.replace('The ', '')} onPress={() => setPick('personality')} />
          <Row icon="diamond-outline" label="Plan" value={plan === 'free' ? 'Free' : plan === 'annual' ? 'Plus · Annual' : 'Plus'} onPress={() => router.push('/paywall')} />
        </Group>

        <Group title="Travel preferences">
          <Row icon="heart-outline" label="Experiences" value={list(p.prefs.interests.map((k) => label(INTERESTS, k)))} onPress={() => setPick('interests')} />
          <Row icon="compass-outline" label="Style" value={label(STYLES, p.prefs.style)} onPress={() => setPick('style')} />
          <Row icon="speedometer-outline" label="Pace" value={cap(p.prefs.pace)} onPress={() => setPick('pace')} />
          <Row icon="wallet-outline" label="Budget" value={label(BUDGETS, p.prefs.budget)} onPress={() => setPick('budget')} />
          <Row icon="car-outline" label="Getting around" value={label(TRANSPORT, p.prefs.transport)} onPress={() => setPick('transport')} />
          <Row icon="bed-outline" label="Places to stay" value={list(p.prefs.stays, 'Any')} onPress={() => setPick('stays')} />
          <Row icon="git-branch-outline" label="Maximum detour" value={fmtDetour(p.prefs.maxDetourKm)} onPress={() => setPick('detour')} />
          <Row icon="resize-outline" label="Units" value={getUnits() === 'km' ? 'Kilometers' : 'Miles'} onPress={() => setPick('units')} />
        </Group>

        <Group title="Account">
          <Row icon="person-outline" label="Display name" value={p.displayName || '—'} onPress={() => { setName(p.displayName ?? ''); setPick('name'); }} />
          {isCloud && p.guest && apple ? (
            <Row icon="logo-apple" label="Sign in with Apple" value="Keep your trips" onPress={linkApple} />
          ) : null}
          {isCloud && !p.guest ? <Row icon="logo-apple" label="Signed in with Apple" right={<Icon name="checkmark-circle" size={18} color={color.teal} />} /> : null}
          <Row icon="notifications-outline" label="Notifications" right={<Switch on={p.notifications} />} onPress={() => update({ notifications: !p.notifications })} role="switch" checked={p.notifications} />
        </Group>

        <Group title="Privacy">
          <Row icon="location-outline" label="Location" value={locPerm === 'granted' ? 'While using' : locPerm === 'denied' ? 'Off' : 'Not asked'} onPress={Platform.OS !== 'web' ? () => Linking.openSettings() : undefined} />
          <Row icon="images-outline" label="Photos" value={mediaPerm === 'granted' ? 'Allowed' : mediaPerm === 'limited' ? 'Selected' : mediaPerm === 'denied' ? 'Off' : 'Not asked'} onPress={Platform.OS !== 'web' ? () => Linking.openSettings() : undefined} />
          <Row icon="download-outline" label="Export my data" onPress={exportData} />
        </Group>

        <Group>
          {/* A guest has no way back into their account, so there is no Sign out for guests. */}
          {!p.guest ? <Row icon="log-out-outline" label="Sign out" onPress={() => confirm('Sign out?', isCloud ? 'Your trips stay in your account.' : 'Demo mode keeps data only on this device: signing out deletes this demo profile and its trips.', 'Sign out', async () => { if (!isCloud) await repo.deleteAccount(); await signOut(); router.replace('/welcome'); })} /> : null}
          <Row icon="trash-outline" label="Delete account" danger onPress={() => confirm('Delete your account?', 'All trips, photos, replays and share links are permanently deleted. This cannot be undone.', 'Delete everything', async () => {
            try { await repo.deleteAccount(); await refresh(); router.replace('/welcome'); } catch (e: any) { notify('Could not delete account', e?.message ?? 'Try again.'); }
          })} />
        </Group>

        <View style={{ gap: space.sm, paddingHorizontal: 4 }}>
          <T v="micro" c={color.gray}>DetourLoop never tracks your location in the background. Live updates only run while Explore is open and switched on. Replays are private until you share them.</T>
          <T v="micro" c={color.gray}>Map: {providers.map}. Routing: {providers.routing}. Search: {providers.geocoding}. Places: {providers.places} and Wikipedia. Photos: {providers.photos}. Weather: {providers.weather}. AI: {isCloud ? 'OpenAI via DetourLoop servers (when configured)' : 'off in demo mode'}.</T>
        </View>
      </ScrollView>

      {/* Pickers */}
      <Sheet visible={pick !== null} onClose={() => setPick(null)} label={pick ?? undefined}>
        {pick === 'personality' ? (
          <Picker title="Travel personality" note={persona.overridden ? 'Chosen by you.' : `Worked out from your preferences and the places you add, save or skip. Right now: ${persona.line}`}>
            <Chip label="Automatic" selected={!p.personalityOverride} onPress={() => update({ personalityOverride: undefined })} />
            {Object.entries(PERSONALITIES).map(([k, v]) => <Chip key={k} label={v.title.replace('The ', '')} selected={p.personalityOverride === k} onPress={() => update({ personalityOverride: k })} />)}
          </Picker>
        ) : pick === 'interests' ? (
          <Picker title="Favourite experiences" note="Pick as many as you like.">
            {INTERESTS.map((i) => <Chip key={i.key} label={i.label} icon={i.icon} selected={p.prefs.interests.includes(i.key)} onPress={() => prefs({ interests: toggleIn(p.prefs.interests, i.key) })} />)}
          </Picker>
        ) : pick === 'style' ? (
          <Picker title="Travel style">
            {STYLES.map((s) => <Chip key={s.key} label={s.label} icon={s.icon} selected={p.prefs.style === s.key} onPress={() => prefs({ style: s.key })} />)}
          </Picker>
        ) : pick === 'pace' ? (
          <Picker title="Pace">
            {PACES.map((k) => <Chip key={k} label={cap(k)} selected={p.prefs.pace === k} onPress={() => prefs({ pace: k })} />)}
          </Picker>
        ) : pick === 'budget' ? (
          <Picker title="Typical budget">
            {BUDGETS.map((b) => <Chip key={b.key} label={`${b.sign} ${b.label}`} selected={p.prefs.budget === b.key} onPress={() => prefs({ budget: b.key })} />)}
          </Picker>
        ) : pick === 'transport' ? (
          <Picker title="Getting around">
            {TRANSPORT.map((t) => <Chip key={t.key} label={t.label} icon={t.icon} selected={p.prefs.transport === t.key} onPress={() => prefs({ transport: t.key })} />)}
          </Picker>
        ) : pick === 'stays' ? (
          <Picker title="Places to stay" note="Pick any.">
            {STAYS.map((s) => <Chip key={s} label={s} selected={p.prefs.stays.includes(s)} onPress={() => prefs({ stays: toggleIn(p.prefs.stays, s) })} />)}
          </Picker>
        ) : pick === 'detour' ? (
          <Picker title="Maximum detour" note="How far off your route a suggestion may be.">
            {detourChoices().map((c) => <Chip key={c.value} label={c.label} selected={Math.abs(p.prefs.maxDetourKm - c.km) < 0.5} onPress={() => prefs({ maxDetourKm: c.km })} />)}
          </Picker>
        ) : pick === 'units' ? (
          <Picker title="Distance units" note="Changes how distances are shown everywhere in the app.">
            <Chip label="Miles" selected={getUnits() === 'mi'} onPress={() => prefs({ units: 'mi' })} />
            <Chip label="Kilometers" selected={getUnits() === 'km'} onPress={() => prefs({ units: 'km' })} />
          </Picker>
        ) : pick === 'name' ? (
          <View style={{ gap: space.md }}>
            <T v="h3">Display name</T>
            <Field value={name} onChangeText={setName} autoFocus maxLength={80} placeholder="Your name" autoComplete="name" textContentType="name"
              returnKeyType="done" onSubmitEditing={() => { if (name.trim()) saveName(); }} />
            <Button label="Save" icon="checkmark" disabled={!name.trim()} onPress={saveName} />
          </View>
        ) : null}
        {pick && pick !== 'name' ? <Button v="secondary" label="Done" onPress={() => setPick(null)} /> : null}
      </Sheet>
      {toast.node}
    </View>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: space.sm }}>
      {title ? <T v="kicker" c={color.inkSoft} style={{ paddingHorizontal: 4 }}>{title}</T> : null}
      <View style={{ borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,30,40,0.16)', overflow: 'hidden', backgroundColor: color.card }}>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            {i ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(15,30,40,0.12)', marginLeft: 50 }} /> : null}
            {r}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function Row({ icon, label, value, onPress, right, danger, role, checked }: { icon: string; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; role?: 'switch'; checked?: boolean }) {
  const body = (
    <>
      <Icon name={icon} size={19} color={danger ? color.danger : color.teal} />
      <T v="body" c={danger ? color.danger : color.ink} style={{ flex: 1 }} numberOfLines={1}>{label}</T>
      {value ? <T v="small" c={color.inkSoft} numberOfLines={1} style={{ maxWidth: '48%', textAlign: 'right' }}>{value}</T> : null}
      {right ?? (onPress ? <Icon name="chevron-forward" size={16} color="#B3BABD" /> : null)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 48, paddingHorizontal: space.lg };
  return onPress ? (
    <Press onPress={onPress} scaleTo={0.99} accessibilityLabel={value ? `${label}: ${value}` : label} {...(role ? { accessibilityRole: role, accessibilityState: { checked } } : {})} style={style}>{body}</Press>
  ) : <View style={style}>{body}</View>;
}

function Switch({ on }: { on: boolean }) {
  return (
    <View style={{ width: 42, height: 26, borderRadius: 13, backgroundColor: on ? color.teal : '#D5DADC', padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
    </View>
  );
}

function Picker({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <T v="h3">{title}</T>
        {note ? <T v="small" c={color.inkSoft}>{note}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}
