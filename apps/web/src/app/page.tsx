// Responsive landing page. All photography is real (Wikipedia / Wikimedia Commons, credited).
import s from './page.module.css';
import { env, plans, wiki } from '@/lib/server';

export const revalidate = 3600;

export default async function Home() {
  const [hero, coast, waterfall, town, phone, p] = await Promise.all([
    wiki('Bixby Creek Bridge', 1920), wiki('McWay Falls', 960), wiki('Pfeiffer Beach', 960), wiki('Mendocino, California', 960), wiki('Lofoten', 960), plans(),
  ]);
  const app = env.appUrl;

  return (
    <main>
      <section className={s.hero}>
        {hero?.image ? <img className={s.heroImg} src={hero.image} alt={hero.title} /> : null}
        <div className={s.heroShade} />
        <div className={`wrap ${s.nav}`}>
          <span className={s.logo}>DetourLoop</span>
          {app ? <a className="btn btn-ghost" href={app}>Open the app</a> : null}
        </div>
        <div className={`wrap ${s.heroBody}`}>
          <span className="kicker rise" style={{ color: 'var(--sand)' }}>Travel discovery · TravelReplay</span>
          <h1 className="rise d1">Explore beyond <em>the obvious.</em></h1>
          <p className={`${s.lead} rise d2`}>The best parts of a trip are the places you didn't plan. DetourLoop finds them along your route, guides you while you travel, and turns the whole journey into a story you can replay.</p>
          <div className={`${s.ctas} rise d3`}>
            {app ? <a className="btn btn-sand" href={app}>Plan an adventure</a> : null}
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </div>
        </div>
        {hero ? <span className={`${s.heroCredit} credit`}>{hero.title} · Wikimedia Commons</span> : null}
      </section>

      <section className={s.section}>
        <div className="wrap">
          <div className={s.sectionHead}>
            <span className="kicker">One app, the whole trip</span>
            <h2>Before, during, and long after the drive.</h2>
          </div>
          <div className={s.three}>
            {[
              { img: coast, n: '01', t: 'Discover', d: 'Tell DetourLoop where you are going and what you love. It finds real places along the way: viewpoints, hidden beaches, small towns, trailheads.' },
              { img: waterfall, n: '02', t: 'Explore', d: '“Find something interesting nearby.” Accept a detour and the route updates. Ask your Guide where to watch the sunset.' },
              { img: town, n: '03', t: 'Replay', d: 'When the trip ends, your route, stops, photos and notes become an animated story, a film, and a page you can share.' },
            ].map((c) => (
              <article key={c.n} className={s.card}>
                {c.img?.image ? <img src={c.img.image} alt={c.img.title} loading="lazy" /> : null}
                <div className={s.cardBody}>
                  <span className={s.num}>{c.n}</span>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                  {c.img ? <span className="credit">{c.img.title} · Wikimedia Commons</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className={`${s.section} ${s.dark}`}>
        <div className={`wrap ${s.split}`}>
          <div>
            <div className={s.sectionHead}>
              <span className="kicker" style={{ color: 'var(--sand)' }}>TravelReplay</span>
              <h2>Every journey deserves a story.</h2>
            </div>
            <div className={s.steps}>
              {[
                ['Your route, animated', 'The line draws itself across the map, stop by stop, with your photos appearing where you took them.'],
                ['A timeline that sorts itself', 'Photos are grouped by day and place using their date and location. Fix anything by hand.'],
                ['A story that only tells the truth', 'Written from your actual trip data. Nothing invented. Edit every word.'],
                ['Share it, or keep it', 'Private, unlisted or public. Revoke a link at any time.'],
              ].map(([t, d], i) => (
                <div key={t} className={s.step}><b>{i + 1}</b><div><h3>{t}</h3><p>{d}</p></div></div>
              ))}
            </div>
          </div>
          <div className={s.phone}>
            {phone?.image ? <img src={phone.image} alt={phone.title} loading="lazy" /> : null}
            <div className={s.phoneCopy}>
              <span className="kicker" style={{ color: 'var(--sand)' }}>TravelReplay · Illustration</span>
              <h4>Your adventure is ready to replay.</h4>
              <div className={s.chipRow}><span className={s.chip}>Animated map</span><span className={s.chip}>Memory cards</span><span className={s.chip}>9:16 film</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className="wrap">
          <div className={s.sectionHead}>
            <span className="kicker">How DetourLoop behaves</span>
            <h2>Real places. Honest labels. Your data.</h2>
          </div>
          <div className={s.principles}>
            <div className={s.principle}><h3>Real places only</h3><p>Recommendations come from OpenStreetMap and Wikipedia. DetourLoop never invents a place, a rating or opening hours. Estimates are marked as estimates.</p></div>
            <div className={s.principle}><h3>AI that shows its work</h3><p>When AI writes a reason or a story, it says so. It only explains real data. Demo content is never dressed up as AI.</p></div>
            <div className={s.principle}><h3>Location on your terms</h3><p>One-time location by default. Live updates only while you ask for them, never in the background. Export or delete everything, any time.</p></div>
          </div>
        </div>
      </section>

      <section className={s.section} style={{ background: 'var(--cream)' }}>
        <div className="wrap">
          <div className={s.sectionHead}>
            <span className="kicker">Pricing</span>
            <h2>Free to explore. Plus to go further.</h2>
          </div>
          <div className={s.pricing}>
            <div className={s.plan}><span className="kicker">Free</span><div className={s.price}>$0</div><ul><li>Trip creation and route planning</li><li>Discoveries along your route</li><li>Maps and the photo timeline</li><li>Basic sharing</li></ul></div>
            <div className={`${s.plan} ${s.planHi}`}><span className="kicker" style={{ color: 'var(--sand)' }}>Plus</span><div className={s.price}>${p.plus.price}<small> / month</small></div><ul><li>Advanced AI discoveries and personalised picks</li><li>Animated journey maps and AI stories</li><li>Premium film templates, high-quality exports</li><li>More trips and media storage</li></ul></div>
            <div className={s.plan}><span className="kicker">Annual</span><div className={s.price}>${p.annual.price}<small> / year</small></div><ul><li>Everything in Plus</li><li>Save {Math.round((1 - p.annual.price / (p.plus.price * 12)) * 100)}% against monthly</li></ul></div>
          </div>
          <p className={s.note}>Proposed launch prices. Your trips, photos and Replays are always yours to view and export, on any plan.</p>
        </div>
      </section>

      <footer className={`wrap ${s.footer}`}>
        <strong style={{ font: '700 24px/1 var(--serif)', color: 'var(--ink)' }}>DetourLoop</strong>
        <span>Photography and place descriptions: Wikipedia and Wikimedia Commons contributors (CC BY-SA). Map data © OpenStreetMap contributors.</span>
      </footer>
    </main>
  );
}
