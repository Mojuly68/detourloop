// PROFILE — travel personality, preferences, plan, privacy and account.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Profile } from '@/data/types';
import { useStore } from '@/state/store';
import { PERSONALITIES, personalityOf } from '@/services/personalization';
import { permissionStatus } from '@/services/location';
import { isCloud, providers } from '@/services/config';
import { supabase } from '@/services/supabase';
import { BUDGETS, INTERESTS, STYLES, TRANSPORT } from '@/content/options';
import { color, radius, space } from '@/theme/tokens';
import { Button, Card, Chip, Divider, Field, Icon, Press, T, useToast } from '@/components/ui/primitives';
import { Photo } from '@/components/ui/media';
import { ModeBanner } from '@/components/ui/ModeBanner';
import { confirm, notify } from '@/components/ui/confirm';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile, trips, saved, signOut, refresh } = useStore();
  const toast = useToast();
  const [locPerm, setLocPerm] = useState<string>('…');
  const [mediaPerm, setMediaPerm] = useState<string>('…');
  const [name, setName] = useState(profile?.displayName ?? '');

  useEffect(() => {
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

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Photo access is off', 'Allow photo access in Settings to choose a profile picture.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets?.[0]) update({ avatarUrl: r.assets[0].uri });
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.white }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: 140, paddingHorizontal: space.xl, gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Press onPress={pickAvatar} accessibilityLabel="Change profile photo" style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden' }}>
            {p.avatarUrl ? <Photo uri={p.avatarUrl} style={{ width: 76, height: 76 }} /> : (
              <View style={{ width: 76, height: 76, backgroundColor: color.ocean, alignItems: 'center', justifyContent: 'center' }}><T v="h1" c={color.sand}>{(p.displayName || 'T')[0].toUpperCase()}</T></View>
            )}
          </Press>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h1" numberOfLines={1}>{p.displayName || 'Traveller'}</T>
            <T v="small" c={color.inkSoft}>{p.email ?? (isCloud ? '' : 'Demo profile on this device')}</T>
            <ModeBanner compact />
          </View>
        </View>

        {/* Personality */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ borderRadius: radius.xl, backgroundColor: color.ocean, padding: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color.sand, alignItems: 'center', justifyContent: 'center' }}><Icon name={persona.icon} size={26} color={color.ocean} /></View>
            <View style={{ flex: 1 }}>
              <T v="kicker" c={color.sand}>Your travel personality</T>
              <T v="h2" c={color.white}>{persona.title}</T>
            </View>
          </View>
          <T v="body" c="rgba(248,247,243,0.85)">{persona.line}</T>
          <T v="micro" c="rgba(248,247,243,0.6)">{persona.overridden ? 'Chosen by you.' : 'Worked out from your preferences and the places you add, save or skip.'} {trips.length} trips · {stops} stops · {done} replays.</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip tone="dark" label="Automatic" selected={!p.personalityOverride} onPress={() => update({ personalityOverride: undefined })} />
            {Object.entries(PERSONALITIES).map(([k, v]) => <Chip key={k} tone="dark" label={v.title.replace('The ', '')} selected={p.personalityOverride === k} onPress={() => update({ personalityOverride: k })} />)}
          </ScrollView>
        </Animated.View>

        {/* Plan */}
        <Press onPress={() => router.push('/paywall')} accessibilityLabel="Subscription" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.cream }}>
          <Icon name="diamond-outline" size={24} color={color.teal} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">{p.plan === 'free' ? 'DetourLoop Free' : p.plan === 'annual' ? 'DetourLoop Plus · Annual' : 'DetourLoop Plus'}</T>
            <T v="micro" c={color.inkSoft}>{p.plan === 'free' ? 'See what Plus adds' : 'Manage subscription'}</T>
          </View>
          <Icon name="chevron-forward" size={18} color={color.gray} />
        </Press>

        {/* Preferences */}
        <Section title="Travel preferences">
          <T v="label" c={color.inkSoft}>Favourite experiences</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {INTERESTS.map((i) => <Chip key={i.key} label={i.label} icon={i.icon} selected={p.prefs.interests.includes(i.key)} onPress={() => prefs({ interests: p.prefs.interests.includes(i.key) ? p.prefs.interests.filter((x) => x !== i.key) : [...p.prefs.interests, i.key] })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Travel style</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STYLES.map((s) => <Chip key={s.key} label={s.label} selected={p.prefs.style === s.key} onPress={() => prefs({ style: s.key })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Pace</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['slow', 'balanced', 'packed'] as const).map((k) => <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={p.prefs.pace === k} onPress={() => prefs({ pace: k })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Typical budget</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {BUDGETS.map((b) => <Chip key={b.key} label={`${b.sign} ${b.label}`} selected={p.prefs.budget === b.key} onPress={() => prefs({ budget: b.key })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Getting around</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {TRANSPORT.map((t) => <Chip key={t.key} label={t.label} icon={t.icon} selected={p.prefs.transport === t.key} onPress={() => prefs({ transport: t.key })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Places to stay</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Campgrounds', 'Cabins', 'Boutique hotels', 'Hostels', 'Glamping', 'Mountain huts'].map((s) => <Chip key={s} label={s} selected={p.prefs.stays.includes(s)} onPress={() => prefs({ stays: p.prefs.stays.includes(s) ? p.prefs.stays.filter((x) => x !== s) : [...p.prefs.stays, s] })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Maximum detour: {p.prefs.maxDetourKm} km</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[5, 10, 20, 40, 80].map((k) => <Chip key={k} label={`${k}`} selected={p.prefs.maxDetourKm === k} onPress={() => prefs({ maxDetourKm: k })} />)}
          </View>
          <T v="label" c={color.inkSoft}>Favourite destinations</T>
          <T v="small" c={color.inkSoft}>{saved.length ? saved.slice(0, 6).map((s) => s.name).join(' · ') : 'Places you save appear here.'}</T>
        </Section>

        {/* Account */}
        <Section title="Account">
          <Field label="Display name" value={name} onChangeText={setName} onBlur={() => name.trim() && name !== p.displayName && update({ displayName: name.trim() })} />
          {isCloud ? <Button small v="secondary" icon="key-outline" label="Change password" onPress={async () => {
            if (!p.email || !supabase) return;
            const { error } = await supabase.auth.resetPasswordForEmail(p.email);
            notify(error ? 'Could not send the email' : 'Check your inbox', error ? error.message : `We sent a secure link to ${p.email} to set a new password.`);
          }} /> : null}
          <Toggle label="Trip reminders and Replay notifications" sub="Off unless you turn it on." on={p.notifications} onChange={(v) => update({ notifications: v })} />
        </Section>

        {/* Privacy */}
        <Section title="Privacy and permissions">
          <Row icon="location-outline" label="Location" value={locPerm === 'granted' ? 'Allowed while using' : locPerm === 'denied' ? 'Off' : 'Not asked yet'} />
          <Row icon="images-outline" label="Photos" value={mediaPerm === 'granted' ? 'Allowed' : mediaPerm === 'limited' ? 'Selected photos' : mediaPerm === 'denied' ? 'Off' : 'Not asked yet'} />
          {Platform.OS !== 'web' ? <Button small v="ghost" icon="settings-outline" label="Open system settings" onPress={() => Linking.openSettings()} /> : null}
          <T v="micro" c={color.inkSoft}>DetourLoop never tracks your location in the background. Live updates only run while Explore is open and you have switched them on. Replays are private until you share them.</T>
          <Divider />
          <Button v="secondary" icon="download-outline" label="Export my data (JSON)" onPress={exportData} />
          <Button v="ghost" icon="log-out-outline" label="Sign out" onPress={() => confirm('Sign out?', isCloud ? 'Your trips stay in your account.' : 'Demo mode keeps data only on this device: signing out deletes this demo profile and its trips.', 'Sign out', async () => { if (!isCloud) await repo.deleteAccount(); await signOut(); router.replace('/welcome'); })} />
          <Button v="danger" icon="trash-outline" label="Delete account" onPress={() => confirm('Delete your account?', 'All trips, photos, replays and share links are permanently deleted. This cannot be undone.', 'Delete everything', async () => {
            try { await repo.deleteAccount(); await refresh(); router.replace('/welcome'); } catch (e: any) { notify('Could not delete account', e?.message ?? 'Try again.'); }
          })} />
        </Section>

        <Card tone="cream">
          <T v="label">Data sources</T>
          <T v="micro" c={color.inkSoft} style={{ marginTop: 4 }}>Map: {providers.map}. Routing: {providers.routing}. Search: {providers.geocoding}. Places: {providers.places} and Wikipedia. Photos: {providers.photos}. Weather: {providers.weather}. AI: {isCloud ? 'OpenAI via DetourLoop servers (when configured)' : 'off in demo mode'}.</T>
        </Card>
      </ScrollView>
      {toast.node}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: space.md }}><T v="h2">{title}</T>{children}</View>;
}
function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
      <Icon name={icon} size={20} color={color.teal} />
      <T v="bodyStrong" style={{ flex: 1 }}>{label}</T>
      <T v="small" c={color.inkSoft}>{value}</T>
    </View>
  );
}
function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Press onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 }}>
      <View style={{ flex: 1 }}><T v="bodyStrong">{label}</T>{sub ? <T v="micro" c={color.inkSoft}>{sub}</T> : null}</View>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? color.teal : '#CFC6B5', padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} /></View>
    </Press>
  );
}
