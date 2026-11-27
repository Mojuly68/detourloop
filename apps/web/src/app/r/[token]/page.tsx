// Public TravelReplay story. Data comes ONLY from the get_shared_replay() RPC, which returns what
// the owner chose to publish (no email, notes, budget, or hidden photos). Media live in a private
// bucket; the server signs short-lived URLs for the selected items only.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminClient, anonClient, configured } from '@/lib/server';
import JourneyMap from './JourneyMap';

type Shared = {
  title: string; narrative: string | null; narrative_source: string; cover_image: string | null; video_url: string | null;
  stats: Record<string, number>; start_date: string | null; end_date: string | null;
  origin: { name: string; lat: number; lng: number }; destination: { name: string; lat: number; lng: number } | null;
  route: { coordinates: [number, number][] } | null;
  stops: { name: string; lat: number; lng: number; category: string | null; image: string | null }[];
  media: { id: string; type: 'photo' | 'video'; path: string; caption: string | null; captured_at: string | null }[];
};

async function getStory(token: string): Promise<Shared | null> {
  const c = anonClient();
  if (!c || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data, error } = await c.rpc('get_shared_replay', { token });
  if (error || !data) return null;
  return data as Shared;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const s = await getStory(token);
  return {
    title: s ? `${s.title} · TravelReplay` : 'TravelReplay',
    description: s?.narrative?.slice(0, 160) ?? 'A journey shared from DetourLoop.',
    robots: { index: false, follow: false }, // shared stories are never indexed by default
  };
}

export const dynamic = 'force-dynamic';

export default async function SharedReplay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!configured) {
    return (
      <main className="wrap" style={{ padding: '120px 0', display: 'grid', gap: 16 }}>
        <span className="kicker">TravelReplay</span>
        <h1 style={{ fontSize: 48 }}>Sharing is not connected yet.</h1>
        <p>This DetourLoop web app has no Supabase project configured, so it cannot load shared stories. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README).</p>
      </main>
    );
  }
  const s = await getStory(token);
  if (!s) notFound();

  const admin = adminClient();
  const signed = new Map<string, string>();
  if (admin && s.media.length) {
    const { data } = await admin.storage.from('trip-media').createSignedUrls(s.media.map((m) => m.path), 60 * 60);
    data?.forEach((d, i) => d.signedUrl && signed.set(s.media[i].id, d.signedUrl));
  }
  const cover = s.media.find((m) => m.type === 'photo' && signed.get(m.id));
  const coverUrl = cover ? signed.get(cover.id) : s.stops.find((x) => x.image)?.image ?? null;
  const points = [s.origin, ...s.stops, ...(s.destination ? [s.destination] : [])];
  const km = s.stats?.distance_km;
  const date = s.start_date ? new Date(s.start_date + 'T12:00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : null;

  return (
    <main>
      <section style={{ position: 'relative', minHeight: '78svh', display: 'flex', alignItems: 'flex-end', background: 'var(--ocean-deep)', color: 'var(--white)', overflow: 'hidden' }}>
        {coverUrl ? <img src={coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,24,32,.3), rgba(12,24,32,.92))' }} />
        <div className="wrap" style={{ position: 'relative', padding: '0 0 10vh', display: 'grid', gap: 16 }}>
          <span className="kicker rise" style={{ color: 'var(--sand)' }}>TravelReplay{date ? ` · ${date}` : ''}</span>
          <h1 className="rise d1" style={{ fontSize: 'clamp(44px, 7vw, 92px)', lineHeight: 1 }}>{s.title}</h1>
          <p className="rise d2" style={{ color: 'rgba(248,247,243,.85)' }}>{points.length} places{km ? ` · ${Math.round(km / 1.609344).toLocaleString('en-US')} mi` : ''} · {s.media.filter((m) => m.type === 'photo').length} photos</p>
        </div>
      </section>

      <section className="wrap" style={{ padding: '80px 0', display: 'grid', gap: 28 }}>
        <span className="kicker">The journey</span>
        <JourneyMap route={s.route?.coordinates ?? null} stops={points} />
      </section>

      {s.narrative ? (
        <section className="wrap" style={{ padding: '20px 0 80px', maxWidth: 760, display: 'grid', gap: 20 }}>
          <span className="kicker">The story {s.narrative_source === 'ai' ? '· AI-assisted, edited by the traveller' : ''}</span>
          {s.narrative.split('\n\n').map((p, i) => <p key={i} style={i === 0 ? { font: '700 30px/1.35 var(--serif)' } : { fontSize: 19, lineHeight: 1.7 }}>{p}</p>)}
        </section>
      ) : null}

      <section className="wrap" style={{ padding: '40px 0 80px', display: 'grid', gap: 20 }}>
        <span className="kicker">Along the way</span>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          {points.map((p, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 14, alignItems: 'center' }}>
              <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--ocean)', color: 'var(--white)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{i === 0 ? 'A' : i === points.length - 1 && s.destination ? 'B' : i}</span>
              <span style={{ font: '700 24px/1.2 var(--serif)' }}>{p.name}</span>
            </li>
          ))}
        </ol>
      </section>

      {s.media.length ? (
        <section className="wrap" style={{ padding: '20px 0 100px', display: 'grid', gap: 20 }}>
          <span className="kicker">Photos</span>
          <div style={{ columns: '3 280px', columnGap: 14 }}>
            {s.media.filter((m) => signed.get(m.id)).map((m) => (
              <figure key={m.id} style={{ margin: '0 0 14px', breakInside: 'avoid' }}>
                {m.type === 'photo' ? <img src={signed.get(m.id)} alt={m.caption ?? ''} loading="lazy" style={{ width: '100%', borderRadius: 16 }} /> : <video src={signed.get(m.id)} controls style={{ width: '100%', borderRadius: 16 }} />}
                {m.caption ? <figcaption style={{ marginTop: 6, color: 'var(--ink-soft)', fontSize: 14 }}>{m.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {s.video_url ? (
        <section className="wrap" style={{ padding: '0 0 100px' }}><video src={s.video_url} controls style={{ width: '100%', borderRadius: 22 }} /></section>
      ) : null}

      <footer className="wrap" style={{ padding: '40px 0 60px', borderTop: '1px solid var(--line)', color: 'var(--ink-soft)', fontSize: 14 }}>
        Made with DetourLoop · TravelReplay. Map data © OpenStreetMap contributors.
      </footer>
    </main>
  );
}
