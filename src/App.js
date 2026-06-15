import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getUser, getAllUsers, createUser, updateUser,
  getResults, setResults, getPhase, setPhase,
  getCardStats, setCardStats,
  subscribeChatMessages, sendChatMessage, deleteChatMessage, addReaction,
  subscribePhase, subscribeResults,
  updatePresence, subscribeOnlineUsers, subscribeLiveEvent, subscribeQuizPlayer, subscribeStatsCache,
  db,
} from './firebase';
import { doc, setDoc, getDoc, getDocs, onSnapshot, collection, deleteDoc, updateDoc } from 'firebase/firestore'; // eslint-disable-line no-unused-vars
import { calcScore, calcMatchPts } from './scoring';
import { getTodaysPlayer, shuffle, isQuizScoring, QUIZ_PLAYERS } from './quizPlayers';
import { searchPlayers, ALL_PLAYERS } from './squads';
import {
  INVITE_CODE, ADMIN_CODE,
  GROUPS, ALL_TEAMS, GROUP_MATCHES, KNOCKOUT_MATCHES, KNOCKOUT_ROUNDS,
  PHASE_OPTIONS, OPEN_PHASES, FLAGS, WS_MSGS, SPEC_FIELDS, STADIUMS,
} from './constants';
import { C } from './styles';

// ── Cloud Functions base URL (API-nøkkel er trygg på serveren) ────────
const CF_V2 = (fn) => `https://${fn}-7vpze6vvta-uc.a.run.app`;
async function cfPost(endpoint, body) {
  const res = await fetch(CF_V2(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const YEL = '#FFD700';

const COUNTRY_CODES = {
  'Danmark':'dk','Italia':'it','Østerrike':'at',
  'Argentina':'ar','Algerie':'dz','Australia':'au','Belgia':'be',
  'Bosnia-Herz':'ba','Brasil':'br','Canada':'ca','Colombia':'co',
  'Curacao':'cw','Ecuador':'ec','Elfenbenskysten':'ci','Egypt':'eg',
  'England':'gb-eng','Frankrike':'fr','Tyskland':'de','Ghana':'gh',
  'Haiti':'ht','Iran':'ir','Irak':'iq','Japan':'jp','Jordan':'jo',
  'Kamerun':'cm','Kapp Verde':'cv','Kongo DR':'cd','Kroatia':'hr',
  'Marokko':'ma','Mexico':'mx','Nederland':'nl','New Zealand':'nz',
  'Norge':'no','Panama':'pa','Paraguay':'py','Portugal':'pt',
  'Qatar':'qa','Saudi-Arabia':'sa','Senegal':'sn','Skottland':'gb-sct',
  'Spania':'es','Sveits':'ch','Sverige':'se','Sør-Afrika':'za',
  'Sør-Korea':'kr','Tunisia':'tn','Tyrkia':'tr','Tsjekkia':'cz',
  'USA':'us','Uruguay':'uy','Usbekistan':'uz',
  // Historiske quiz-land
  'Romania':'ro','Russland':'ru','Bulgaria':'bg',
  'Vest-Tyskland':'de','Ungarn':'hu','Tsjekkoslovakia':'cz',
  'Sovjet':'ru','Jugoslavia':'rs',
  'Wales':'gb-wls','Irland':'ie','Nord-Irland':'gb-nir',
  'Tanzania':'tz','Monaco':'mc',
};

const TOPSCORER_FLAGS = {
  'Erik Solér': 'no',
  'Jørn Hoel': 'no',
  'Bjørn Wirkola': 'no',
  'Diego Armando Maradona': 'ar',
  'Dennis Bergkamp': 'nl',
};

const Flag = ({ team, size=20 }) => {
  const code = COUNTRY_CODES[team];
  if (!code) return <span title={team} style={{fontSize:size*0.8}}>🏳️</span>;
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      width={size} height={Math.round(size*0.67)}
      alt={team} title={team}
      style={{display:'inline-block',verticalAlign:'middle',borderRadius:2,objectFit:'cover',minWidth:size}}
    />
  );
};
// eslint-disable-next-line no-unused-vars
const winStatus = p => ({ open: OPEN_PHASES.has(p), ...(WS_MSGS[p] || WS_MSGS.pre) });

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const check = () => setMobile(window.matchMedia('(max-width: 600px)').matches);
    const mq = window.matchMedia('(max-width: 600px)');
    mq.addEventListener('change', check);
    const onOrient = () => setTimeout(check, 150);
    window.addEventListener('orientationchange', onOrient);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener('change', check);
      window.removeEventListener('orientationchange', onOrient);
      window.removeEventListener('resize', check);
    };
  }, []);
  return mobile;
};

// Touch-enhet (mobil/nettbrett) uavhengig av orientering
const useIsTouch = () => {
  const [touch] = useState(() => navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
  return touch;
};



async function getAdminMessage() {
  const snap = await getDoc(doc(db, 'config', 'adminMessage'));
  return snap.exists() ? snap.data().text || '' : '';
}
async function setAdminMessage(text) {
  await setDoc(doc(db, 'config', 'adminMessage'), { text });
}
function subscribeAdminMessage(callback) {
  return onSnapshot(doc(db, 'config', 'adminMessage'), snap => {
    callback(snap.exists() ? snap.data().text || '' : '');
  });
}
async function deleteMatchSummary(matchId) {
  await deleteDoc(doc(db, 'summaries', matchId));
}

async function getQuizAnswer(username, playerId) {
  const snap = await getDoc(doc(db, 'quiz', `${username}_${playerId}`));
  return snap.exists() ? snap.data() : null;
}
async function setQuizAnswer(username, playerId, answer, correct) {
  const scoring = isQuizScoring();
  await setDoc(doc(db, 'quiz', `${username}_${playerId}`), { answer, correct, ts: Date.now(), scoring });
}

async function getAllQuizAnswers() {
  const snap = await getDocs(collection(db, 'quiz'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function setMatchSummary(matchId, text, author) {
  const snap = await getDoc(doc(db, 'summaries', matchId));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, 'summaries', matchId), { ...existing, text, author, ts: Date.now() });
}
async function setMatchBotSummary(matchId, text, botId, botName) {
  const snap = await getDoc(doc(db, 'summaries', matchId));
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, 'summaries', matchId), { ...existing, botText: text, botId, botName, botTs: Date.now() });
}
function subscribeMatchSummaries(callback) {
  return onSnapshot(collection(db, 'summaries'), snap => {
    const data = {};
    snap.docs.forEach(d => { data[d.id] = d.data(); });
    callback(data);
  });
}

// ══════════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', inviteCode: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const upd = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        if (f.username === 'admin' && f.password === ADMIN_CODE) {
          onLogin({ username: 'admin', displayName: 'Admin', isAdmin: true }); return;
        }
        const u = await getUser(f.username);
        if (!u) { setError('Brukeren finnes ikke.'); setLoading(false); return; }
        if (u.password !== f.password) { setError('Feil passord.'); setLoading(false); return; }
        onLogin({ ...u, username: f.username });
      } else {
        if (f.inviteCode.trim().toUpperCase() !== INVITE_CODE) { setError('Feil invitasjonskode.'); setLoading(false); return; }
        if (!f.username || !f.displayName || !f.password) { setError('Fyll ut alle felt.'); setLoading(false); return; }
        if (await getUser(f.username)) { setError('Brukernavnet er tatt.'); setLoading(false); return; }
        const nu = { password: f.password, displayName: f.displayName, tips: {}, specialTips: {}, groupOrders: {} };
        await createUser(f.username, nu);
        onLogin({ ...nu, username: f.username });
      }
    } catch { setError('Noe gikk galt. Prøv igjen.'); setLoading(false); }
  };

  return (
    <div style={C.authWrap}>
      <div style={C.authGlow} />
      <div style={C.authBox}>
        <div style={C.authLogoWrap}>
          <img src="/vm-logo-login.png" alt="VM-tipping 2026" style={C.authLogoImg} />
        </div>
        <p style={C.authSub}>FIFA World Cup · USA · Canada · Mexico</p>
        <div style={C.tabs}>
          {['login', 'register'].map(m => (
            <button key={m} style={{ ...C.tab, ...(mode === m ? C.tabOn : {}) }}
              onClick={() => { setMode(m); setError(''); }}>
              {m === 'login' ? 'Logg inn' : 'Registrer'}
            </button>
          ))}
        </div>
        {mode === 'register' && <>
          <input style={C.inp} name="inviteCode" placeholder="Invitasjonskode" value={f.inviteCode} onChange={upd} />
          <input style={C.inp} name="displayName" placeholder="Ditt navn (vises i tabellen)" value={f.displayName} onChange={upd} />
        </>}
        <input style={C.inp} name="username" placeholder="Brukernavn" value={f.username} onChange={upd} />
        <input style={C.inp} name="password" placeholder="Passord" type="password" value={f.password} onChange={upd}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {error && <p style={C.err}>{error}</p>}
        <button style={{ ...C.btnGold, width: '100%', display: 'block' }} onClick={submit} disabled={loading}>
          {loading ? <span style={C.spinner}>⟳</span> : mode === 'login' ? 'Logg inn →' : 'Opprett konto →'}
        </button>
        <p style={{ color: '#4a5a80', fontSize: 11, marginTop: 14, textAlign: 'center', fontFamily: "'Fira Code',monospace" }}>
          Invitasjonskode fås av admin
        </p>
      </div>
    </div>
  );
}

// ── Deadline Bar (bottom) ────────────────────────────────────────────
// Deadlines: 10 min before first match of each phase (CEST = UTC+2)
const DEADLINES = [
  {
    key: 'group',
    label: 'innlevering av gruppespillskamper, spesialtips og gruppeplassering',
    shortLabel: 'Gruppespillet starter',
    // First group match: A1, 2026-06-11 21:00 CEST = 19:00 UTC
    deadline: new Date('2026-06-11T19:00:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      const grpO = user?.groupOrders || {};
      const spec = user?.specialTips || {};
      const allMatchesFilled = GROUP_MATCHES.every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
      const allGroupsFilled = Object.keys(GROUPS).every(g => (grpO[g] || []).filter(Boolean).length === 4);
      const allSpecFilled = SPEC_FIELDS.every(f => !!spec[f.key]);
      return allMatchesFilled && allGroupsFilled && allSpecFilled;
    },
  },
  {
    key: 'r32',
    label: '16-delsfinaler',
    shortLabel: '16-delsfinalene starter',
    // First r32 match: r32_1, 2026-06-28 21:00 CEST = 19:00 UTC
    deadline: new Date('2026-06-28T18:50:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      return KNOCKOUT_MATCHES.filter(m => m.phase === 'r32').every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
    },
  },
  {
    key: 'r16',
    label: '8-delsfinaler',
    shortLabel: '8-delsfinalene starter',
    // First r16 match: r16_2, 2026-07-04 19:00 CEST = 17:00 UTC
    deadline: new Date('2026-07-04T16:50:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      return KNOCKOUT_MATCHES.filter(m => m.phase === 'r16').every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
    },
  },
  {
    key: 'qf',
    label: 'kvartfinaler',
    shortLabel: 'Kvartfinalene starter',
    // First qf match: qf_1, 2026-07-09 22:00 CEST = 20:00 UTC
    deadline: new Date('2026-07-09T19:50:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      return KNOCKOUT_MATCHES.filter(m => m.phase === 'qf').every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
    },
  },
  {
    key: 'sf',
    label: 'semifinaler',
    shortLabel: 'Semifinalene starter',
    // First sf match: sf_1, 2026-07-14 21:00 CEST = 19:00 UTC
    deadline: new Date('2026-07-14T18:50:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      return KNOCKOUT_MATCHES.filter(m => m.phase === 'sf').every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
    },
  },
  {
    key: 'finals',
    label: 'finaler',
    shortLabel: 'Finalene starter',
    // Bronze: 2026-07-18 23:00 CEST = 21:00 UTC
    deadline: new Date('2026-07-18T20:50:00Z'),
    checkDone: (user) => {
      const tips = user?.tips || {};
      return KNOCKOUT_MATCHES.filter(m => m.phase === 'bronze' || m.phase === 'final').every(m => tips[m.id]?.home !== undefined && tips[m.id]?.away !== undefined);
    },
  },
];

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Renders deadline text: on narrow screens scrolls longText 3× then shows shortText.
// On wide screens (text fits) just shows longText statically.
function DeadlineBarText({ longText, shortText, textColor }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [mode, setMode] = useState('static'); // 'static' | 'scroll' | 'short'
  const [scrollCount, setScrollCount] = useState(0);

  useEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;
      const overflows = text.scrollWidth > container.clientWidth;
      if (overflows && mode === 'static') setMode('scroll');
      else if (!overflows && mode === 'static') setMode('static');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [longText]); // eslint-disable-line

  // After each scroll animation ends, count it; after 3× switch to shortText
  const handleAnimEnd = () => {
    const next = scrollCount + 1;
    if (next >= 3) { setMode('short'); }
    else { setScrollCount(next); }
  };

  const scrollDuration = Math.max(8, Math.round(longText.length * 0.085));

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center', minWidth: 0 }}
    >
      {mode === 'static' && (
        <span ref={textRef} style={{ padding: '0 32px', whiteSpace: 'nowrap', textAlign: 'center', width: '100%' }}>
          {longText}
        </span>
      )}
      {mode === 'scroll' && (
        <span
          key={scrollCount}
          onAnimationEnd={handleAnimEnd}
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            paddingLeft: '100%',
            animation: `tickerScroll ${scrollDuration}s linear forwards`,
          }}
        >
          {longText}
        </span>
      )}
      {mode === 'short' && (
        <span style={{ padding: '0 32px', whiteSpace: 'nowrap', textAlign: 'center', width: '100%' }}>
          {shortText}
        </span>
      )}
    </div>
  );
}

function DeadlineBar({ user, isAdmin }) {
  const [now, setNow] = useState(() => Date.now());
  const [freshUser, setFreshUser] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vm_deadline_dismissed') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  // Poll fresh user data every 60s for accurate completion check
  useEffect(() => {
    if (!user?.username || isAdmin) return;
    const fetchUser = () => {
      getUser(user.username).then(u => { if (u) setFreshUser(u); }).catch(() => {});
    };
    fetchUser();
    const iv2 = setInterval(fetchUser, 60000);
    return () => clearInterval(iv2);
  }, [user?.username]); // eslint-disable-line

  if (isAdmin) return null;

  const checkUser = freshUser || user;

  // Find the next upcoming deadline within 3 days that user hasn't completed
  const activeDeadline = DEADLINES.find(dl => {
    const dlMs = dl.deadline.getTime();
    if (dlMs <= now) return false; // already passed
    // Group deadline always shows; others only within 3 days
    if (dl.key !== 'group' && dlMs - now > THREE_DAYS_MS) return false;
    if (dismissed[dl.key]) return false; // user dismissed
    if (dl.checkDone(checkUser)) return false; // already done
    return true;
  });

  if (!activeDeadline) return null;

  const dlMs = activeDeadline.deadline.getTime();
  const diffMs = dlMs - now;
  const diffDays = Math.floor(diffMs / 86400000);
  const diffHours = Math.floor((diffMs % 86400000) / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);
  // Total hours remaining (not capped at 24) for the "X timer Y minutter" form
  const totalHours = Math.floor(diffMs / 3600000);

  const isGroup = activeDeadline.key === 'group';
  const underOneDayMs = 86400000;

  // Long text shown on wide screens / when there's room
  let longText;
  if (diffMs >= underOneDayMs) {
    longText = isGroup
      ? `${diffDays} dag${diffDays !== 1 ? 'er' : ''} til VM starter! ${totalHours} timer, ${diffMins} minutter til deadline for ${activeDeadline.label}!`
      : `${diffDays} dag${diffDays !== 1 ? 'er' : ''} igjen til deadline for tips i ${activeDeadline.label}!`;
  } else if (diffHours >= 1) {
    longText = isGroup
      ? `${totalHours} time${totalHours !== 1 ? 'r' : ''}, ${diffMins} minutter til deadline for innlevering av gruppespillskamper, spesialtips og gruppeplassering! LYKKE TIL!`
      : `${totalHours} time${totalHours !== 1 ? 'r' : ''} og ${diffMins} minutter til deadline for tips i ${activeDeadline.label}!`;
  } else {
    longText = isGroup
      ? `${diffMins} minutt${diffMins !== 1 ? 'er' : ''} til deadline for innlevering av gruppespillskamper, spesialtips og gruppeplassering! LYKKE TIL! ⚠️`
      : `${diffMins} minutt${diffMins !== 1 ? 'er' : ''} til deadline for tips i ${activeDeadline.label}! ⚠️`;
  }

  // Short fallback text for narrow screens after scrolling
  const shortText = diffMs >= underOneDayMs
    ? `${diffDays} dag${diffDays !== 1 ? 'er' : ''} igjen til VM starter!`
    : diffHours >= 1
      ? `${totalHours} t ${diffMins} min til deadline!`
      : `${diffMins} min til deadline! ⚠️`;

  const dismiss = () => {
    const next = { ...dismissed, [activeDeadline.key]: true };
    setDismissed(next);
    try { localStorage.setItem('vm_deadline_dismissed', JSON.stringify(next)); } catch {}
  };

  const urgent = diffMs < 3600000; // less than 1 hour
  const barColor = urgent ? 'rgba(120,30,10,.95)' : 'rgba(0,80,30,.92)';
  const textColor = urgent ? '#ffccaa' : '#a0ffb8';
  const borderColor = urgent ? 'rgba(255,120,80,.25)' : 'rgba(100,255,150,.15)';

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
      background: barColor,
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      color: textColor,
      height: 32, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
      borderTop: `1px solid ${borderColor}`,
      fontFamily: "'Kanit', sans-serif",
      animation: urgent ? 'pulse 2s ease-in-out infinite' : 'none',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center',
    }}>
      {/* Text container: on narrow screens, scroll longText 3× then show shortText */}
      <DeadlineBarText longText={longText} shortText={shortText} textColor={textColor} />
      <button onClick={dismiss} style={{
        position: 'absolute', right: 12,
        background: 'rgba(255,255,255,.15)', border: 'none',
        color: 'rgba(255,255,255,.6)', borderRadius: '50%',
        width: 18, height: 18, cursor: 'pointer', fontSize: 11,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>×</button>
    </div>
  );
}

// ── VM Countdown Bar ─────────────────────────────────────────────────
// Vises nederst på siden frem til første VM-kamp starter
// VM_START er definert ved VMCountdownBanner lenger ned

function VMCountdownBar() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);

  const VM_START_MS = new Date('2026-06-11T19:00:00Z').getTime();
  const diffMs = VM_START_MS - now;
  if (diffMs <= 0) return null; // VM har startet

  const totalHours = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);

  const text = `VM starter om ${totalHours} timer og ${diffMins} minutter!`;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 399,
      background: 'rgba(0,80,30,.92)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      color: '#a0ffb8',
      height: 32, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
      borderTop: '1px solid rgba(100,255,150,.15)',
      fontFamily: "'Kanit', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {text}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  BANNER (topp-navigasjon)
// ══════════════════════════════════════════════════════════════════════
function Banner({ user, tab, setTab, phase, onLogout, adminMessage, onAdminMessageClick }) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const bannerH = isMobile ? 68 : 90;

  const NAV_COLORS = {
    leaderboard: '#4ade80',
    tips:        '#60a5fa',
    chat:        '#ff6b6b',
    panel:       '#FFD700',
    info:        '#ffffff',
    admin:       '#fb923c',
  };

  const NAV_U = [
    { id: 'leaderboard', icon: null, img: '/tabell.png',  label: 'Tabell' },
    { id: 'tips',        icon: null, img: '/tips.png',    label: 'Tips' },
    { id: 'chat',        icon: null, img: '/chat.png',    label: 'Chat' },
    { id: 'panel',       icon: null, img: '/ekspertpanel.png', label: 'Ekspertpanel' },
    { id: 'info',        icon: null, img: '/info.png',    label: 'Info' },
  ];
  const NAV_A = [
    { id: 'admin', icon: '⚙️', img: null, label: 'Admin' },
  ];
  const nav = user.isAdmin ? NAV_A : NAV_U;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...C.banner, height: bannerH }}>
        {/* Logo */}
        <div style={{ width: isMobile?76:110, minWidth: isMobile?76:110, position:'relative', zIndex:20, cursor:'pointer', flexShrink:0 }}
          onClick={() => { setTab('dashboard'); setMenuOpen(false); }}>
          <img src="/vm-logo.png" alt="Gå til dashboard"
            style={{ position:'absolute', top:0, left:0, height: isMobile?102:133, width: isMobile?102:133, objectFit:'contain', filter:'drop-shadow(0 8px 24px rgba(0,0,0,.5))', mixBlendMode:'multiply' }} />
        </div>
        {/* Nav area */}
        <div style={{ ...C.bannerNav }}>
          {isMobile ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', height:'100%', paddingBottom:6 }}>
              <button onClick={() => setMenuOpen(m => !m)} style={{
                background:'transparent', border:'2px solid #FFD700', color:'#FFD700',
                borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:18, lineHeight:1, fontFamily:'inherit'
              }}>
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'flex-end', width:'100%', gap:4 }}>
              {nav.map(n => {
                const color = NAV_COLORS[n.id] || '#FFD700';
                const isOn = tab === n.id;
                return (
                  <button key={n.id}
                    style={{ ...C.navBtn, color: isOn ? color : 'rgba(255,255,255,.7)',
                      borderBottomColor: isOn ? color : 'transparent',
                      background: isOn ? `${color}15` : 'transparent',
                    }}
                    onClick={() => setTab(n.id)}>
                    {n.img
                      ? <img src={n.img} alt={n.label} style={{ width:20, height:20, objectFit:'contain', opacity: isOn?1:.7, filter: isOn ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
                      : <span style={{ fontSize:16 }}>{n.icon}</span>
                    }
                    <span style={{ color: isOn ? color : 'rgba(255,255,255,.8)', fontWeight: isOn?800:600 }}>{n.label}</span>
                  </button>
                );
              })}
              <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:6, paddingBottom:8 }}>
                <span style={{ fontSize:14, color:'#FFD700', fontFamily:"'Inter',sans-serif", fontWeight:700, letterSpacing:0.5, textAlign:'center' }}>{user.displayName}</span>
                <button style={C.btnLogout} onClick={onLogout}>Logg ut</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info/countdown overlay – floats over banner, centered */}
      <VMCountdownBanner adminMessage={adminMessage} onAdminMessageClick={onAdminMessageClick} isMobile={isMobile} bannerH={bannerH} />

      {/* Mobile dropdown */}
      {isMobile && menuOpen && (
        <div style={{ position:'absolute', top: bannerH, right:0, left:0, background:'#01174C', zIndex:100, borderBottom:'2px solid rgba(255,215,0,.3)', boxShadow:'0 8px 24px rgba(0,0,0,.5)' }}>
          {nav.map(n => {
            const color = NAV_COLORS[n.id] || '#FFD700';
            const isOn = tab === n.id;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); setMenuOpen(false); }}
                style={{ display:'flex', alignItems:'center', gap:12, width:'100%', background: isOn?`${color}18`:'transparent', border:'none', borderLeft: isOn?`4px solid ${color}`:'4px solid transparent', color: isOn?color:'rgba(255,255,255,.8)', padding:'14px 20px', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:16, fontWeight:600, textAlign:'left' }}>
                {n.img ? <img src={n.img} alt={n.label} style={{width:22,height:22,objectFit:'contain'}}/> : <span style={{fontSize:18}}>{n.icon}</span>}
                {n.label}
              </button>
            );
          })}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.1)', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>{user.displayName}</span>
            <button style={C.btnLogout} onClick={() => { onLogout(); setMenuOpen(false); }}>Logg ut</button>
          </div>
        </div>
      )}
      {/* Status stripe */}
    </div>
  );
}




// Format date nicely in Norwegian
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const months = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}. ${months[parseInt(m)-1]}`;
}

// 3-letter team abbreviations for portrait mobile
const TEAM_SHORT = {
  'Mexico':'MEX','Sør-Afrika':'RSA','Sør-Korea':'KOR','Tsjekkia':'CZE',
  'Canada':'CAN','Bosnia-Herz':'BIH','Qatar':'QAT','Sveits':'SUI',
  'Brasil':'BRA','Marokko':'MAR','Haiti':'HAI','Skottland':'SCO',
  'USA':'USA','Paraguay':'PAR','Australia':'AUS','Tyrkia':'TUR',
  'Tyskland':'GER','Curacao':'CUW','Elfenbenskysten':'CIV','Ecuador':'ECU',
  'Nederland':'NED','Japan':'JPN','Sverige':'SWE','Tunisia':'TUN',
  'Belgia':'BEL','Egypt':'EGY','Iran':'IRN','New Zealand':'NZL',
  'Spania':'ESP','Kapp Verde':'CPV','Saudi-Arabia':'KSA','Uruguay':'URU',
  'Frankrike':'FRA','Senegal':'SEN','Irak':'IRQ','Norge':'NOR',
  'Argentina':'ARG','Algerie':'ALG','Østerrike':'AUT','Jordan':'JOR',
  'Portugal':'POR','Kongo DR':'COD','Usbekistan':'UZB','Colombia':'COL',
  'England':'ENG','Kroatia':'CRO','Ghana':'GHA','Panama':'PAN',
};


function renderChatText(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/\S+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color:'#60a5fa', textDecoration:'underline', wordBreak:'break-all' }}>{part}</a>
      : part
  );
}


// ── Reusable chat message bubble (name+time above bubble) ───────────
const REACTION_EMOJIS = ['👍','😂','😮','❤️','🔥','👏'];

function ChatBubble({ m, mine, isAdmin, onDelete, maxImgH = 300, username }) {
  const [showPicker, setShowPicker] = useState(false);
  const [reactionTooltip, setReactionTooltip] = useState(null); // emoji key or null
  const isMobile = useIsMobile();
  const botExpert = PANEL_EXPERTS.find(e => e.name === m.user);
  const botColor = botExpert?.color;
  const isAdminMsg = m.user === 'Admin';
  const isHAL = m.user === 'HAL 9000';
  const ADMIN_GREEN = '#4ade80';
  const HAL_RED = '#ff4444';
  const nameColor = isAdminMsg ? ADMIN_GREEN : isHAL ? HAL_RED : mine ? 'rgba(255,215,0,.7)' : botColor || 'rgba(255,255,255,.45)';
  const fmt = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  };
  const reactions = m.reactions || {};
  const hasReactions = Object.values(reactions).some(u => u.length > 0);

  return (
    <div style={{
      ...C.chatMsg,
      alignSelf: mine ? 'flex-end' : 'flex-start',
      marginLeft: mine ? 8 : 0,
      marginRight: mine ? 0 : 8,
      position: 'relative',
    }}>
      {/* Navn + tid over bobla */}
      <div style={{ ...C.chatMeta, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <span style={{ ...C.chatUser, color: nameColor, ...(isAdminMsg ? { textTransform: 'uppercase', fontWeight: 800 } : {}) }}>{m.user}</span>
        <span style={C.chatTime}>{fmt(m.ts)}</span>
        {(mine || isAdmin) && onDelete && (
          <button onClick={() => onDelete(m.id)} style={{
            background:'none', border:'none', color:'rgba(255,100,100,.35)',
            cursor:'pointer', fontSize:10, padding:0, lineHeight:1,
          }} title="Slett">✕</button>
        )}
      </div>
      {/* Boble */}
      <span onClick={() => m.id && username && setShowPicker(s => !s)} style={{
        ...C.chatBubble,
        background: isAdminMsg ? 'rgba(74,222,128,.07)' : mine ? 'rgba(30,45,80,.9)' : 'rgba(20,25,40,.9)',
        border: `1px solid ${isAdminMsg ? 'rgba(74,222,128,.35)' : mine ? 'rgba(42,61,112,.8)' : 'rgba(42,48,80,.6)'}`,
        ...(isAdminMsg ? { borderLeft: `3px solid ${ADMIN_GREEN}`, color: ADMIN_GREEN, textTransform: 'uppercase', fontWeight: 700 } : {}),
        ...(isHAL ? { borderLeft: '3px solid #ff4444' } : botColor && !isAdminMsg ? { borderLeft: `3px solid ${botColor}` } : {}),
        display: 'block', cursor: 'pointer',
      }}>
        {m.image
          ? <img src={m.image} alt="bilde" style={{ maxWidth:'100%', maxHeight: maxImgH, borderRadius:8, display:'block' }} />
          : renderChatText(m.text)
        }
      </span>
      {/* Reaksjoner */}
      {reactionTooltip && isMobile && (
        <div
          onClick={() => setReactionTooltip(null)}
          onTouchEnd={() => setReactionTooltip(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
        />
      )}
      {hasReactions && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
          {Object.entries(reactions).filter(([,u]) => u.length > 0).map(([emoji, users]) => (
            <div key={emoji} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => {
                  if (isMobile) {
                    setReactionTooltip(r => r === emoji ? null : emoji);
                  } else {
                    m.id && addReaction(m.id, emoji, username);
                  }
                }}
                onMouseEnter={() => !isMobile && setReactionTooltip(emoji)}
                onMouseLeave={() => !isMobile && setReactionTooltip(null)}
                style={{
                  background: users.includes(username) ? 'rgba(255,215,0,.15)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${users.includes(username) ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.12)'}`,
                  borderRadius: 10, padding:'1px 6px', cursor:'pointer', fontSize:12,
                  color:'rgba(255,255,255,.8)', display:'flex', alignItems:'center', gap:3,
                }}>
                {emoji} <span style={{ fontSize:10, color:'rgba(255,255,255,.5)' }}>{users.length}</span>
              </button>
              {reactionTooltip === emoji && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: mine ? 'auto' : 0, right: mine ? 0 : 'auto',
                  marginBottom: 4, background: 'rgba(10,14,30,.97)',
                  border: '1px solid rgba(255,215,0,.2)', borderRadius: 8,
                  padding: '5px 10px', zIndex: 200, whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,.5)', fontSize: 11,
                  color: 'rgba(255,255,255,.8)',
                }}>
                  {users.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Emoji-picker ved hover */}
      {showPicker && m.id && username && (
        <div style={{
          position:'absolute', [mine ? 'right' : 'left']: 0,
          bottom: hasReactions ? 'calc(100% - 20px)' : '100%',
          background:'rgba(10,14,30,.97)', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:20, padding:'4px 6px', display:'flex', gap:2,
          zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,.5)',
        }}>
          {REACTION_EMOJIS.map(e => (
            <button key={e} onClick={() => { addReaction(m.id, e, username); setShowPicker(false); }} style={{
              background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'2px 3px',
              borderRadius:8, transition:'transform .1s',
            }}
              onMouseEnter={ev => ev.target.style.transform='scale(1.3)'}
              onMouseLeave={ev => ev.target.style.transform='scale(1)'}
            >{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}


function renderFulltreff(count) {
  if (!count || count === 0) return null;
  return (
    <span style={{fontSize:12,color:'#FFD700',fontWeight:700,whiteSpace:'nowrap'}}>⚡×{count}</span>
  );
}

// Online users popup indicator
function OnlineIndicator({ onlineUsers, compact = false }) {
  const [show, setShow] = useState(false);
  const isMobile = useIsMobile();
  return (
    <div style={{ position:'relative', flexShrink: 0 }}
      onMouseEnter={() => !isMobile && setShow(true)}
      onMouseLeave={() => !isMobile && setShow(false)}
      onClick={() => isMobile && setShow(s => !s)}>
      <span style={{ fontSize: compact ? 11 : 12, color:'#4ade80', fontFamily:"'Fira Code',monospace", display:'flex', alignItems:'center', gap:4, cursor:'pointer', whiteSpace:'nowrap' }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 6px #4ade80', flexShrink:0 }}/>
        {compact ? onlineUsers.length : `${onlineUsers.length} online`}
      </span>
      {show && (
        <>
          <div
            onClick={e => { e.stopPropagation(); setShow(false); }}
            onTouchEnd={e => { e.stopPropagation(); setShow(false); }}
            style={{ position:'fixed', inset:0, zIndex:998 }}
          />
          <div
            onClick={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            style={{
              position:'absolute', top:'100%', right:0, zIndex:999,
              background:'rgba(10,14,26,.97)', border:'1px solid rgba(74,222,128,.3)',
              borderRadius:10, padding:'10px 14px', minWidth:160, marginTop:6,
              boxShadow:'0 8px 24px rgba(0,0,0,.5)',
            }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>Pålogget nå</div>
            {onlineUsers.length === 0
              ? <div style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>Ingen</div>
              : onlineUsers.map(name => (
                <div key={name} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', fontSize:13, color:'#e8edf8' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block' }}/>
                  {name}
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  );
}

// ── Bot match summary ────────────────────────────────────────────────
async function generateBotMatchSummary(match, results, users, allSummaries) {
  // Pick expert rotating by match index
  const allMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
  const matchIdx = allMatches.findIndex(m => m.id === match.id);
  const expert = PANEL_EXPERTS[matchIdx % PANEL_EXPERTS.length];

  const act = results[match.id];
  if (!act) return null;

  // Build scoring context
  const scored = users.map(u => {
    const tip = u.tips?.[match.id];
    const pts = tip && act ? (function(){
      let p=0;
      const mo = h => h>0?'H':h<0?'A':'D';
      if(mo(tip.home-tip.away)===mo(act.home-act.away)) p+=2;
      if(parseInt(tip.home)===parseInt(act.home)) p+=1;
      if(parseInt(tip.away)===parseInt(act.away)) p+=1;
      return p;
    })() : 0;
    return { name: u.displayName, pts, total: u.total || 0, fulltreff: u.fulltreff || 0 };
  }).sort((a,b) => b.total - a.total);

  // Check if this is the last match in the group
  const groupMatches = GROUP_MATCHES.filter(m => m.group === match.group);
  const playedInGroup = groupMatches.filter(m => results[m.id]?.home !== undefined).length;
  const isLastInGroup = playedInGroup === groupMatches.length;

  // Group order scoring context if last in group
  let groupOrderContext = '';
  if (isLastInGroup) {
    const grpResults = results[`grp_${match.group}`];
    if (grpResults) {
      const grpScores = users.map(u => {
        const tip = u.groupOrders?.[match.group] || [];
        let pts = 0;
        tip.forEach((team, i) => { if (team && team === grpResults[i]) pts += 5; });
        return { name: u.displayName, grpPts: pts };
      }).filter(u => u.grpPts > 0);
      if (grpScores.length > 0) {
        groupOrderContext = `\n\nDette var siste kamp i gruppe ${match.group}. Gruppeposisjonstips (5p per riktig plass, maks 20p): ${grpScores.map(u=>`${u.name} fikk ${u.grpPts}p`).join(', ')}.`;
      }
    }
  }

  const prompt = `${expert.personality}

Du skal skrive et KORT sammendrag (2-4 setninger) om hvordan kampen ${match.home} ${act.home}–${act.away} ${match.away} påvirket tippekonkurransen. 

Poengoversikt for denne kampen:
${scored.map(u => `${u.name}: ${u.pts}p på kampen (totalt ${u.total}p, ${u.fulltreff} fulltreff)`).join('\n')}

Nåværende rekkefølge: ${scored.map((u,i)=>`${i+1}. ${u.name}`).join(', ')}.${groupOrderContext}

Skriv som deg selv – med din personlighet og dialekt. Hold deg til tippekonkurransen, ikke selve fotballen. Ikke bruk hermetegn.`;

  try {
    const data = await cfPost('generateTips', { prompt, maxTokens: 300 });
    const text = data.text;
    if (!text) return null;
    return { text, botId: expert.id, botName: expert.name };
  } catch(e) {
    console.error('Bot summary error:', e);
    return null;
  }
}

function FulltreffBadge({ matchId, results, users }) {
  const [show, setShow] = useState(false);
  const isMobile = useIsMobile();
  const act = results[matchId];
  if (!act || act.home === undefined || act.away === undefined) return null;

  const winners = users.filter(u => {
    if (u.id === 'admin' || u.id?.startsWith('panel_')) return false;
    const tip = u.tips?.[matchId];
    if (!tip) return false;
    return parseInt(tip.home) === parseInt(act.home) && parseInt(tip.away) === parseInt(act.away);
  }).map(u => u.displayName || u.id);

  if (winners.length === 0) return <span style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginLeft:6 }}>⚡ 0</span>;

  return (
    <span style={{ position:'relative', display:'inline-block', marginLeft:6 }}>
      {show && isMobile && (
        <div onClick={() => setShow(false)} onTouchEnd={() => setShow(false)}
          style={{ position:'fixed', inset:0, zIndex:199 }} />
      )}
      <span
        style={{ fontSize:11, color:'#FFD700', cursor:'pointer', fontWeight:700 }}
        onClick={() => isMobile && setShow(s => !s)}
        onMouseEnter={() => !isMobile && setShow(true)}
        onMouseLeave={() => !isMobile && setShow(false)}
      >⚡ {winners.length}</span>
      {show && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 4px)', left:'50%', transform:'translateX(-50%)',
          background:'rgba(10,14,30,.97)', border:'1px solid rgba(255,215,0,.25)',
          borderRadius:8, padding:'6px 10px', zIndex:200, whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,.5)', fontSize:11, color:'rgba(255,255,255,.85)',
          minWidth:80, textAlign:'center',
        }}>
          {winners.join(', ')}
        </div>
      )}
    </span>
  );
}

function BotSummaryTrigger({ matchId, match, results, users, summaries }) {
  const [loading, setLoading] = useState(false);
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateBotMatchSummary(match, results, users, summaries);
      if (result) await setMatchBotSummary(matchId, result.text, result.botId, result.botName);
    } finally {
      setLoading(false);
    }
  };
  // Knappen er skjult – sammendrag genereres automatisk av Cloud Function
  // Vis kun for admin-debugging
  // Vis kun for admin-debugging med showSummaryBtn
  if (!window.location.search.includes('showSummaryBtn')) return null;
  return (
    <button style={C.botSummaryBtn} onClick={handleGenerate} disabled={loading}>
      {loading ? '⟳ Genererer…' : '🤖 Generer ekspertkommentar'}
    </button>
  );
}

// Compress image to max ~250KB before storing in Firestore
function compressImage(file, maxKB = 250) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale down if too large – max 1200px wide
        const maxW = 1200;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // Try quality 0.8 first, then reduce if still too big
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// Vertsnasjon per VM-år – vises i topp-stripa
const VM_HOST_NAME = {
  1982: 'España 1982',
  1986: 'Mexico 1986',
  1990: 'Italia 1990',
  1994: 'USA 1994',
  1998: 'France 1998',
  2002: 'Korea/Japan 2002',
  2006: 'Germany 2006',
  2010: 'South Africa 2010',
  2014: 'Brasil 2014',
  2018: 'Russia 2018',
  2022: 'Qatar 2022',
  2026: 'USA/CAN/MEX 2026',
};

function PaniniCard({ player, blur, showName, compact, tiny, quizLabel }) {
  const [imgUrl, setImgUrl] = useState(null);

  const teamColor = {
    'Brasil':'#009c3b','Italia':'#003087','Frankrike':'#002395',
    'Spania':'#AA151B','Vest-Tyskland':'#1a1a1a','Tyskland':'#1a1a1a',
    'Argentina':'#74ACDF','Nederland':'#c45000','England':'#003087',
    'Portugal':'#006600','Kroatia':'#b00000','Belgia':'#1a1a1a',
    'Romania':'#002B7F','Bulgaria':'#00966E','Kamerun':'#007A5E',
    'Colombia':'#b08a00','Russland':'#0032A0','Danmark':'#C60C30',
    'USA':'#002868','Uruguay':'#5588bb','Sør-Korea':'#003478',
    'Mexico':'#006847','Skottland':'#003F87','Ghana':'#006B3F',
    'Elfenbenskysten':'#c05500','Egypt':'#C8102E','Marokko':'#C1272D',
  }[player.country] || '#1a2a5e';

  useEffect(() => {
    const name = player.name.replace(/ /g, '_');
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (d.thumbnail?.source) setImgUrl(d.thumbnail.source); })
      .catch(() => {});
  }, [player.name]);

  const w          = compact ? (tiny ? 70 : 100) : 140;
  const imgH       = compact ? (tiny ? 77 : 110) : 143;
  const nameBarH   = compact ? (tiny ? 14 : 20)  : 26;
  const stripeH    = compact ? (tiny ? 10 : 14)  : 18;
  const borderW    = compact ? (tiny ? 2  : 2.5) : 3;
  const logoSize   = compact ? (tiny ? 22 : 32)  : 44;
  const yearLogoH  = compact ? (tiny ? 7  : 10)  : 14;
  const flagImgH   = compact ? (tiny ? 8  : 11)  : 14;
  const numSize    = compact ? (tiny ? 6  : 7)   : 9;

  const yearLogoSrc    = `/vm-logos/${player.year}.png`;
  const vmHostName     = VM_HOST_NAME[player.year] || `VM ${player.year}`;
  const playerFlagCode = COUNTRY_CODES[player.country];

  return (
    <div style={{
      width: w,
      borderRadius: 8,
      border: `${borderW}px solid #f0d080`,
      boxShadow: '0 4px 16px rgba(0,0,0,.6)',
      background: '#f5e6c0',
      flexShrink: 0,
      position: 'relative',
      fontFamily: "'Inter',sans-serif",
      overflow: 'visible',
    }}>

      {/* ── TOPP-STRIPE: vertsnavn venstre, VM-logo (år-spesifikk) høyre ── */}
      <div style={{
        background: '#f0d080',
        height: stripeH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${compact ? 5 : 6}px`,
        borderRadius: '7px 7px 0 0',
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: compact ? 6 : 7,
          color: '#8B0000',
          fontWeight: 800,
          fontStyle: 'italic',
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '65%',
        }}>
          {vmHostName}
        </span>
        <img
          src={yearLogoSrc}
          alt={`VM ${player.year}`}
          style={{ height: yearLogoH, width: 'auto', objectFit: 'contain' }}
        />
      </div>

      {/* ── FOTO-OMRÅDE ── */}
      <div style={{
        height: imgH,
        background: `linear-gradient(180deg, ${teamColor}55 0%, #c8b99033 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 60 80" width={w * 0.5} height={imgH * 0.8} style={{ opacity: 0.25 }}>
              <ellipse cx="30" cy="18" rx="12" ry="14" fill="#555"/>
              <path d="M10 80 Q12 45 30 42 Q48 45 50 80Z" fill="#555"/>
              <path d="M10 80 Q5 60 8 50 L18 54Z" fill="#555"/>
              <path d="M50 80 Q55 60 52 50 L42 54Z" fill="#555"/>
            </svg>
          </div>
        )}

        {/* vm-logo.png – stor, helt i hjørnet, ingen padding */}
        <img
          src="/vm-logo.png"
          alt="VM"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: logoSize, height: logoSize,
            objectFit: 'contain',
            filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))',
          }}
        />

        {/* #nummer – nede til høyre i bildet, hvit font */}
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 3,
          background: 'rgba(0,0,0,.55)',
          color: '#fff',
          fontSize: numSize,
          fontWeight: 800,
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: "'Inter',sans-serif",
        }}>
          #{player.num}
        </div>
      </div>

      {/* ── BLÅ LINJA + GUL FOOTER wrapper (for flagg-posisjonering) ── */}
      <div style={{ position: 'relative', overflow: 'visible' }}>

      {/* BLÅ LINJA: navn sentrert */}
      <div style={{
        background: '#003087',
        height: nameBarH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Navn / quiz-label / blur – sentrert */}
        {quizLabel ? (
          <span style={{
            fontSize: compact ? 7 : 9, color: '#FFD700', fontWeight: 800,
            letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center',
          }}>
            {quizLabel}
          </span>
        ) : blur && !showName ? (
          <div style={{ height: compact ? 8 : 10, background: 'rgba(255,255,255,.15)', borderRadius: 3, width: '70%' }} />
        ) : showName ? (
          <span style={{
            fontSize: compact ? 8 : 10, color: '#FFD700', fontWeight: 800,
            letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {tiny ? player.name.split(' ').slice(-1)[0] : player.name}
          </span>
        ) : null}
      </div>

      {/* ── BUNN-STRIPE: PANINI venstre, FIFA WORLD CUP høyre ── */}
      <div style={{
        background: '#f0d080',
        height: stripeH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${compact ? 5 : 6}px`,
        borderRadius: '0 0 7px 7px',
      }}>
        <span style={{
          fontSize: compact ? 5 : 6,
          color: '#c00',
          fontWeight: 800,
          fontStyle: 'italic',
          letterSpacing: 1,
        }}>
          PANINI
        </span>
        <span style={{
          fontSize: compact ? (tiny ? 4 : 5) : 6,
          color: '#555',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          FIFA WORLD CUP
        </span>
      </div>

      {/* Landflagg – straddling the blue/yellow border */}
      {playerFlagCode && (
        <img
          src={`https://flagcdn.com/w40/${playerFlagCode}.png`}
          alt={player.country}
          style={{
            position: 'absolute',
            left: '50%',
            top: nameBarH,
            transform: 'translate(-50%, -50%)',
            height: flagImgH,
            width: 'auto',
            objectFit: 'cover',
            borderRadius: 2,
            border: '1px solid #f0d080',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            zIndex: 10,
          }}
        />
      )}

      </div>
    </div>
  );
}

// ── Bot-kommentar etter quiz-svar ────────────────────────────────────
function BotQuizComment({ correct, playerName }) {
  const [comment, setComment] = useState('');
  const [expert, setExpert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const picked = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];
    setExpert(picked);

    const prompt = correct
      ? `${picked.personality}

En spiller i VM-tipping-konkurransen gjenkjente akkurat fotballspilleren ${playerName} på et Panini-kort. Gi en kort, personlig gratulasjon på 1-2 setninger i din stil og dialekt. Avslutt med å nevne at et nytt fotballkort kommer kl. 06:00.`
      : `${picked.personality}

En spiller i VM-tipping-konkurransen klarte ikke å gjenkjenne fotballspilleren ${playerName} på et Panini-kort. Si noe trøstende eller morsomt på 1-2 setninger i din stil og dialekt. Avslutt med å nevne at et nytt fotballkort kommer kl. 06:00.`;

    cfPost('quizComment', { prompt })
      .then(d => { setComment(d.text || (correct ? 'Godt jobba! Nytt kort kl. 06:00.' : 'Bedre lykke neste gang! Nytt kort kl. 06:00.')); })
      .catch(() => setComment(correct ? 'Godt jobba! Nytt kort kl. 06:00.' : 'Bedre lykke neste gang! Nytt kort kl. 06:00.'))
      .finally(() => setLoading(false));
  }, [correct, playerName]);

  if (!expert) return null;

  return (
    <div style={{
      marginTop: 12,
      padding: '10px 12px',
      background: 'rgba(255,255,255,.04)',
      border: `1px solid ${expert.color}33`,
      borderLeft: `3px solid ${expert.color}`,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 11, color: expert.color, fontWeight: 700, marginBottom: 4, fontFamily: "'Inter',sans-serif" }}>
        {expert.emoji} {expert.name}
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>…</div>
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>{comment}</div>
      )}
    </div>
  );
}

function QuizPopup({ player, username, onClose, onAnswered }) {
  const [answered, setAnswered] = useState(null);
  const [options] = useState(() => shuffle([player.name, ...player.wrong]));
  const [allAnswers, setAllAnswers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    getQuizAnswer(username, player.id).then(a => { if (a) setAnswered(a.answer); });
  }, [username, player.id]);

  // Last inn alle brukeres svar for denne quizen
  useEffect(() => {
    getAllUsers().then(users => {
      const real = users.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));
      Promise.all(real.map(u =>
        getQuizAnswer(u.id, player.id).then(a => ({
          name: u.displayName || u.id,
          answer: a?.answer || null,
          correct: a?.correct || false,
        }))
      )).then(results => setAllAnswers(results.filter(r => r.answer)));
    });
  }, [player.id]);

  // Last inn total quiz-ledertavle
  useEffect(() => {
    Promise.all([getAllUsers(), getAllQuizAnswers()]).then(([users, answers]) => {
      const real = users.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));
      const board = real.map(u => {
        const uname = u.id;
        const userAnswers = answers.filter(a => a.id.startsWith(uname + '_') && a.scoring);
        const correct = userAnswers.filter(a => a.correct).length;
        const wrong = userAnswers.filter(a => !a.correct).length;
        return { name: u.displayName || u.id, correct, wrong, total: userAnswers.length };
      }).filter(u => u.total > 0).sort((a, b) => b.correct - a.correct || a.wrong - b.wrong);
      setLeaderboard(board);
    });
  }, []);

  const handleAnswer = async (choice) => {
    if (answered) return;
    const correct = choice === player.name;
    setAnswered(choice);
    await setQuizAnswer(username, player.id, choice, correct);
    if (onAnswered) onAnswered(correct);
    // Oppdater allAnswers lokalt
    setAllAnswers(prev => {
      const existing = prev.findIndex(r => r.name === username);
      const entry = { name: username, answer: choice, correct };
      return existing >= 0 ? prev.map((r,i) => i===existing ? entry : r) : [...prev, entry];
    });
  };

  const correctCount = allAnswers.filter(r => r.correct).length;
  const totalCount = allAnswers.length;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:899, background:'rgba(0,0,0,.7)', backdropFilter:'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position:'fixed', zIndex:900, width:320,
        top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'rgba(13,18,48,.97)', border:'2px solid rgba(255,215,0,.35)',
        borderRadius:16, padding:24, boxShadow:'0 24px 64px rgba(0,0,0,.8)',
        maxHeight:'90vh', overflowY:'auto',
      }}>
        <button onClick={onClose} style={{
          position:'absolute', top:10, right:10,
          background:'rgba(255,255,255,.1)', border:'none', color:'rgba(255,255,255,.7)',
          borderRadius:'50%', width:26, height:26, cursor:'pointer', fontSize:14,
          display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
          zIndex:1,
        }}>×</button>
        <div style={{ fontSize:11, color:'rgba(255,215,0,.7)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:14, textAlign:'center' }}>
          Hvem er dette? • VM {player.year}
        </div>
        {!isQuizScoring() && (
          <div style={{ fontSize:11, color:'#f97316', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:1, marginBottom:14, textAlign:'center', lineHeight:1.6, border:'1px solid rgba(249,115,22,.3)', borderRadius:8, padding:'8px 10px' }}>
            Mens vi venter på at moroa skal starte kjører vi dette som en før-VM-quiz! Alle poeng nullstilles 11. juni!
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
          <PaniniCard player={player} blur={!answered} showName={!!answered} />
        </div>
        {options.map(opt => {
          const isCorrect = opt === player.name;
          const isChosen = opt === answered;
          let bg = 'rgba(255,255,255,.06)';
          let border = '1px solid rgba(255,255,255,.1)';
          let icon = null;
          if (answered) {
            if (isCorrect) { bg = 'rgba(255,215,0,.1)'; border = '1px solid rgba(255,215,0,.4)'; }
            if (isChosen && !isCorrect) { bg = 'rgba(239,68,68,.15)'; border = '1px solid rgba(239,68,68,.4)'; }
            if (isChosen && isCorrect) icon = '✅';
            else if (isChosen && !isCorrect) icon = '❌';
          }
          return (
            <button key={opt} onClick={() => handleAnswer(opt)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:bg, border, borderRadius:8, padding:'10px 14px', marginBottom:8, cursor: answered ? 'default' : 'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, color: answered && isCorrect ? '#FFD700' : '#e8edf8', fontWeight: answered && isCorrect ? 700 : 400, textAlign:'left' }}>
              <span>{opt}</span>
              {icon && <span>{icon}</span>}
            </button>
          );
        })}
        {answered && (
          <BotQuizComment correct={answered === player.name} playerName={player.name} />
        )}

        {/* ── Quiz-statistikk ── */}
        {allAnswers.length > 0 && (
          <div style={{ marginTop:16, borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:14 }}>
            <div style={{ fontSize:10, color:'rgba(255,215,0,.6)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:10 }}>
              Deltakere · {correctCount}/{totalCount} riktig
            </div>
            {allAnswers.map(r => (
              <div key={r.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <span style={{ fontSize:13, color: r.correct ? '#4ade80' : '#e8edf8' }}>{r.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {answered && <span style={{ fontSize:12, color:'rgba(255,255,255,.4)', fontStyle:'italic' }}>{r.answer}</span>}
                  <span style={{ fontSize:13 }}>{r.correct ? '✅' : '❌'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Total quiz-ledertavle ── */}
        {leaderboard.length > 0 && (
          <div style={{ marginTop:16, borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:14 }}>
            <div style={{ fontSize:10, color:'rgba(255,215,0,.6)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:10 }}>
              🏆 Quiz-ledertavle – totalt
            </div>
            {leaderboard.map((r, i) => (
              <div key={r.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <span style={{ fontSize:12, color:'rgba(255,215,0,.5)', fontFamily:"'Fira Code',monospace", minWidth:18 }}>
                  {`${i+1}.`}
                </span>
                <span style={{ fontSize:13, color:'#e8edf8', flex:1 }}>{r.name}</span>
                <span style={{ fontSize:12, color:'#4ade80', fontWeight:700, minWidth:28, textAlign:'right' }}>{r.correct} ✅</span>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>·</span>
                <span style={{ fontSize:12, color:'rgba(239,68,68,.7)', minWidth:28, textAlign:'right' }}>{r.wrong} ❌</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>, document.body
  );
}

function QuizWidget({ username }) {
  const [playerIdx, setPlayerIdx] = useState(null);
  useEffect(() => {
    const unsub = subscribeQuizPlayer(idx => setPlayerIdx(idx));
    return unsub;
  }, []);
  const player = playerIdx !== null ? QUIZ_PLAYERS[playerIdx] : getTodaysPlayer();
  const scoring = isQuizScoring();
  const [showPopup, setShowPopup] = useState(false);
  const [myAnswer, setMyAnswer] = useState(null);

  useEffect(() => {
    getQuizAnswer(username, player.id).then(a => { if (a) setMyAnswer(a); });
  }, [username, player.id]);

  // A version of PaniniCard where name bar shows quiz label instead of name
  const quizLabel = scoring ? 'VM-QUIZ' : 'FØR-VM-QUIZ';

  return (
    <>
      <div onClick={() => setShowPopup(true)} style={{ cursor:'pointer', flexShrink:0 }}>
        <PaniniCard player={player} blur={!myAnswer} showName={!!myAnswer} quizLabel={!myAnswer ? quizLabel : undefined} compact tiny />
      </div>
      {showPopup && (
        <QuizPopup player={player} username={username} onClose={() => setShowPopup(false)}
          onAnswered={() => getQuizAnswer(username, player.id).then(a => { if (a) setMyAnswer(a); })} />
      )}
    </>
  );
}

// ── Chat-lyd ─────────────────────────────────────────────────────────
function useChatSound() {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('vm_chat_sound') !== 'off'; } catch { return true; }
  });

  const toggleSound = () => setSoundOn(prev => {
    const next = !prev;
    try { localStorage.setItem('vm_chat_sound', next ? 'on' : 'off'); } catch {}
    return next;
  });

  const playSound = useCallback(() => {
    if (!soundOn) return;
    try { new Audio('/chat.wav').play(); } catch {}
  }, [soundOn]);

  return { soundOn, toggleSound, playSound };
}

function SoundToggle({ soundOn, onToggle }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={soundOn ? 'Skru av lydvarsling' : 'Skru på lydvarsling'}
      style={{
        background: soundOn ? 'rgba(255,180,0,.12)' : 'rgba(255,255,255,.06)',
        border: soundOn ? '1px solid rgba(255,180,0,.35)' : '1px solid rgba(255,255,255,.12)',
        color: soundOn ? '#FFB700' : 'rgba(255,255,255,.35)',
        borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {soundOn ? '🔔' : '🔕'}
    </button>
  );
}

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const isMobile = useIsMobile();
  const hideTimer = useRef(null);
  const iconRef = useRef(null);

  const enter = () => { clearTimeout(hideTimer.current); setShow(true); };
  const leave = () => { hideTimer.current = setTimeout(() => setShow(false), 300); };

  const handleClick = () => {
    if (!show && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    setShow(s => !s);
  };

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    enter();
  };

  const popup = show ? createPortal(
    <>
      {isMobile && <div onClick={() => setShow(false)} style={{ position:'fixed', inset:0, zIndex:99998 }} />}
      <div
        onMouseEnter={() => !isMobile && enter()}
        onMouseLeave={() => !isMobile && leave()}
        style={{
          position: 'fixed',
          bottom: window.innerHeight - coords.top,
          left: coords.left,
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: 'rgba(10,14,30,.97)', border: '1px solid rgba(255,215,0,.3)',
          borderRadius: 10, padding: '10px 14px', width: 260, fontSize: 12,
          color: 'rgba(255,255,255,.85)', lineHeight: 1.6,
          boxShadow: '0 8px 24px rgba(0,0,0,.6)',
          pointerEvents: isMobile ? 'none' : 'auto',
        }}>
        <div style={{ position:'absolute', bottom:-6, left:'50%',
          width:10, height:10, background:'rgba(10,14,30,.97)',
          borderRight:'1px solid rgba(255,215,0,.3)', borderBottom:'1px solid rgba(255,215,0,.3)',
          transform:'translateX(-50%) rotate(45deg)' }} />
        {text}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center', marginLeft:5 }}>
      <span
        ref={iconRef}
        onMouseEnter={() => !isMobile && handleMouseEnter()}
        onMouseLeave={() => !isMobile && leave()}
        onClick={() => isMobile && handleClick()}
        style={{ cursor:'pointer', color:'rgba(255,215,0,.7)', fontSize:13, lineHeight:1, userSelect:'none' }}
      >ⓘ</span>
      {popup}
    </span>
  );
}

function PlayerAutocomplete({ value, onChange, placeholder, compact = false }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const wrapRef = useRef(null);

  // Sync hvis value endres utenfra
  useEffect(() => { setQuery(value || ''); setSelected(!!value); }, [value]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    onChange(''); // nullstill lagret verdi til bruker velger fra liste
    if (q.length >= 2) {
      setResults(searchPlayers(q));
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
  };

  const handleSelect = (player) => {
    setQuery(player.name);
    setSelected(true);
    setOpen(false);
    setResults([]);
    onChange(player.name);
  };

  const handleBlur = (e) => {
    // Ikke lukk hvis klikk er inni wrapperen
    if (wrapRef.current && wrapRef.current.contains(e.relatedTarget)) return;
    setTimeout(() => setOpen(false), 150);
  };

  const posColor = { GK: '#94a3b8', DEF: '#60a5fa', MID: '#34d399', FWD: '#f87171' };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...C.inp, marginBottom: 0, width: '100%',
            fontSize: compact ? 11 : 14,
            padding: compact ? '6px 28px 6px 7px' : '8px 32px 8px 12px',
            borderColor: selected ? 'rgba(74,222,128,.5)' : undefined }}
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder || 'Søk etter spiller...'}
          autoComplete="off"
        />
        {selected && (
          <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
            fontSize:14, color:'#4ade80', pointerEvents:'none' }}>✓</span>
        )}
        {query && !selected && (
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onChange(''); }}
            style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:14, padding:0 }}>×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:1000,
          background:'rgba(10,14,30,.97)', border:'1px solid rgba(255,215,0,.25)',
          borderRadius:10, marginTop:4, overflow:'hidden',
          boxShadow:'0 8px 24px rgba(0,0,0,.6)',
        }}>
          {results.map((p, i) => (
            <div
              key={i}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(p)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', cursor:'pointer', fontSize:13,
                borderBottom: i < results.length-1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                transition:'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,215,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <span style={{ fontSize:10, fontWeight:700, color: posColor[p.pos] || '#fff',
                background:'rgba(255,255,255,.08)', borderRadius:4, padding:'1px 5px', minWidth:30, textAlign:'center' }}>
                {p.pos}
              </span>
              <span style={{ flex:1, color:'#e8edf8' }}>{p.name}</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{p.team}</span>
            </div>
          ))}
          {query.length >= 2 && results.length === 0 && (
            <div style={{ padding:'10px 12px', fontSize:12, color:'rgba(255,255,255,.4)' }}>
              Ingen spillere funnet for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function TeamSelect({ value, onChange, teams, dimmed = [], compact = false }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const wrapRef = useRef(null);
  const portalRef = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const inPortal = portalRef.current && portalRef.current.contains(e.target);
      if (!inWrap && !inPortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const openUp = window.innerHeight - rect.bottom < 280;
      setCoords({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
        openUp,
      });
    }
    setOpen(o => !o);
  };

  const handleSelect = (val) => {
    onChange(val);
    // Delay closing so Android ghost-click is absorbed by the backdrop
    // before the portal unmounts and exposes elements behind it
    setTimeout(() => setOpen(false), 50);
  };

  const flagUrl = (team) => {
    const code = COUNTRY_CODES[team];
    return code ? `https://flagcdn.com/w20/${code}.png` : null;
  };

  const shortLabel = (team) => TEAM_SHORT[team] || team.slice(0, 3).toUpperCase();

  const itemProps = (onSelect) => ({
    // Mouse: preventDefault stops the document mousedown from closing before click fires
    onMouseDown: (e) => e.preventDefault(),
    onClick: onSelect,
    // Touch: track start position, only select if not scrolling
    onTouchStart: (e) => { touchStartY.current = e.touches[0].clientY; },
    onTouchEnd: (e) => {
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (dy < 8) onSelect();
    },
  });

  const dropdown = open ? createPortal(
    <>
    <div
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
      style={{ position:'fixed', inset:0, zIndex:99998, cursor:'pointer' }}
    />
    <div ref={portalRef} style={{
      position: 'fixed',
      top: coords.openUp ? undefined : coords.top,
      bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
      left: coords.left,
      width: Math.max(coords.width, 160),
      zIndex: 99999,
      background: 'rgba(10,14,30,.99)',
      border: '1px solid rgba(255,215,0,.25)',
      borderRadius: 10,
      maxHeight: 260,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      boxShadow: '0 8px 32px rgba(0,0,0,.9)',
    }}>
      <div
        {...itemProps(() => handleSelect(''))}
        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13,
          color: 'rgba(255,255,255,.4)', borderBottom: '1px solid rgba(255,255,255,.07)',
          whiteSpace: 'nowrap' }}
      >– Velg lag –</div>
      {teams.map(t => (
        <div key={t}
          {...itemProps(() => handleSelect(t))}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: compact ? '7px 10px' : '8px 14px', cursor: 'pointer',
            fontSize: compact ? 12 : 13,
            color: t === value ? '#FFD700' : '#e8edf8',
            background: t === value ? 'rgba(255,215,0,.08)' : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,.04)',
            whiteSpace: 'nowrap',
            opacity: dimmed.includes(t) ? 0.45 : 1,
          }}>
          {flagUrl(t)
            ? <img src={flagUrl(t)} alt="" style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
            : <span style={{ width: 18, flexShrink: 0 }} />}
          <span>{compact ? shortLabel(t) : t}</span>
          {dimmed.includes(t) && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>valgt</span>}
        </div>
      ))}
    </div>
    </>,
    document.body
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div onClick={handleToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', userSelect: 'none',
        background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)',
        borderRadius: 8, padding: compact ? '6px 7px' : '8px 12px',
        fontSize: compact ? 11 : 13, color: '#e8edf8',
        width: '100%', boxSizing: 'border-box',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 0 }}>
          {value ? (
            <>
              {flagUrl(value) && <img src={flagUrl(value)} alt="" style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {compact ? shortLabel(value) : value}
              </span>
            </>
          ) : <span style={{ color: 'rgba(255,255,255,.4)' }}>– Velg –</span>}
        </span>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10, marginLeft: 4, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {dropdown}
    </div>
  );
}

const CardIcon = ({ src, size = 18 }) => (
  <img src={src} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 0 4px rgba(255,215,0,.4))' }} />
);

const CameraIcon = () => (
  <img src="/camera.png" alt="Legg til bilde" style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }} />
);

function ImageUploadButton({ onImage }) {
  const [open, setOpen] = useState(false);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setOpen(false);
    const dataUrl = await compressImage(file);
    onImage(dataUrl);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38,
          background: 'transparent', border: 'none',
          borderRadius: 8, padding: 0,
        }}
        title="Last opp bilde eller ta foto"
      >
        <CameraIcon />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{
            position: 'absolute', bottom: 46, left: 0, zIndex: 999,
            background: 'rgba(13,18,48,.97)', border: '1px solid rgba(255,180,0,.3)',
            borderRadius: 12, overflow: 'hidden', minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 16px', cursor: 'pointer', color: '#e8edf8', fontSize: 14,
              fontFamily: "'Inter',sans-serif", borderBottom: '1px solid rgba(255,255,255,.07)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,180,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18 }}>🖼️</span> Velg fra galleri
              <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 16px', cursor: 'pointer', color: '#e8edf8', fontSize: 14,
              fontFamily: "'Inter',sans-serif",
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,180,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18 }}>📷</span> Ta bilde
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
//  POLL DIAGRAM TYPES
// ══════════════════════════════════════════════════════════════════════

// eslint-disable-next-line no-unused-vars
const DIAGRAM_TYPES = [
  'trump_tower','bar_rwb','horizontal_neymar','limousine','drillo','arne_scheie','percent','pie'
];

// ── Shared: percent label helper ──────────────────────────────────────
function pct(v, total) { return total > 0 ? Math.round((v / total) * 100) : 0; }

// ── 1. Trump Tower ────────────────────────────────────────────────────
function TrumpTower({ heightPct, isWinner, label, votes, total }) {
  const minH = 22, maxH = 130;
  const h = minH + Math.round((heightPct / 100) * (maxH - minH));
  const midH = Math.max(4, h - 22);
  const gold = '#D4AF37'; const silver = '#A8A9AD';
  const c = isWinner ? gold : silver;
  const dark = isWinner ? '#8B6914' : '#777';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:52 }}>
      <div style={{ fontSize:10, fontWeight:700, color: isWinner?gold:'rgba(255,255,255,.7)', fontFamily:"'Fira Code',monospace" }}>
        {votes} ({pct(votes,total)}%)
      </div>
      <svg width="46" height={h+2} viewBox={`0 0 46 ${h+2}`} style={{display:'block',overflow:'visible'}}>
        <rect x="20" y="0" width="6" height="8" fill={c}/>
        <rect x="10" y="8" width="26" height="8" fill={c} rx="1"/>
        <rect x="6" y="16" width="34" height="6" fill={dark}/>
        {[10,17,24,31,38].map(x=><rect key={x} x={x} y={17} width="4" height="4" fill="rgba(255,255,180,.3)" rx="0.5"/>)}
        <rect x="4" y="22" width="38" height={midH} fill={c}/>
        {Array.from({length:Math.floor(midH/9)}).map((_,row)=>
          [8,16,24,32].map(x=><rect key={`${row}-${x}`} x={x} y={24+row*9} width="5" height="5" fill="rgba(255,255,180,.22)" rx="0.5"/>)
        )}
        {Array.from({length:Math.floor(midH/9)}).map((_,row)=>
          <line key={row} x1="4" y1={22+row*9} x2="42" y2={22+row*9} stroke={dark} strokeWidth="0.4" opacity="0.5"/>
        )}
        <rect x="2" y={22+midH} width="42" height="4" fill={dark}/>
        <rect x="0" y={22+midH+4} width="46" height="2" fill={dark} rx="1"/>
      </svg>
      <div style={{fontSize:10,color:isWinner?gold:'rgba(255,255,255,.75)',fontWeight:isWinner?700:500,textAlign:'center',maxWidth:54,lineHeight:1.2,fontFamily:"'Kanit',sans-serif",wordBreak:'break-word'}}>{label}</div>
    </div>
  );
}

function TrumpDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const maxV = Math.max(...votes,1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,paddingTop:4}}>
      {options.map((opt,i)=>(
        <TrumpTower key={i} heightPct={maxV>0?Math.round((votes[i]/maxV)*100):0}
          isWinner={votes[i]===maxV&&total>0} label={opt} votes={votes[i]} total={total}/>
      ))}
    </div>
  );
}

// ── 2. Red/White/Blue bar chart ───────────────────────────────────────
function RWBDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const colors = ['#B22234','#FFFFFF','#3C3B6E'];
  const textColors = ['#fff','#222','#fff'];
  const maxV = Math.max(...votes,1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      {options.map((opt,i)=>{
        const w = maxV>0?Math.round((votes[i]/maxV)*100):0;
        return (
          <div key={i}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,.8)',fontFamily:"'Kanit',sans-serif"}}>{opt}</span>
              <span style={{fontSize:10,color:'rgba(255,255,255,.6)',fontFamily:"'Fira Code',monospace"}}>{votes[i]} ({pct(votes[i],total)}%)</span>
            </div>
            <div style={{background:'rgba(255,255,255,.1)',borderRadius:4,height:22,overflow:'hidden'}}>
              <div style={{width:`${Math.max(w,4)}%`,height:'100%',background:colors[i%3],display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4,transition:'width .4s',borderRadius:4}}>
                {w>15&&<span style={{fontSize:10,fontWeight:700,color:textColors[i%3]}}>{w}%</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 3. Neymar rolling (horizontal) ───────────────────────────────────
function NeymarFigure({ x, flipped }) {
  const s = flipped ? -1 : 1;
  return (
    <g transform={`translate(${x},0) scale(${s},1)`}>
      {/* Body rolling */}
      <ellipse cx="0" cy="18" rx="9" ry="6" fill="#FFD700" stroke="#B8860B" strokeWidth="0.8"/>
      {/* Head */}
      <circle cx="0" cy="8" r="7" fill="#F5CBA7" stroke="#D4A76A" strokeWidth="0.8"/>
      {/* Hair */}
      <ellipse cx="0" cy="4" rx="7" ry="3" fill="#2C1810"/>
      {/* Arms */}
      <line x1="-9" y1="16" x2="-16" y2="10" stroke="#F5CBA7" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="9" y1="16" x2="16" y2="22" stroke="#F5CBA7" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Legs */}
      <line x1="-4" y1="24" x2="-10" y2="32" stroke="#1a3a6b" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="4" y1="24" x2="10" y2="32" stroke="#1a3a6b" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Shoes */}
      <ellipse cx="-11" cy="33" rx="4" ry="2" fill="#222"/>
      <ellipse cx="11" cy="33" rx="4" ry="2" fill="#222"/>
      {/* Stars */}
      <text x="14" y="5" fontSize="8" fill="#FFD700">★</text>
      <text x="-22" y="5" fontSize="6" fill="#FFD700">★</text>
    </g>
  );
}

function NeymarDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const maxV = Math.max(...votes,1);
  const trackW = 220;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {options.map((opt,i)=>{
        const roll = maxV>0?Math.round((votes[i]/maxV)*trackW):0;
        return (
          <div key={i}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,.8)',fontFamily:"'Kanit',sans-serif"}}>{opt}</span>
              <span style={{fontSize:10,color:'rgba(255,255,255,.6)',fontFamily:"'Fira Code',monospace"}}>{votes[i]} ({pct(votes[i],total)}%)</span>
            </div>
            <div style={{background:'rgba(255,255,255,.07)',borderRadius:4,height:38,position:'relative',overflow:'hidden'}}>
              {/* grass */}
              <div style={{position:'absolute',bottom:0,left:0,right:0,height:6,background:'#2d5a27',borderRadius:'0 0 4px 4px'}}/>
              {/* neymar */}
              <svg width={roll+40} height="38" style={{position:'absolute',left:0,top:0}}>
                <NeymarFigure x={roll+18} flipped={false}/>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 4. Limousine ──────────────────────────────────────────────────────
function LimoDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const maxV = Math.max(...votes,1);
  const maxLen = 200;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {options.map((opt,i)=>{
        const limoLen = 60 + Math.round((votes[i]/maxV)*(maxLen-60));
        return (
          <div key={i}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,.8)',fontFamily:"'Kanit',sans-serif"}}>{opt}</span>
              <span style={{fontSize:10,color:'rgba(255,255,255,.6)',fontFamily:"'Fira Code',monospace"}}>{votes[i]} ({pct(votes[i],total)}%)</span>
            </div>
            <svg width={limoLen+20} height="38" viewBox={`0 0 ${limoLen+20} 38`}>
              {/* Body */}
              <rect x="5" y="6" width={limoLen} height="20" fill="#f0f0f0" rx="4"/>
              {/* Roof */}
              <rect x="20" y="2" width={limoLen-50} height="8" fill="#e0e0e0" rx="3"/>
              {/* Windows */}
              {Array.from({length:Math.max(1,Math.floor((limoLen-50)/20))}).map((_,w)=>(
                <rect key={w} x={25+w*20} y="4" width="14" height="5" fill="#87CEEB" rx="1" opacity="0.8"/>
              ))}
              {/* Front window */}
              <rect x={limoLen-22} y="7" width="10" height="12" fill="#87CEEB" rx="2"/>
              {/* Headlight */}
              <rect x={limoLen} y="11" width="5" height="6" fill="#FFFF99" rx="1"/>
              {/* Wheels */}
              <circle cx="18" cy="26" r="7" fill="#333"/>
              <circle cx="18" cy="26" r="4" fill="#888"/>
              <circle cx={limoLen-10} cy="26" r="7" fill="#333"/>
              <circle cx={limoLen-10} cy="26" r="4" fill="#888"/>
              {limoLen>100&&<circle cx={Math.floor(limoLen/2)} cy="26" r="6" fill="#333"/>}
              {limoLen>100&&<circle cx={Math.floor(limoLen/2)} cy="26" r="3.5" fill="#888"/>}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ── 5. Drillo (vertical figure, tall or short) ───────────────────────
function DrilloDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const maxV = Math.max(...votes,1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:16,paddingTop:4}}>
      {options.map((opt,i)=>{
        const targetH = 40 + Math.round((votes[i]/maxV)*100);
        const headR = 12;
        const bodyH = Math.max(10, targetH - headR*2 - 20);
        const totalH = headR*2 + bodyH + 24;
        const isWin = votes[i]===maxV&&total>0;
        const skin = '#F5CBA7';
        const suit = isWin ? '#FFD700' : '#1a3a6b';
        const x = 24;
        return (
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{fontSize:10,color:isWin?'#FFD700':'rgba(255,255,255,.7)',fontFamily:"'Fira Code',monospace",fontWeight:700}}>
              {votes[i]} ({pct(votes[i],total)}%)
            </div>
            <svg width="48" height={totalH+4}>
              {/* Head */}
              <circle cx={x} cy={headR+2} r={headR} fill={skin} stroke="#D4A76A" strokeWidth="0.8"/>
              {/* Hair */}
              <ellipse cx={x} cy={headR-4} rx={headR} ry={headR*0.4} fill="#555"/>
              {/* Eyes */}
              <circle cx={x-4} cy={headR+1} r="1.5" fill="#333"/>
              <circle cx={x+4} cy={headR+1} r="1.5" fill="#333"/>
              {/* Mouth - serious Drillo expression */}
              <line x1={x-3} y1={headR+6} x2={x+3} y2={headR+6} stroke="#666" strokeWidth="1" strokeLinecap="round"/>
              {/* Body */}
              <rect x={x-8} y={headR*2+2} width="16" height={bodyH} fill={suit} rx="2"/>
              {/* Arms */}
              <line x1={x-8} y1={headR*2+8} x2={x-18} y2={headR*2+8+bodyH*0.4} stroke={skin} strokeWidth="3" strokeLinecap="round"/>
              <line x1={x+8} y1={headR*2+8} x2={x+18} y2={headR*2+8+bodyH*0.4} stroke={skin} strokeWidth="3" strokeLinecap="round"/>
              {/* Legs */}
              <line x1={x-4} y1={headR*2+2+bodyH} x2={x-6} y2={headR*2+2+bodyH+18} stroke="#222" strokeWidth="3" strokeLinecap="round"/>
              <line x1={x+4} y1={headR*2+2+bodyH} x2={x+6} y2={headR*2+2+bodyH+18} stroke="#222" strokeWidth="3" strokeLinecap="round"/>
              {/* Shoes */}
              <ellipse cx={x-7} cy={headR*2+4+bodyH+18} rx="5" ry="2.5" fill="#222"/>
              <ellipse cx={x+7} cy={headR*2+4+bodyH+18} rx="5" ry="2.5" fill="#222"/>
            </svg>
            <div style={{fontSize:9,color:isWin?'#FFD700':'rgba(255,255,255,.7)',textAlign:'center',maxWidth:52,lineHeight:1.2,fontFamily:"'Kanit',sans-serif",wordBreak:'break-word'}}>{opt}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 6. Arne Scheie face (big or small) ───────────────────────────────
function ArneScheieDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const maxV = Math.max(...votes,1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,paddingTop:4}}>
      {options.map((opt,i)=>{
        const r = 18 + Math.round((votes[i]/maxV)*38);
        const isWin = votes[i]===maxV&&total>0;
        const cx = r+4, cy = r+4;
        const skin = '#F5CBA7';
        return (
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
            <div style={{fontSize:10,fontWeight:700,color:isWin?'#FFD700':'rgba(255,255,255,.7)',fontFamily:"'Fira Code',monospace"}}>
              {votes[i]} ({pct(votes[i],total)}%)
            </div>
            <svg width={(r+4)*2} height={(r+4)*2+10}>
              {/* Face */}
              <circle cx={cx} cy={cy} r={r} fill={skin} stroke="#D4A76A" strokeWidth="1"/>
              {/* Hair sides – Arne style thinning on top */}
              <ellipse cx={cx-r*0.6} cy={cy-r*0.7} rx={r*0.3} ry={r*0.25} fill="#888"/>
              <ellipse cx={cx+r*0.6} cy={cy-r*0.7} rx={r*0.3} ry={r*0.25} fill="#888"/>
              {/* Eyebrows – bushy Arne */}
              <path d={`M${cx-r*0.5} ${cy-r*0.3} Q${cx-r*0.25} ${cy-r*0.4} ${cx-r*0.05} ${cy-r*0.3}`} fill="none" stroke="#555" strokeWidth={Math.max(1.5,r*0.07)} strokeLinecap="round"/>
              <path d={`M${cx+r*0.05} ${cy-r*0.3} Q${cx+r*0.25} ${cy-r*0.4} ${cx+r*0.5} ${cy-r*0.3}`} fill="none" stroke="#555" strokeWidth={Math.max(1.5,r*0.07)} strokeLinecap="round"/>
              {/* Eyes */}
              <circle cx={cx-r*0.28} cy={cy-r*0.1} r={Math.max(2,r*0.1)} fill="#5C4033"/>
              <circle cx={cx+r*0.28} cy={cy-r*0.1} r={Math.max(2,r*0.1)} fill="#5C4033"/>
              {/* Nose */}
              <ellipse cx={cx} cy={cy+r*0.15} rx={r*0.1} ry={r*0.12} fill="#E8A87C"/>
              {/* Mouth – classic Scheie smile */}
              <path d={`M${cx-r*0.28} ${cy+r*0.38} Q${cx} ${cy+r*0.52} ${cx+r*0.28} ${cy+r*0.38}`} fill="none" stroke="#A0522D" strokeWidth={Math.max(1,r*0.06)} strokeLinecap="round"/>
              {/* Chin / jaw */}
              <ellipse cx={cx} cy={cy+r*0.55} rx={r*0.35} ry={r*0.12} fill="#EAB898"/>
              {/* Glasses – Arne had glasses */}
              <rect x={cx-r*0.5} y={cy-r*0.2} width={r*0.38} height={r*0.28} fill="none" stroke="#555" strokeWidth={Math.max(1,r*0.05)} rx="2"/>
              <rect x={cx+r*0.12} y={cy-r*0.2} width={r*0.38} height={r*0.28} fill="none" stroke="#555" strokeWidth={Math.max(1,r*0.05)} rx="2"/>
              <line x1={cx-r*0.12} y1={cy-r*0.06} x2={cx+r*0.12} y2={cy-r*0.06} stroke="#555" strokeWidth={Math.max(0.8,r*0.04)}/>
            </svg>
            <div style={{fontSize:9,color:isWin?'#FFD700':'rgba(255,255,255,.7)',textAlign:'center',maxWidth:(r+4)*2,lineHeight:1.2,fontFamily:"'Kanit',sans-serif",wordBreak:'break-word'}}>{opt}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 7. Plain percent bars ─────────────────────────────────────────────
// Darken a hex color by mixing with black
function darkenHex(hex, amount=0.45) {
  const n = parseInt(hex.slice(1),16);
  const r = Math.round(((n>>16)&255)*(1-amount));
  const g = Math.round(((n>>8)&255)*(1-amount));
  const b = Math.round((n&255)*(1-amount));
  return `rgb(${r},${g},${b})`;
}
function PercentDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const colors = ['#4fc3f7','#81c784','#ffb74d','#e57373'];
  // Bar needs to be wide enough to show both vote count (left) and pct (right)
  // Threshold: ~30% fits both comfortably
  const BOTH_THRESHOLD = 30;
  const ONE_THRESHOLD  = 14;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      {options.map((opt,i)=>{
        const p = pct(votes[i],total);
        const v = votes[i];
        const color = colors[i%4];
        const darkColor = darkenHex(color, 0.4);
        const showBoth  = p >= BOTH_THRESHOLD;
        const showOne   = p >= ONE_THRESHOLD;
        return (
          <div key={i}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,.8)',fontFamily:"'Kanit',sans-serif"}}>{opt}</span>
              <span style={{fontSize:10,color:color,fontFamily:"'Fira Code',monospace",fontWeight:700}}>{p}%</span>
            </div>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:20,height:14,overflow:'hidden'}}>
              <div style={{width:`${Math.max(p,2)}%`,height:'100%',background:color,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'space-between',paddingLeft:6,paddingRight:5,transition:'width .4s',boxSizing:'border-box'}}>
                {/* Vote count left – only when ≥1 vote and bar wide enough */}
                {v > 0 && showOne && (
                  <span style={{fontSize:9,fontWeight:700,color:darkColor,lineHeight:1,flexShrink:0}}>
                    {v}
                  </span>
                )}
                {/* Pct right – only when bar is wide enough to fit both */}
                {showBoth && (
                  <span style={{fontSize:9,fontWeight:700,color:'#fff',lineHeight:1,flexShrink:0,marginLeft:'auto'}}>
                    {p}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{fontSize:9,color:'rgba(255,255,255,.35)',textAlign:'center',marginTop:2}}>{total} stemmer totalt</div>
    </div>
  );
}

// ── 8. Pie chart ──────────────────────────────────────────────────────
function PieDiagram({ options, votes }) {
  const total = votes.reduce((s,v)=>s+v,0);
  const colors = ['#B22234','#FFFFFF','#3C3B6E','#FFD700'];
  const r = 50, cx = 65, cy = 58;
  let startAngle = -Math.PI/2;
  const slices = votes.map((v,i)=>{
    const angle = total>0?(v/total)*2*Math.PI:0;
    const endAngle = startAngle+angle;
    const x1 = cx+r*Math.cos(startAngle), y1 = cy+r*Math.sin(startAngle);
    const x2 = cx+r*Math.cos(endAngle),   y2 = cy+r*Math.sin(endAngle);
    const large = angle>Math.PI?1:0;
    const midA = startAngle+angle/2;
    const slice = { path:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`,
      color:colors[i%4], midAngle:midA, pct:pct(v,total), label:options[i], votes:v };
    startAngle = endAngle;
    return slice;
  });
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <svg width="130" height="116">
        {slices.map((s,i)=>total>0&&s.pct>0?(
          <path key={i} d={s.path} fill={s.color} stroke="#0d1230" strokeWidth="1.5"/>
        ):null)}
        {total===0&&<circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,.1)"/>}
        {/* Pct labels on slices */}
        {slices.map((s,i)=>s.pct>8?(
          <text key={i} x={cx+r*0.65*Math.cos(s.midAngle)} y={cy+r*0.65*Math.sin(s.midAngle)+4}
            textAnchor="middle" fontSize="9" fontWeight="700"
            fill={s.color==='#FFFFFF'?'#222':'#fff'}>{s.pct}%</text>
        ):null)}
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {options.map((opt,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:10,height:10,borderRadius:2,background:colors[i%4],flexShrink:0}}/>
            <span style={{fontSize:9,color:'rgba(255,255,255,.8)',fontFamily:"'Kanit',sans-serif"}}>{opt}</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,.5)',fontFamily:"'Fira Code',monospace",marginLeft:'auto',paddingLeft:4}}>{pct(votes[i],total)}%</span>
          </div>
        ))}
        <div style={{fontSize:8,color:'rgba(255,255,255,.3)',marginTop:3}}>{total} stemmer</div>
      </div>
    </div>
  );
}

// ── Diagram dispatcher ────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function PollDiagram({ type, options, votes }) {
  const props = { options, votes };
  switch(type) {
    case 'trump_tower':      return <TrumpDiagram {...props}/>;
    case 'bar_rwb':          return <RWBDiagram {...props}/>;
    case 'horizontal_neymar':return <NeymarDiagram {...props}/>;
    case 'limousine':        return <LimoDiagram {...props}/>;
    case 'drillo':           return <DrilloDiagram {...props}/>;
    case 'arne_scheie':      return <ArneScheieDiagram {...props}/>;
    case 'percent':          return <PercentDiagram {...props}/>;
    case 'pie':              return <PieDiagram {...props}/>;
    default:                 return <PercentDiagram {...props}/>;
  }
}


// ── Poll admins ──────────────────────────────────────────────────────
const POLL_ADMINS = new Set(['tarjei','vetle','admin','lars','hansandreas',
  'Tarjei','Vetle','Admin','Lars','HansAndreas','lars gaustad','hans andreas','Lars Gaustad','Hans Andreas']);

function PollWidget({ me, isMobile }) {
  const [poll, setPoll] = useState(null);
  const [voted, setVoted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['','']);
  const [saving, setSaving] = useState(false);
  const [animatedWidths, setAnimatedWidths] = useState([]);

  const canCreate = POLL_ADMINS.has(me?.username) || POLL_ADMINS.has(me?.displayName);

  useEffect(() => {
    const unsub = onSnapshot(doc(db,'config','activePoll'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setPoll(data);
        const username = me?.username || me?.displayName;
        const firestoreVoted = username && Array.isArray(data.voters) && data.voters.includes(username);
        if (firestoreVoted) {
          setVoted(true);
        } else {
          try {
            const v = JSON.parse(localStorage.getItem('vm_poll_votes')||'{}');
            setVoted(!!v[data.id]);
          } catch { setVoted(false); }
        }
      } else { setPoll(null); }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.username, me?.displayName]);

  // Animer stolpene fra 0 til target-bredde når resultater vises
  useEffect(() => {
    if (!voted || !poll) return;
    const totalV = (poll.votes||[]).reduce((s,v)=>s+v,0);
    const targets = (poll.votes||[]).map(v => totalV>0 ? Math.max(Math.round((v/totalV)*100),2) : 2);
    setAnimatedWidths(targets.map(()=>0));
    const t = setTimeout(() => setAnimatedWidths(targets), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voted, poll?.id]);

  const vote = async (optIdx) => {
    if (!poll || voted) return;
    const username = me?.username || me?.displayName;
    if (!username) return;
    const newVotes = [...(poll.votes || poll.options.map(()=>0))];
    newVotes[optIdx]++;
    // Store vote in Firestore (authoritative) and localStorage (fast local check)
    await updateDoc(doc(db,'config','activePoll'), {
      votes: newVotes,
      voters: [...(poll.voters || []), username],
    });
    try {
      const v = JSON.parse(localStorage.getItem('vm_poll_votes')||'{}');
      v[poll.id] = optIdx; localStorage.setItem('vm_poll_votes', JSON.stringify(v));
    } catch {}
    setVoted(true);
  };

  const createPoll = async () => {
    if (!question.trim() || opts.filter(o=>o.trim()).length < 2) return;
    setSaving(true);
    const validOpts = opts.filter(o=>o.trim());
    await setDoc(doc(db,'config','activePoll'), {
      id: Date.now().toString(),
      question: question.trim(),
      options: validOpts,
      votes: validOpts.map(()=>0),
      createdBy: me.displayName,
      createdAt: Date.now(),
    });
    setQuestion(''); setOpts(['','']); setCreating(false); setSaving(false);
  };

  const totalVotes = poll ? (poll.votes||[]).reduce((s,v)=>s+v,0) : 0;
  // eslint-disable-next-line no-unused-vars
  const maxVotes   = poll ? Math.max(...(poll.votes||[1]),1) : 1;
  const BAR_COLORS = ['#399C33','#E81324','#027CCF'];

  const containerStyle = {
    padding:'7px 9px', display:'flex', flexDirection:'column', gap:4,
    minWidth: isMobile ? 180 : 180, width: '100%', height:'100%', boxSizing:'border-box',
  };

  // ── Create form ──
  if (creating) return (
    <div style={containerStyle}>
      <input value={question} onChange={e=>setQuestion(e.target.value)}
        placeholder="Spørsmål..." maxLength={120} autoFocus
        style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,215,0,.35)',
          borderRadius:5,color:'#fff',padding:'3px 7px',fontSize:10,
          fontFamily:"'Kanit',sans-serif",outline:'none'}}/>
      {opts.map((o,i)=>(
        <input key={i} value={o} onChange={e=>{const n=[...opts];n[i]=e.target.value;setOpts(n);}}
          placeholder={`Alt. ${i+1}`} maxLength={28}
          style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',
            borderRadius:5,color:'#fff',padding:'3px 7px',fontSize:10,
            fontFamily:"'Kanit',sans-serif",outline:'none'}}/>
      ))}
      {opts.length < 3 && (
        <button onClick={()=>setOpts([...opts,''])}
          style={{background:'none',border:'1px dashed rgba(255,255,255,.18)',
            color:'rgba(255,255,255,.45)',borderRadius:5,fontSize:9,padding:'2px 4px',
            cursor:'pointer',fontFamily:"'Kanit',sans-serif"}}>+ alt</button>
      )}
      <div style={{display:'flex',gap:5,marginTop:2}}>
        <button onClick={createPoll} disabled={saving}
          style={{flex:1,background:'rgba(255,215,0,.18)',border:'1px solid rgba(255,215,0,.4)',
            color:'#FFD700',borderRadius:5,fontSize:10,padding:'3px',cursor:'pointer',
            fontFamily:"'Kanit',sans-serif",fontWeight:700}}>
          {saving?'⟳':'Publiser'}
        </button>
        <button onClick={()=>setCreating(false)}
          style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',
            color:'rgba(255,255,255,.55)',borderRadius:5,fontSize:10,padding:'3px 6px',cursor:'pointer'}}>✕</button>
      </div>
    </div>
  );

  // ── No poll ──
  if (!poll) return (
    <div style={{...containerStyle,alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:9,color:'rgba(255,255,255,.25)',textAlign:'center'}}>Ingen aktiv poll</div>
      {canCreate && (
        <button onClick={()=>setCreating(true)}
          style={{marginTop:4,background:'rgba(255,215,0,.12)',border:'1px solid rgba(255,215,0,.28)',
            color:'#FFD700',borderRadius:6,fontSize:10,padding:'3px 8px',cursor:'pointer',
            fontFamily:"'Kanit',sans-serif",fontWeight:700}}>Ny poll</button>
      )}
    </div>
  );

  // ── Active poll – two-column layout ──
  return (
    <div style={{ padding:'8px 12px', display:'flex', gap:12, height:'100%',
      boxSizing:'border-box', position:'relative', width:'100%' }}>
      {/* +ny floats top-right */}
      {canCreate && (
        <button onClick={()=>setCreating(true)}
          style={{position:'absolute',top:4,right:8,background:'none',border:'none',
            color:'rgba(255,215,0,.4)',fontSize:8,cursor:'pointer',padding:0,
            fontFamily:"'Inter',sans-serif",lineHeight:1}}>+ny</button>
      )}
      {/* Left: question */}
      <div style={{ flex:'0 0 38%', display:'flex', alignItems:'center' }}>
        <div style={{ fontSize:11, color:'#FFD700', fontFamily:"'Kanit',sans-serif",
          fontWeight:700, lineHeight:1.3, textTransform:'uppercase', letterSpacing:0.5,
          paddingRight: canCreate ? 12 : 0 }}>
          {poll.question}
        </div>
      </div>
      {/* Divider */}
      <div style={{ width:1, background:'rgba(255,255,255,.1)', alignSelf:'stretch', flexShrink:0 }}/>
      {/* Right: options / bars */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
        {poll.options.map((opt,i)=>{
          const v = (poll.votes||[])[i]||0;
          const p = totalVotes>0?Math.round((v/totalVotes)*100):0;
          const color = BAR_COLORS[i%BAR_COLORS.length];
          const isMyVote = voted && (() => { try { return JSON.parse(localStorage.getItem('vm_poll_votes')||'{}')[poll.id]===i; } catch { return false; } })();
          return voted ? (
            <div key={i}>
              <div style={{fontSize:10,color:'rgba(255,255,255,.82)',fontFamily:"'Kanit',sans-serif",
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2,
                fontWeight:isMyVote?700:400,textAlign:'left'}}>{opt}</div>
              <div style={{height:14,overflow:'hidden'}}>
                <div style={{width:`${animatedWidths[i]??0}%`,height:'100%',background:color,borderRadius:0,
                  display:'flex',alignItems:'center',justifyContent:'space-between',paddingLeft:6,paddingRight:5,
                  transition:'width .6s cubic-bezier(.25,.8,.25,1)',boxSizing:'border-box'}}>
                  {v>0&&(animatedWidths[i]??0)>=14&&<span style={{fontSize:9,fontWeight:700,color:darkenHex(color,0.4),fontFamily:"'Fira Code',monospace",flexShrink:0,lineHeight:1}}>{v}</span>}
                  {(animatedWidths[i]??0)>=30&&<span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.9)',fontFamily:"'Fira Code',monospace",flexShrink:0,lineHeight:1,marginLeft:'auto'}}>{p}%</span>}
                </div>
              </div>
            </div>
          ) : (
            <button key={i} onClick={()=>vote(i)}
              style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.14)',
                color:'#e8edf8',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',
                fontFamily:"'Kanit',sans-serif",fontWeight:600,textAlign:'left',
                transition:'background .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,215,0,.14)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.07)'}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}



// ── Stats Carousel (mobile only) ─────────────────────────────────────
function StatsCarousel({ widgets }) {
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [stopped, setStopped] = useState(false); // permanent once touched
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const startOffset = useRef(0);
  const animRef = useRef(null);
  const SPEED = 0.25; // px per frame – 50% slower than before

  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    if (trackRef.current) setTrackW(trackRef.current.scrollWidth / 2);
  }, [widgets]);

  useEffect(() => {
    if (stopped || trackW === 0) return;
    const step = () => {
      setOffset(o => {
        const next = o + SPEED;
        return next >= trackW ? 0 : next;
      });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [stopped, trackW]);

  const onTouchStart = (e) => {
    // Stop rotation permanently for this page visit
    cancelAnimationFrame(animRef.current);
    setStopped(true);
    setIsDragging(true);
    dragStart.current = e.touches[0].clientX;
    startOffset.current = offset;
  };
  const onTouchMove = (e) => {
    if (!isDragging) return;
    const dx = dragStart.current - e.touches[0].clientX;
    let next = startOffset.current + dx;
    if (next < 0) next = trackW + next;
    if (next >= trackW) next = next - trackW;
    setOffset(next);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    // Rotation stays stopped – restarts only on next page visit
  };

  return (
    <div style={{ overflow: 'hidden', width: '100%', cursor: 'grab', marginBottom: 16 }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div ref={trackRef} style={{
        display: 'flex', gap: 8, alignItems: 'stretch',
        transform: `translateX(-${offset}px)`,
        willChange: 'transform',
      }}>
        {widgets}{widgets}
      </div>
    </div>
  );
}

function StatBoxWithTooltip({ num, label, tooltip, mobile = false }) {
  const [show, setShow] = useState(false);
  const boxRef = useRef(null);
  const [rect, setRect] = useState(null);
  const closeTimer = useRef(null);

  const openTooltip = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (boxRef.current) {
      const r = boxRef.current.getBoundingClientRect();
      setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    }
    setShow(true);
  };
  const closeTooltip = () => {
    closeTimer.current = setTimeout(() => setShow(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const toggle = (e) => {
    e.stopPropagation();
    if (mobile) {
      if (!show && boxRef.current) setRect(boxRef.current.getBoundingClientRect());
      setShow(s => !s);
    }
  };

  const popupStyle = rect ? {
    position: 'absolute',
    top: rect.top,
    left: rect.left,
    transform: 'none',
    background: 'rgba(10,14,30,0.97)',
    border: '1px solid rgba(255,215,0,.25)',
    borderRadius: 10,
    padding: '10px 14px',
    zIndex: 99999,
    boxShadow: '0 8px 32px rgba(0,0,0,.8)',
    minWidth: 200,
  } : {};

  return (
    <div ref={boxRef} style={{ ...C.statWidget, flex: mobile ? undefined : 1, width: mobile ? 100 : undefined,
      flexShrink: mobile ? 0 : undefined, padding: mobile ? '12px 8px' : '8px 6px', cursor: 'pointer' }}
      onMouseEnter={() => !mobile && openTooltip()}
      onMouseLeave={() => !mobile && closeTooltip()}
      onClick={toggle}>
      <div style={{ ...C.statNum, fontSize: mobile ? 32 : 28 }}>{num}</div>
      <div style={{ ...C.statLabel, fontSize: mobile ? 10 : 9, letterSpacing: 1.5 }}>{label}
        {tooltip && <span style={{ fontSize: 8, color: 'rgba(255,215,0,.5)', marginLeft: 2 }}>▲</span>}
      </div>
      {show && tooltip && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => setShow(false)}
            onTouchEnd={() => setShow(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
          />
          <div style={{...popupStyle}} onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onMouseEnter={cancelClose} onMouseLeave={closeTooltip}>
            {tooltip}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function Dashboard({ me, phase, onShowTips, setTab }) {
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();
  const useCarousel = isMobile || isTouch; // karusell på alle touch-enheter (stående og liggende)
  const [users, setUsers] = useState([]);
  const [results, setResultsState] = useState({});
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [summaries, setSummaries] = useState({});
  const [editingSummary, setEditingSummary] = useState(null);
  const [summaryText, setSummaryText] = useState('');

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [matchesFullscreen, setMatchesFullscreen] = useState(false);
  const { soundOn, toggleSound, playSound } = useChatSound();
  const prevMsgCount = useRef(0);

  useEffect(() => {
    if (msgs.length > 0 && prevMsgCount.current > 0 && msgs.length > prevMsgCount.current) {
      const latest = msgs[msgs.length - 1];
      if (latest?.user !== me.displayName) playSound();
    }
    prevMsgCount.current = msgs.length;
  }, [msgs]); // eslint-disable-line

  const openChatFullscreen = () => { window.history.pushState({ modal: 'chat' }, '', ''); setChatFullscreen(true); };
  const openMatchesFullscreen = () => { window.history.pushState({ modal: 'matches' }, '', ''); setMatchesFullscreen(true); };

  useEffect(() => {
    const onPop = (e) => {
      if (chatFullscreen) setChatFullscreen(false);
      else if (matchesFullscreen) setMatchesFullscreen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [chatFullscreen, matchesFullscreen]);
  const chatBot = useRef(null);

  const [liveEvent, setLiveEvent] = useState(null);
  const [scorers, setScorers] = useState([]);
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeOnlineUsers(setOnlineUsers); return u; }, []);
  useEffect(() => { const u = subscribeMatchSummaries(setSummaries); return u; }, []);
  useEffect(() => { const u = subscribeLiveEvent(ev => setLiveEvent(ev?.type ? ev : null)); return u; }, []);
  useEffect(() => { const u = subscribeStatsCache(data => setScorers(data?.scorers || [])); return u; }, []);
  const chatBoxRef = useRef(null);
  useEffect(() => { if(chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, [msgs]);
  useEffect(() => {
    getAllUsers().then(us => {
      setUsers(us.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'))
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);

  const sendMsg = async () => {
    const t = input.trim(); if (!t) return;
    const senderIsBot = PANEL_EXPERTS.some(e => e.name === me.displayName);
    setInput('');
    await sendChatMessage(me.displayName, t, '');

    // Prune to 40 messages
    if (msgs.length >= 40) {
      msgs.slice(0, msgs.length - 39).forEach(m => { if (m.id) deleteChatMessage(m.id); });
    }

    if (senderIsBot) return;

    if (t.toLowerCase().includes('@funfact')) {
      const expert = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];
      setTimeout(async () => {
        const prompt = `${expert.personality}\n\nKom med én interessant funfact om fotball-VM (FIFA World Cup). Finn noe genuint interessant, overraskende eller morsomt – historisk statistikk, rekorder, kuriøse hendelser, underdog-historier. Presenter det som deg selv med din personlighet og dialekt. Maks 3 setninger.`;
        const reply = await chatWithExpert(expert, prompt, []);
        await sendChatMessage(expert.name, `🎲 Funfact: ${reply}`, '');
      }, 800);
      return;
    }

    const mentionMatches = [...t.matchAll(/@([a-zæøå-]+)/gi)];
    const mentionedExperts = [];
    mentionMatches.forEach(match => {
      const mentioned = match[1].toLowerCase().replace('-','');
      const expert = PANEL_EXPERTS.find(e =>
        e.firstName.toLowerCase() === match[1].toLowerCase() ||
        e.firstName.toLowerCase().replace('-','') === mentioned ||
        e.id === mentioned
      );
      if (expert && !mentionedExperts.find(e => e.id === expert.id)) mentionedExperts.push(expert);
    });
    mentionedExperts.forEach((expert, i) => {
      setTimeout(async () => {
        const ctx = buildCompetitionContext(users, results, liveEvent);
        const reply = await chatWithExpert(expert, t, [], ctx);
        await sendChatMessage(expert.name, reply, '');
      }, 1000 + i * 2000);
    });
  };

  const saveSummary = async (matchId) => {
    if (!summaryText.trim()) return;
    await setMatchSummary(matchId, summaryText.trim(), me.displayName);
    setEditingSummary(null); setSummaryText('');
  };

  const medals = ['🥇', '🥈', '🥉'];
  const myRank = users.findIndex(u => u.id === me.username) + 1;
  const finishedMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES].filter(m => {
    const r = results[m.id];
    return r && r.home !== undefined && r.away !== undefined;
  }).sort((a, b) => { const kA = new Date(a.date + "T" + (a.time||"00:00") + ":00+02:00").getTime(); const kB = new Date(b.date + "T" + (b.time||"00:00") + ":00+02:00").getTime(); return kB - kA; });

  return (
    <>
    <div>
      {/* Stats widgets */}
      {(() => {
        const nowTs = Date.now();
        const isKickedOff = m => new Date(m.date + 'T' + (m.time || '00:00') + ':00+02:00').getTime() < nowTs;
        const finishedCount = GROUP_MATCHES.filter(m => results[m.id]?.home !== undefined && isKickedOff(m)).length;
        const totalGoals = GROUP_MATCHES.reduce((s,m) => {
          const r = results[m.id];
          return r?.home !== undefined && isKickedOff(m) ? s + (r.home||0) + (r.away||0) : s;
        }, 0);
        // const myPts removed – replaced by form table

        // ── Formtabell: siste N kamper (N = min(finishedCount, 5)) ──────
        const formN = Math.min(finishedCount, 5);
        const allMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
        const now = Date.now();
        const recentMatches = allMatches
          .filter(m => {
            const r = results[m.id];
            if (r?.home === undefined) return false;
            // Ekskluder kamper som ikke er ferdigspilt ennå
            const kickoff = new Date(m.date + 'T' + (m.time || '00:00') + ':00+02:00').getTime();
            return kickoff < now;
          })
          .sort((a, b) => { const kA = new Date(a.date + "T" + (a.time||"00:00") + ":00+02:00").getTime(); const kB = new Date(b.date + "T" + (b.time||"00:00") + ":00+02:00").getTime(); return kB - kA; })
          .slice(0, formN);

        const realUsers = users.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));
        const formScores = realUsers.map(u => {
          let pts = 0, ft = 0;
          recentMatches.forEach(m => {
            const tip = u.tips?.[m.id];
            const act = results[m.id];
            if (!tip || !act) return;
            const p = calcMatchPts(tip, act);
            pts += p;
            if (p >= 4) ft++;
          });
          return { id: u.id, name: u.displayName, pts, ft };
        }).sort((a, b) => b.pts - a.pts || b.ft - a.ft);

        const top3Form = formScores.slice(0, 3);

        // eslint-disable-next-line no-unused-vars
        const stats = [
          { num: myRank ? `#${myRank}` : '–', label: isMobile ? 'Plass' : 'Din plassering' },
          ...(!isMobile ? [
            { num: finishedCount, label: 'Spilte kamper' },
          ] : []),
          { num: totalGoals, label: isMobile ? 'Mål' : 'Antall mål' },
        ];
        // All widget items in order
        const myFormEntry = formScores.find(u => u.id === me.username);
        const myFormRank = formScores.findIndex(u => u.id === me.username);
        const meInTop3Form = myFormRank >= 0 && myFormRank < 3;

        const formRow = (u, i, medal = true, isMyRow = false) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 4,
            background: isMyRow ? 'rgba(255,215,0,.08)' : 'transparent', borderRadius: 4, padding: '1px 2px', flexShrink: 0 }}>
            {medal
              ? <span style={{ fontSize: 10 }}>{ ['🥇','🥈','🥉'][i] }</span>
              : <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', width: 14, textAlign: 'right', fontFamily: "'Fira Code',monospace" }}>#{myFormRank + 1}</span>
            }
            <span style={{ flex: 1, fontSize: 10, color: isMyRow ? '#FFD700' : 'rgba(255,255,255,.8)',
              fontWeight: isMyRow ? 700 : 500, fontFamily: "'Kanit',sans-serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
            <span style={{ fontSize: 10, color: '#FFD700', fontWeight: 700, fontFamily: "'Fira Code',monospace" }}>{u.pts}p</span>
            {u.ft > 0 && <span style={{ fontSize: 8, color: 'rgba(255,215,0,.6)' }}>{u.ft}✓</span>}
          </div>
        );

        const formWidgetContent = (extraStyle = {}) => (
          <div key="form" style={{ ...C.statWidget, padding: '6px 10px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            gap: 2, overflow: 'hidden', ...extraStyle }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: formN >= 3 ? 3 : 1, flexShrink: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, lineHeight: 1.2,
                color: '#FFD700', fontFamily: "'Kanit',sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>
                Formtabell
              </div>
              {formN >= 3 && (
                <div style={{ fontSize: 8, letterSpacing: 1, lineHeight: 1.2,
                  color: 'rgba(255,215,0,.65)', fontFamily: "'Kanit',sans-serif", fontWeight: 600, textTransform: 'uppercase' }}>
                  Siste {formN} kamp{formN !== 1 ? 'er' : ''}
                </div>
              )}
            </div>
            {formN < 3 ? (
              <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 10, textAlign: 'center' }}>Kommer etter kamp #3</div>
            ) : (
              <>
                {top3Form.map((u, i) => formRow(u, i, true, u.id === me.username))}
                {!meInTop3Form && myFormEntry && (
                  <div style={{ marginTop: 3, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 3, flexShrink: 0 }}>
                    {formRow(myFormEntry, null, false, true)}
                  </div>
                )}
              </>
            )}
          </div>
        );
        const formWidget = formWidgetContent({ flex: 1 });
        const formWidgetCarousel = formWidgetContent({ width: 150, flexShrink: 0 });

        const pollWidget = (
          <div key="poll" style={{ ...C.statWidget, minWidth: 220, width: 'max-content', maxWidth: 320, padding: 0,
            alignItems: 'stretch', justifyContent: 'stretch', flexShrink: 0 }}>
            <PollWidget me={me} isMobile={isMobile} />
          </div>
        );

        const simpleStats = [
          { key: 'rank',  num: myRank ? `#${myRank}` : '–', label: 'Plass' },
          { key: 'games', num: finishedCount, label: 'Kamper' },
          { key: 'goals', num: totalGoals,    label: 'Mål' },
        ];

        // Karusell-widgets: faste dimensjoner, like i stående og liggende
        const carouselSimpleWidgets = simpleStats.map(({ key, num, label }) => {
          if (key === 'goals') {
            return (
              <StatBoxWithTooltip key={key} num={num} label={label} mobile={true} tooltip={
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontFamily:"'Kanit',sans-serif", fontWeight:700, fontSize:11, color:'#FFD700', letterSpacing:2, textAlign:'center', marginBottom:8 }}>TOPPSCORERE</div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', overflowX: 'hidden' }}>
                  {scorers.filter(s => s.goals > 0).length > 0 ? scorers.filter(s => s.goals > 0).sort((a,b) => b.goals - a.goals).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ color: 'rgba(255,255,255,.8)', display:'flex', alignItems:'center', gap:4 }}><Flag team={s.team} size={14} /> {s.name}</span>
                      <span style={{ color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>{s.goals} mål</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontStyle: 'italic' }}>Toppscorerliste kommer</div>}
                  </div>
                </div>
              } />
            );
          }
          if (key === 'rank') {
            return (
              <div key={key} style={{ ...C.statWidget, width: 100, flexShrink: 0, padding: '12px 8px', cursor:'pointer' }} onClick={() => setTab('tips')}>
                <div style={{ ...C.statNum, fontSize: 32 }}>{num}</div>
                <div style={{ ...C.statLabel, fontSize: 10, letterSpacing: 1.5 }}>{label}</div>
              </div>
            );
          }
          return (
            <div key={key} style={{ ...C.statWidget, width: 100, flexShrink: 0, padding: '12px 8px' }}>
              <div style={{ ...C.statNum, fontSize: 32 }}>{num}</div>
              <div style={{ ...C.statLabel, fontSize: 10, letterSpacing: 1.5 }}>{label}</div>
            </div>
          );
        });

        // Desktop-widgets: flex, skalerer med tilgjengelig bredde
        const simpleWidgets = simpleStats.map(({ key, num, label }) => {
          if (key === 'goals') {
            return (
              <StatBoxWithTooltip key={key} num={num} label={label} tooltip={
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontFamily:"'Kanit',sans-serif", fontWeight:700, fontSize:11, color:'#FFD700', letterSpacing:2, textAlign:'center', marginBottom:8 }}>TOPPSCORERE</div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', overflowX: 'hidden' }}>
                  {scorers.filter(s => s.goals > 0).length > 0 ? scorers.filter(s => s.goals > 0).sort((a,b) => b.goals - a.goals).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ color: 'rgba(255,255,255,.8)', display:'flex', alignItems:'center', gap:4 }}><Flag team={s.team} size={14} /> {s.name}</span>
                      <span style={{ color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>{s.goals} mål</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontStyle: 'italic' }}>Toppscorerliste kommer</div>}
                  </div>
                </div>
              } />
            );
          }
          if (key === 'rank') {
            return (
              <div key={key} style={{ ...C.statWidget, flex: 1, padding: '8px 6px', cursor:'pointer' }} onClick={() => setTab('tips')}>
                <div style={{ ...C.statNum, fontSize: 28 }}>{num}</div>
                <div style={{ ...C.statLabel, fontSize: 9, letterSpacing: 1.5 }}>{label}</div>
              </div>
            );
          }
          return (
            <div key={key} style={{ ...C.statWidget, flex: 1, padding: '8px 6px' }}>
              <div style={{ ...C.statNum, fontSize: 28 }}>{num}</div>
              <div style={{ ...C.statLabel, fontSize: 9, letterSpacing: 1.5 }}>{label}</div>
            </div>
          );
        });

        const quizWidget = (
          <div key="quiz" style={{ flexShrink: 0 }}>
            <QuizWidget username={me.username} />
          </div>
        );

        const allWidgets = [carouselSimpleWidgets[0], formWidgetCarousel, carouselSimpleWidgets[1], carouselSimpleWidgets[2], pollWidget, quizWidget];

        if (useCarousel) {
          // Karusell: scroller horisontalt, fungerer i både stående og liggende mobilformat
          return <StatsCarousel widgets={allWidgets} />;
        }

        // Desktop: stat-bokser er kompakte, poll vokser med innhold, quiz setter høyde
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%', marginBottom: 16, overflow: 'hidden' }}>
            {simpleWidgets[0]}
            {formWidget}
            {simpleWidgets[1]}
            {simpleWidgets[2]}
            {/* Poll vokser med innholdet sitt, men aldri høyere enn quiz-kortet */}
            <div style={{ flex: 2, minWidth: 180, ...C.statWidget, padding: 0, alignItems: 'stretch', justifyContent: 'stretch', overflow: 'hidden' }}>
              <PollWidget me={me} isMobile={false} />
            </div>
            {quizWidget}
          </div>
        );
      })()}
      <div style={isMobile ? C.dashGrid3Mobile : C.dashGrid3}>
      {/* Tabell */}
      <div style={{ ...C.card, ...(isMobile ? C.dashCardFixedMobile : C.dashCardFixed), ...(isMobile ? { order: 2 } : {}) }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => setTab('leaderboard')}>
          <span style={C.cardTitle}><CardIcon src="/tabell.png" /> Tabell</span>
          <button onClick={e => { e.stopPropagation(); setTab('leaderboard'); }} style={{
            background: 'rgba(255,180,0,.12)', border: '1px solid rgba(255,180,0,.35)',
            color: '#FFB700', borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="Se full tabell">⛶</button>
        </div>
        <div style={C.dashCardFixedBody}>
          {users.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', padding: 20, fontSize: 13 }}>Ingen deltakere ennå.</p>}
          {users.map((r, i) => {
            const tipsLocked = !OPEN_PHASES.has(phase);
            const canView = tipsLocked || r.id === me.username;
            return (
            <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}), cursor: canView ? 'pointer' : 'default' }}
              onClick={() => canView && onShowTips && onShowTips(r)}>
              <span style={C.lbRank}>{medals[i] || <span style={{ color: '#4a5a80', fontSize: 13 }}>{i + 1}</span>}</span>
              <span style={{ ...C.lbName }}>
                {canView
                  ? <PlayerTipsTooltip user={r} results={results} onShowTips={u => onShowTips && onShowTips(u)} />
                  : <span>{r.displayName}<span style={C.lbLockIcon}>🔒</span></span>
                }
              </span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {(r.fulltreff||0) > 0 && renderFulltreff(r.fulltreff)}
                <div style={{ textAlign: 'right' }}>
                  <div style={C.lbPts}>{r.total}</div>
                  <div style={C.lbPtsL}>poeng</div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>


      {/* Chat */}
      <div style={{ ...C.card, ...(isMobile ? C.dashCardFixedMobile : C.dashCardFixed), ...(isMobile ? { order: 1 } : {}) }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => setTab('chat')}>
          <span style={C.cardTitle}><CardIcon src="/chat.png" /> Chat</span>
          <div style={{ ...C.cardHeaderActions, gap: isMobile ? 4 : 6 }} onClick={e => e.stopPropagation()}>

            <OnlineIndicator onlineUsers={onlineUsers} compact={isMobile} />
            <SoundToggle soundOn={soundOn} onToggle={toggleSound} />
            <button onClick={e => { e.stopPropagation(); chatFullscreen ? setChatFullscreen(false) : openChatFullscreen(); }} style={{ background:'rgba(255,180,0,.12)', border:'1px solid rgba(255,180,0,.35)', color:'#FFB700', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} title="Fullskjerm">⛶</button>
          </div>
        </div>
        <div style={C.dashCardFixedChat} ref={chatBoxRef}>
          {msgs.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Si hei! 👋</p>}
          {msgs.map((m, i) => (
            <ChatBubble key={m.id || i} m={m} mine={m.user === me.displayName}
              isAdmin={me.isAdmin} onDelete={deleteChatMessage} maxImgH={200} username={me.displayName} />
          ))}
        </div>
        <div style={C.chatInputRow}>
          <ImageUploadButton onImage={dataUrl => sendChatMessage(me.displayName, '', dataUrl)} />
          <input style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 13, padding: '8px 12px' }}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()}
            placeholder="Skriv melding…"
            onPaste={async e=>{
              const items=e.clipboardData?.items;
              if(!items)return;
              for(let item of items){
                if(item.type.startsWith('image/')){
                  e.preventDefault();
                  const file=item.getAsFile();
                  const dataUrl = await compressImage(file);
                  sendChatMessage(me.displayName,'',dataUrl);
                  return;
                }
              }
            }}
          />
          <button style={{ ...C.btnSend }} onClick={sendMsg}>Send</button>
        </div>
      </div>

      {/* Kamper */}
      <div style={{ ...C.card, ...(isMobile ? C.dashCardFixedMobile : C.dashCardFixed), ...(isMobile ? { order: 3 } : {}) }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => openMatchesFullscreen()}>
          <span style={C.cardTitle}><CardIcon src="/tips.png" /> Siste kamper</span>
          <button onClick={e => { e.stopPropagation(); openMatchesFullscreen(); }} style={{
            background: 'rgba(255,180,0,.12)', border: '1px solid rgba(255,180,0,.35)',
            color: '#FFB700', borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="Alle kamper">⛶</button>
        </div>
        {finishedMatches.length === 0 && (
          <p style={{ color: '#4a5a80', textAlign: 'center', padding: 24, fontSize: 13 }}>
            Ingen resultater ennå.
          </p>
        )}
        <div style={C.dashCardFixedMatchList}>
          {finishedMatches.map(m => {
            const r = results[m.id];
            const sum = summaries[m.id];
            const isEditing = editingSummary === m.id;
            return (
              <div key={m.id} style={{ ...C.matchCard, borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:0, paddingTop: 24, marginTop: 8 }}>
                {(() => { const LIVE_SET = new Set(['1H','HT','2H','ET','BT','P','INT','LIVE']); const FINISHED_SET = new Set(['FT','AET','PEN','AWD','WO']); const kickoff = new Date(m.date + 'T' + (m.time||'00:00') + ':00+02:00').getTime(); const minsAgo = (Date.now() - kickoff) / 60000; const maxMins = m.phase === 'group' ? 180 : 240; const isLive = r && LIVE_SET.has(r.status) && !FINISHED_SET.has(r.status) && minsAgo >= 0 && minsAgo < maxMins; return isLive ? (
                  <div style={{ textAlign:'center', marginBottom:4 }}>
                    <span style={{ fontSize:10, color:'#ef4444', fontWeight:700, letterSpacing:1 }}>🔴 LIVE</span>
                  </div>
                ) : null; })()}
                <div style={C.matchTeams}>
                  <span style={{ ...C.matchTeam, textAlign:'right', flex:1 }}>{m.home} <Flag team={m.home} /></span>
                  <span style={C.matchScore}>{r.home} – {r.away}</span>
                  <span style={{ ...C.matchTeam, textAlign:'left', flex:1 }}><Flag team={m.away} /> {m.away}</span>
                </div>
                <div style={{ ...C.matchScorers, textAlign:'center' }}>Gruppe {m.group} · {fmtDate(m.date)}{m.time ? ' · ' + m.time : ''}<FulltreffBadge matchId={m.id} results={results} users={users} /></div>
                {/* Spillers kampreferat */}
                {sum?.text && !isEditing ? (
                  <div style={{ marginTop:6 }}>
                    <div style={C.matchSummaryText}>{sum.text}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={C.matchSummaryAuthor}>✍️ {sum.author}</div>
                      {sum.author === me.displayName && (
                        <button style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', fontSize:11, cursor:'pointer', padding:0 }}
                          onClick={() => { setEditingSummary(m.id); setSummaryText(sum.text); }}>
                          ✏️ Rediger
                        </button>
                      )}
                    </div>
                  </div>
                ) : isEditing ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea style={{ ...C.ta, fontSize: 12, marginBottom: 6 }} rows={5}
                      value={summaryText} onChange={e => setSummaryText(e.target.value)}
                      placeholder="Skriv et kort kampreferat…" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...C.btnGold, padding: '6px 14px', fontSize: 11 }} onClick={() => saveSummary(m.id)}>Lagre</button>
                      <button style={{ ...C.btnSecondary, padding: '6px 14px', fontSize: 11 }} onClick={() => setEditingSummary(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <button style={C.matchSummaryBtn} onClick={() => { setEditingSummary(m.id); setSummaryText(''); }}>
                      ✍️ Skriv kampreferat
                    </button>
                  </div>
                )}
                {/* Bot-sammendrag */}
                {sum?.botText ? (
                  <div style={{ ...C.botSummaryBox, borderLeft: `3px solid ${PANEL_EXPERTS.find(e => e.name === sum.botName)?.color || 'rgba(255,215,0,.5)'}`, paddingLeft: 10 }}>
                    <div style={C.botSummaryText}>{sum.botText}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ ...C.botSummaryAuthor, color: PANEL_EXPERTS.find(e => e.name === sum.botName)?.color || 'rgba(255,215,0,.5)' }}>
                        {sum.botName}
                      </div>
                      {me?.isAdmin && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => {
                            const newText = prompt('Rediger bot-referat:', sum.botText);
                            if (newText !== null) setDoc(doc(db, 'summaries', m.id), { botText: newText }, { merge: true });
                          }} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', fontSize:10, cursor:'pointer' }}>✏️ Rediger</button>
                          <button onClick={() => {
                            if (window.confirm('Slett bot-referatet?')) setDoc(doc(db, 'summaries', m.id), { botText: null, botName: null, botId: null }, { merge: true });
                          }} style={{ background:'none', border:'none', color:'rgba(255,100,100,.4)', fontSize:10, cursor:'pointer' }}>🗑️ Slett</button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'center'}}><BotSummaryTrigger matchId={m.id} match={m} results={results} users={users} summaries={summaries} /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
    {chatFullscreen && (
          <div style={{ position:'fixed', inset:0, zIndex:999, background:'#0a0e1a', display:'flex', flexDirection:'column' }}>
            <div style={{ ...C.cardHeader, flexShrink:0 }}>
              <span style={C.cardTitle}><span style={C.cardTitleDot}/> Chat – Fullskjerm</span>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 6px #4ade80' }}/>
                  <span style={{ fontSize:12, color:'#4ade80' }}>{onlineUsers.length} online</span>
                  {onlineUsers.length > 0 && (
                    <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:"'Fira Code',monospace" }}>
                      ({onlineUsers.join(', ')})
                    </span>
                  )}
                </div>
                <button onClick={() => setChatFullscreen(false)} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'12px 16px' }} ref={el => { if(el) el.scrollTop = el.scrollHeight; }}>
              {msgs.map((m, i) => (
                <ChatBubble key={m.id || i} m={m} mine={m.user === me.displayName} username={me.displayName} />
              ))}
              <div ref={chatBot}/>
            </div>
            <div style={{ ...C.chatInputRow, flexShrink:0 }}>
              <ImageUploadButton onImage={dataUrl => sendChatMessage(me.displayName, '', dataUrl)} />
              <input style={{...C.inp,marginBottom:0,flex:1,fontSize:13,padding:'8px 12px'}}
                value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendMsg()}
                placeholder="Skriv melding…"/>
              <button style={{...C.btnSend}} onClick={sendMsg}>Send</button>
            </div>
          </div>
    )}
    {matchesFullscreen && (
      <div style={{ position:'fixed', inset:0, zIndex:999, background:'#0a0e1a', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ ...C.cardHeader, flexShrink:0, position:'sticky', top:0, background:'#0a0e1a', zIndex:1 }}>
          <span style={C.cardTitle}><span style={C.cardTitleDot}/> Siste kamper – Fullskjerm</span>
          <button onClick={() => setMatchesFullscreen(false)} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ flex:1, padding:'0 0 40px 0' }}>
          {finishedMatches.length === 0 && (
            <p style={{ color:'#4a5a80', textAlign:'center', padding:40, fontSize:13 }}>Ingen resultater ennå.</p>
          )}
          {finishedMatches.map(m => {
            const r = results[m.id];
            const sum = summaries[m.id];
            const isEditing = editingSummary === m.id;
            const botExpert = sum?.botName ? PANEL_EXPERTS.find(e => e.name === sum.botName) : null;
            const botColor = botExpert?.color || 'rgba(255,215,0,.5)';
            return (
              <div key={m.id} style={{ ...C.matchCard, borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:0, paddingTop: 24, marginTop: 8 }}>
                {(() => { const LIVE_SET = new Set(['1H','HT','2H','ET','BT','P','INT','LIVE']); const FINISHED_SET = new Set(['FT','AET','PEN','AWD','WO']); const kickoff = new Date(m.date + 'T' + (m.time||'00:00') + ':00+02:00').getTime(); const minsAgo = (Date.now() - kickoff) / 60000; const maxMins = m.phase === 'group' ? 180 : 240; const isLive = r && LIVE_SET.has(r.status) && !FINISHED_SET.has(r.status) && minsAgo >= 0 && minsAgo < maxMins; return isLive ? (
                  <div style={{ textAlign:'center', marginBottom:4 }}>
                    <span style={{ fontSize:10, color:'#ef4444', fontWeight:700, letterSpacing:1 }}>🔴 LIVE</span>
                  </div>
                ) : null; })()}
                <div style={C.matchTeams}>
                  <span style={{ ...C.matchTeam, textAlign:'right', flex:1 }}>{m.home} <Flag team={m.home} /></span>
                  <span style={C.matchScore}>{r.home} – {r.away}</span>
                  <span style={{ ...C.matchTeam, textAlign:'left', flex:1 }}><Flag team={m.away} /> {m.away}</span>
                </div>
                <div style={{ ...C.matchScorers, textAlign:'center' }}>Gruppe {m.group} · {fmtDate(m.date)}{m.time ? ' · ' + m.time : ''}<FulltreffBadge matchId={m.id} results={results} users={users} /></div>
                {sum?.text && !isEditing ? (
                  <div style={{ marginTop:6 }}>
                    <div style={C.matchSummaryText}>{sum.text}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={C.matchSummaryAuthor}>✍️ {sum.author}</div>
                      {sum.author === me.displayName && (
                        <button style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', fontSize:11, cursor:'pointer', padding:0 }}
                          onClick={() => { setEditingSummary(m.id); setSummaryText(sum.text); }}>
                          ✏️ Rediger
                        </button>
                      )}
                    </div>
                  </div>
                ) : isEditing ? (
                  <div style={{ marginTop:8 }}>
                    <textarea style={{ ...C.ta, fontSize:12, marginBottom:6 }} rows={5}
                      value={summaryText} onChange={e => setSummaryText(e.target.value)}
                      placeholder="Skriv et kort kampreferat…" />
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ ...C.btnGold, padding:'6px 14px', fontSize:11 }} onClick={() => saveSummary(m.id)}>Lagre</button>
                      <button style={{ ...C.btnSecondary, padding:'6px 14px', fontSize:11 }} onClick={() => setEditingSummary(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'center'}}><button style={C.matchSummaryBtn} onClick={() => { setEditingSummary(m.id); setSummaryText(''); }}>✍️ Skriv kampreferat</button></div>
                )}
                {sum?.botText && (
                  <div style={{ ...C.botSummaryBox, borderLeft:`3px solid ${botColor}`, paddingLeft:10 }}>
                    <div style={C.botSummaryText}>{sum.botText}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ ...C.botSummaryAuthor, color:botColor }}>{sum.botName}</div>
                      {me?.isAdmin && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => {
                            const newText = prompt('Rediger bot-referat:', sum.botText);
                            if (newText !== null) setDoc(doc(db, 'summaries', m.id), { botText: newText }, { merge: true });
                          }} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', fontSize:10, cursor:'pointer' }}>✏️ Rediger</button>
                          <button onClick={() => {
                            if (window.confirm('Slett bot-referatet?')) setDoc(doc(db, 'summaries', m.id), { botText: null, botName: null, botId: null }, { merge: true });
                          }} style={{ background:'none', border:'none', color:'rgba(255,100,100,.4)', fontSize:10, cursor:'pointer' }}>🗑️ Slett</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!sum?.botText && (
                  <div style={{display:'flex',justifyContent:'center'}}><BotSummaryTrigger matchId={m.id} match={m} results={results} users={users} summaries={summaries} /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
//  PLAYER TIPS POPUP (hover/tap in leaderboard)
// ══════════════════════════════════════════════════════════════════════
function PlayerTipsTooltip({ user, results, onShowTips }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const isMobile = useIsMobile();
  const hideTimer = useRef(null);
  const spanRef = useRef(null);

  const enter = () => { clearTimeout(hideTimer.current); setShow(true); };
  const leave = () => { hideTimer.current = setTimeout(() => setShow(false), 300); };
  const calcCoords = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.right + 4 }; };
  const handleMouseEnter = () => { if (spanRef.current) setCoords(calcCoords(spanRef.current)); enter(); };
  const handleClick = (e) => { e.stopPropagation(); if (!show && spanRef.current) setCoords(calcCoords(spanRef.current)); setShow(s => !s); };

  const FINISHED_S = new Set(["FT","AET","PEN","AWD","WO"]);
  const LIVE_S = new Set(["1H","HT","2H","ET","BT","P","INT","LIVE"]);
  const now = Date.now();
  const allMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
  const liveMatch = allMatches.find(m => {
    const ms = new Date(m.date + "T" + (m.time||"00:00") + ":00+02:00").getTime();
    const r = results[m.id];
    return (now-ms)>=0 && (now-ms)<180*60000 && r && LIVE_S.has(r.status) && !FINISHED_S.has(r.status);
  });
  const upcoming = allMatches.filter(m => {
    const ms = new Date(m.date+"T"+(m.time||"00:00")+":00+02:00").getTime();
    return ms > now && !results[m.id];
  }).sort((a,b) => new Date(a.date+"T"+(a.time||"00:00")+":00+02:00") - new Date(b.date+"T"+(b.time||"00:00")+":00+02:00"));
  const showMatches = liveMatch ? [liveMatch, ...upcoming.slice(0,2)] : upcoming.slice(0,3);
  const fmtTip = (matchId) => { const t = user.tips?.[matchId]; if (!t||t.home===undefined||t.away===undefined) return "–"; return t.home+" – "+t.away; };

  const popW = 240;
  const left = Math.min(coords.left, window.innerWidth - popW - 8);
  const top = Math.min(Math.max(coords.top - 10, 8), window.innerHeight - 260);

  return (
    <>
      <span
        ref={spanRef}
        style={{ textDecoration:"underline", textDecorationColor:"rgba(255,215,0,.3)", cursor:"pointer", padding:"4px 6px", borderRadius:6, display:"inline-block" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => !isMobile && leave()}
        onClick={handleClick}
      >
        {user.displayName || user.id}
      </span>
      {show && createPortal(
        <>
          {isMobile && <div onClick={() => setShow(false)} onTouchEnd={() => setShow(false)} style={{ position:"fixed", inset:0, zIndex:899 }} />}
          <div
            onMouseEnter={() => !isMobile && enter()}
            onMouseLeave={() => !isMobile && leave()}
            style={{ position:"fixed", top, left, zIndex:900, width:popW, background:"#0e1628", border:"1px solid rgba(255,215,0,.25)", borderRadius:12, padding:"12px 14px", boxShadow:"0 8px 32px rgba(0,0,0,.8)", pointerEvents:"auto" }}
          >
            <div style={{ fontSize:12, fontWeight:700, color:"#FFD700", marginBottom:10, textAlign:"center" }}>{user.displayName || user.id}</div>
            {showMatches.length === 0 && <div style={{ fontSize:11, color:"rgba(255,255,255,.4)" }}>Ingen kommende kamper</div>}
            {showMatches.map((m, idx) => {
              const tip = fmtTip(m.id);
              const isLive = idx === 0 && liveMatch;
              const r = results[m.id];
              const tipParts = tip !== "–" ? tip.split(" – ") : null;
              const tipH = tipParts ? parseInt(tipParts[0]) : null;
              const tipA = tipParts ? parseInt(tipParts[1]) : null;
              const actH = r ? parseInt(r.home) : null;
              const actA = r ? parseInt(r.away) : null;
              // Color logic for live: yellow if correct goals or correct outcome
              const homeClr = isLive && tipH !== null && actH !== null
                ? (tipH === actH ? "#FFD700" : "rgba(255,255,255,.9)") : "rgba(255,255,255,.9)";
              const awayClr = isLive && tipA !== null && actA !== null
                ? (tipA === actA ? "#FFD700" : "rgba(255,255,255,.9)") : "rgba(255,255,255,.9)";
              const outcome = (h, a) => h > a ? "H" : h < a ? "A" : "D";
              const dashClr = isLive && tipH !== null && actH !== null
                ? (outcome(tipH, tipA) === outcome(actH, actA) ? "#FFD700" : "rgba(255,255,255,.9)") : "rgba(255,255,255,.9)";
              const shortH = TEAM_SHORT[m.home] || m.home.slice(0,3).toUpperCase();
              const shortA = TEAM_SHORT[m.away] || m.away.slice(0,3).toUpperCase();
              return (
                <div key={m.id} style={{ marginBottom:idx<showMatches.length-1?8:0, paddingBottom:idx<showMatches.length-1?8:0, borderBottom:idx<showMatches.length-1?"1px solid rgba(255,255,255,.07)":"none" }}>
                  {isLive && <div style={{ fontSize:10, color:"#ef4444", fontWeight:700, marginBottom:2 }}>🔴 LIVE</div>}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ flex:1, textAlign:"right", fontSize:idx===0?13:11, fontWeight:idx===0?600:400, color:"#e8edf8", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>{shortH} <Flag team={m.home} size={idx===0?14:12} /></span>
                    <span style={{ flexShrink:0, minWidth:idx===0?44:36, textAlign:"center", fontSize:idx===0?14:12, fontWeight:800, background:"rgba(0,0,0,.3)", borderRadius:6, padding:idx===0?"3px 7px":"2px 5px", border:"1px solid rgba(255,255,255,.08)", color:"rgba(255,255,255,.15)" }}>
                      {tip === "–" ? <span style={{color:"rgba(255,255,255,.2)"}}>–</span> : (
                        <span>
                          <span style={{color:homeClr}}>{tipH}</span>
                          <span style={{color:dashClr, margin:"0 2px"}}>-</span>
                          <span style={{color:awayClr}}>{tipA}</span>
                        </span>
                      )}
                    </span>
                    <span style={{ flex:1, fontSize:idx===0?13:11, fontWeight:idx===0?600:400, color:"#e8edf8", display:"flex", alignItems:"center", gap:4 }}><Flag team={m.away} size={idx===0?14:12} /> {shortA}</span>
                  </div>
                </div>
              );
            })}
            <button onClick={() => { setShow(false); onShowTips(user); }} style={{ marginTop:12, width:"100%", padding:"7px 0", borderRadius:8, background:"rgba(255,215,0,.12)", border:"1px solid rgba(255,215,0,.3)", color:"#FFD700", fontSize:11, fontWeight:700, cursor:"pointer" }}>Fullt skjema →</button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function Leaderboard({ me, phase, initialSelected, onClearSelected, onShowTips }) {
  const [rows, setRows] = useState([]);
  const [results, setResultsState] = useState({});
  const [selected, setSelected] = useState(initialSelected || null);

  const tipsLocked = !OPEN_PHASES.has(phase);
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => {
    getAllUsers().then(us => {
      setRows(us.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'))
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);
  const medals = ['🥇', '🥈', '🥉'];
  if (selected) {
    if (onShowTips) { onShowTips(selected); setSelected(null); }
    return null;
  }
  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Full poengtabell</span></div>
      <div style={C.cardBody}>
        {rows.map((r, i) => {
          const canView = tipsLocked || r.id === me.username;
          return (
          <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}), cursor: canView ? 'pointer' : 'default' }}
            onClick={() => canView && (onShowTips ? onShowTips(r) : setSelected(r))}>
            <span style={C.lbRank}>{medals[i] || <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>{i + 1}</span>}</span>
            <span style={{ ...C.lbName }}>
              {canView
                ? <PlayerTipsTooltip user={r} results={results} onShowTips={u => { onShowTips ? onShowTips(u) : setSelected(u); }} />
                : <span>{r.displayName}<span style={C.lbLockIcon}>🔒</span></span>
              }
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {(r.fulltreff||0) > 0 && renderFulltreff(r.fulltreff)}
              <div style={{ textAlign: 'right' }}>
                <div style={C.lbPts}>{r.total}</div>
                <div style={C.lbPtsL}>poeng</div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Render tipped score with color-coded correct parts ────────────────
function matchOutcome(h, a) {
  const hi = parseInt(h), ai = parseInt(a);
  if (isNaN(hi) || isNaN(ai)) return null;
  return hi > ai ? 'H' : hi < ai ? 'A' : 'D';
}


function renderPtsBadge(pts) {
  if (pts === null) return null;
  return (
    <span style={{
      fontSize: 15, fontFamily: "'Inter',sans-serif", fontWeight: 800, minWidth: 20,
      textAlign: 'right', flexShrink: 0,
      color: pts > 0 ? '#FFD700' : '#e8edf8',
    }}>
      {pts}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MATCH INFO POPUP
// ══════════════════════════════════════════════════════════════════════
function MatchInfoPopup({ match, onClose, anchorRef, results }) {
  const s = STADIUMS[match.stadium] || {};
  const fmtD = d => { if (!d) return ''; const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };
  const r = results?.[match.id];

  // Position: try to show near the anchor element if provided
  const [pos, setPos] = useState({ bottom: 28, left: 12 });
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.min(rect.right + 8, window.innerWidth - 292);
      const top = Math.max(rect.top - 10, 10);
      setPos({ top, left, bottom: undefined });
    }
  }, []); // eslint-disable-line

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:899 }} />
      <div
        onClick={e => e.stopPropagation()}
        onMouseLeave={onClose}
        style={{
          position:'fixed', zIndex:900, width:284,
          bottom: pos.bottom, top: pos.top, left: pos.left,
          background:'rgba(13,18,48,.97)',
          border:'2px solid rgba(255,215,0,.3)', borderRadius:14,
          overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.8)',
          maxHeight: '80vh', overflowY: 'auto',
        }}>
        {s.img && <img src={s.img} alt={s.name} style={{ width:'100%', height:130, objectFit:'cover', display:'block' }} onError={e => e.target.style.display='none'} />}
        <div style={{ padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:14, fontWeight:700, color:'#e8edf8' }}>
              <Flag team={match.home} /> {match.home}
            </span>
            <span style={{ fontSize:12, color:'rgba(255,215,0,.7)', fontFamily:"'Fira Code',monospace" }}>vs</span>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:14, fontWeight:700, color:'#e8edf8' }}>
              {match.away} <Flag team={match.away} />
            </span>
          </div>
          {r?.home !== undefined && (
            <div style={{ textAlign:'center', margin:'6px 0 10px', padding:'8px', background:'rgba(255,255,255,.06)', borderRadius:8 }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#e8edf8', fontFamily:"'Inter',sans-serif", letterSpacing:2 }}>
                {r.home} – {r.away}
              </div>
              {(r.etHome !== null && r.etHome !== undefined) && (
                <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>
                  Etter ekstraomganger: {r.etHome} – {r.etAway}
                </div>
              )}
              {(r.penHome !== null && r.penHome !== undefined) && (
                <div style={{ fontSize:11, color:'#FFD700', marginTop:2 }}>
                  Straffer: {r.penHome} – {r.penAway}
                </div>
              )}
              {r.status && r.status !== 'FT' && r.status !== 'AET' && r.status !== 'PEN' && (
                <div style={{ fontSize:10, color:'#4ade80', marginTop:2 }}>🔴 LIVE – {r.elapsed}'</div>
              )}
            </div>
          )}
          <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', lineHeight:2 }}>
            <div>📅 {fmtD(match.date)} · {match.time} CEST</div>
            {s.name && <div>🏟️ {s.name}</div>}
            {s.capacity && <div style={{paddingLeft:20}}>👥 {s.capacity.toLocaleString('no')} tilskuerplasser</div>}
            {s.clubs && <div style={{paddingLeft:20}}>🏠 {s.clubs}</div>}
            {s.city && <div>📍 {s.city}, {s.country}</div>}
            {match.group && <div>🔵 Gruppe {match.group}</div>}
          </div>
        </div>
      </div>
    </>, document.body
  );
}

// ══════════════════════════════════════════════════════════════════════
//  TIPS FORM
// ══════════════════════════════════════════════════════════════════════

function GroupOrderPopup({ group, grpO, setOrd, results, grpOk, onClose }) {
  const teams = GROUPS[group];
  const actOrder = results[`grp_${group}`];
  const tipOrder = grpO[group] || [];
  const allGroupPlayed = GROUP_MATCHES.filter(m => m.group === group).every(m => results[m.id]?.home !== undefined);
  let totalGrpPts = 0;
  if (allGroupPlayed && actOrder) {
    tipOrder.forEach((t, i) => { if (t && t === actOrder[i]) totalGrpPts += 5; });
  }

  return createPortal(
    <>
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:899 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position:'fixed', zIndex:900,
        width:280, bottom:28, left:12,
        background:'rgba(13,18,48,.97)', border:'2px solid rgba(255,215,0,.3)',
        borderRadius:16, padding:24,
        boxShadow:'0 12px 40px rgba(0,0,0,.8)',
      }}>
        <div style={{ fontSize:13, color:'rgba(255,215,0,.7)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:14 }}>Gruppe {group} – rangering</div>
        {[0,1,2,3].map(pos => {
          const picked = tipOrder[pos] || '';
          const correct = allGroupPlayed && actOrder && picked && picked === actOrder[pos];
          const pickedTeams = [0,1,2,3].map(p => tipOrder[p]).filter(t => t && t !== picked);
          return (
            <div key={pos} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ color:'rgba(255,255,255,.4)', fontSize:12, width:16 }}>{pos+1}.</span>
              {grpOk ? (
                <TeamSelect
                  value={picked}
                  onChange={val => setOrd(group, pos, val)}
                  teams={teams}
                  dimmed={pickedTeams}
                />
              ) : (
                <span style={{ flex:1, fontSize:13, color:'#e8edf8', display:'flex', alignItems:'center', gap:6 }}>
                  {picked ? <><Flag team={picked} /> {picked}</> : <span style={{color:'rgba(255,255,255,.3)'}}>–</span>}
                </span>
              )}
              {allGroupPlayed && actOrder && picked && (
                <span style={{ fontSize:13 }}>{correct ? '✅' : '❌'}</span>
              )}
            </div>
          );
        })}
        {allGroupPlayed && actOrder && (
          <div style={{ marginTop:14, paddingTop:10, borderTop:'1px solid rgba(255,255,255,.1)', textAlign:'center' }}>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginRight:6 }}>Gruppepoeng:</span>
            <span style={{ fontSize:18, fontWeight:800, color:'#FFD700', fontFamily:"'Inter',sans-serif" }}>{totalGrpPts}</span>
          </div>
        )}

      </div>
    </>, document.body
  );
}

function TipsForm({ me, phase, viewUser }) {
  const isMobile = useIsMobile();
  const isOwn = !viewUser || viewUser.id === me.username;

  const [pulseId, setPulseId]   = useState(null);
  const pulseRef = useRef(null);

  const grpOk  = isOwn && phase === 'pre';
  const specOk = isOwn && (phase === 'pre' || phase === 'group_lock');
  const koOk   = isOwn && OPEN_PHASES.has(phase);

  // Start pulse sequence when tips/spec/grpO loaded and grpOk
  useEffect(() => {
    if (!grpOk) return;
    // Small delay so data settles first
    const t = setTimeout(() => startPulseSequence(), 1200);
    return () => clearTimeout(t);
  }, [grpOk]); // eslint-disable-line

  const startPulseSequence = () => {
    if (pulseRef.current) clearTimeout(pulseRef.current);
    // Build ordered list of empty field IDs
    const buildSeq = () => {
      const seq = [];
      // 1. Spesialtips
      SPEC_FIELDS.forEach(({ key }) => {
        if (!spec[key]) seq.push(`spec_${key}`);
      });
      // 2. Grupper A–L
      const groups = [...new Set(GROUP_MATCHES.map(m => m.group))].sort();
      groups.forEach(g => {
        const order = grpO[g] || [];
        if (order.filter(Boolean).length < 4) seq.push(`grp_${g}`);
      });
      // 3. Kamper i kronologisk rekkefølge
      [...GROUP_MATCHES].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(m => {
        const t = tips[m.id];
        if (t?.home === undefined || t?.away === undefined) seq.push(`match_${m.id}`);
      });
      return seq;
    };

    let runs = 0;
    const seq = buildSeq();
    if (seq.length === 0) return;

    const step = (idx) => {
      if (idx >= seq.length) {
        runs++;
        if (runs >= 3) { setPulseId(null); return; }
        pulseRef.current = setTimeout(() => step(0), 400);
        return;
      }
      setPulseId(seq[idx]);
      pulseRef.current = setTimeout(() => step(idx + 1), 320);
    };
    step(0);
  };

  const pulseStyle = (id, isFilled = false) => (!isFilled && pulseId === id) ? {
    animation: 'fieldPulse 0.6s ease-out forwards',
    borderColor: 'rgba(255,215,0,.8)',
  } : {};
  const userId = viewUser ? viewUser.id : me.username;

  const [tips, setTips]   = useState({});
  const [grpO, setGrpO]   = useState({});
  const [spec, setSpec]   = useState({});
  const [botSource, setBotSource] = useState(null);
  const [botFilled, setBotFilled] = useState({});
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResultsState] = useState({});
  const [grpPopup, setGrpPopup] = useState(null);
  const [matchPopup, setMatchPopup] = useState(null);

  // Determine default tab: sluttspill if all group matches played
  const allGroupDone = GROUP_MATCHES.every(m => results[m.id]?.home !== undefined);
  const [tab, setTab] = useState(() => allGroupDone ? 'knockout' : 'group');
  useEffect(() => { if (allGroupDone) setTab('knockout'); }, [allGroupDone]);

  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => {
    getUser(userId).then(u => {
      if (u) { setTips(u.tips || {}); setGrpO(u.groupOrders || {}); setSpec(u.specialTips || {}); setBotSource(u.botSource || null); setBotFilled(u.botFilledMatches || {}); }
      setLoading(false);
    });
  }, [userId]);

  const setTip = (id, field, val) => { setTips(p => ({ ...p, [id]: { ...p[id], [field]: val } })); setDirty(true); };
  const setOrd = (g, i, val) => {
    setGrpO(p => {
      const a = p[g] ? [...p[g]] : ['','','',''];
      const cleaned = a.map((v, idx) => (idx !== i && v === val) ? '' : v);
      cleaned[i] = val;
      return { ...p, [g]: cleaned };
    });
    setDirty(true);
  };
  const setSp = (k, v) => { setSpec(p => ({ ...p, [k]: v })); setDirty(true); };

  const resetTips = async () => {
    if (!window.confirm('Er du sikker på at du vil nullstille tipsene dine?\n\nTips for kamper som allerede er spilt kan ikke fjernes.')) return;
    const playedMatchIds = new Set(Object.keys(results));
    const keptTips = {};
    [...GROUP_MATCHES, ...KNOCKOUT_MATCHES].forEach(m => {
      if (playedMatchIds.has(m.id) && tips[m.id]) keptTips[m.id] = tips[m.id];
    });
    const keptGrpO = grpOk ? {} : grpO;
    const keptSpec = grpOk ? {} : spec;
    setTips(keptTips); setGrpO(keptGrpO); setSpec(keptSpec); setBotSource(null);
    await updateUser(me.username, { tips: keptTips, groupOrders: keptGrpO, specialTips: keptSpec, botSource: null });
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const save = async () => {
    // Fetch the current saved tips from DB so we never overwrite already-played matches
    const saved_u = await getUser(me.username);
    const safeTips = { ...(saved_u?.tips || {}) };

    // Group tips: only writable during 'pre' phase
    if (grpOk) {
      GROUP_MATCHES.forEach(m => {
        // Never overwrite a match that already has a result
        if (results[m.id]?.home !== undefined) return;
        if (tips[m.id] !== undefined) safeTips[m.id] = tips[m.id];
      });
    }

    // Knockout tips: only writable during an open knockout phase
    if (koOk) {
      KNOCKOUT_MATCHES.forEach(m => {
        // Never overwrite a match that already has a result
        if (results[m.id]?.home !== undefined) return;
        if (tips[m.id] !== undefined) safeTips[m.id] = tips[m.id];
      });
    }

    // Special tips: only writable during 'pre' phase
    const safeSpec = grpOk ? spec : (saved_u?.specialTips || {});
    // Group orders: only writable during 'pre' phase
    const safeGrpO = grpOk ? grpO : (saved_u?.groupOrders || {});

    await updateUser(me.username, { tips: safeTips, groupOrders: safeGrpO, specialTips: safeSpec });
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div style={C.card}><p style={{ color:'#6070a0', textAlign:'center', padding:40 }}>Laster…</p></div>;

  const displayName = viewUser ? viewUser.displayName : me.displayName;

  // Chronological group matches
  const chronoGroupMatches = [...GROUP_MATCHES].sort((a,b) => {
    const da = new Date(`${a.date}T${a.time||'00:00'}`);
    const db = new Date(`${b.date}T${b.time||'00:00'}`);
    return da - db;
  });

  return (
    <>
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot} /> {isOwn ? 'Mine tips' : `${displayName}s tips`}</span>
      </div>
      <div style={C.cardBody}>
        {botSource && isOwn && (
          <div style={C.botBanner}>🤖 Disse tipsene ble generert av <strong>{PANEL_EXPERTS.find(e=>e.id===botSource)?.name || botSource}</strong></div>
        )}

        {/* Spesialtips */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', height: isMobile ? 'auto' : 340, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ ...C.specBox, flex: isMobile ? '1 1 auto' : '0 0 auto', marginBottom: 0, overflowY: 'auto', minWidth: 0 }}>
          <span style={C.secH}>🌟 Spesialtips – låses før gruppespillet</span>
          {SPEC_FIELDS.map(({ key, label, pts, tooltip }) => {
            const correctVal = results[key];
            const tipVal = spec[key];
            const correct = correctVal && tipVal && tipVal === correctVal;
            const specPts = correct ? pts : null;
            const specBotId = botFilled[`spec_${key}`];
            const specBotEx = specBotId ? PANEL_EXPERTS.find(e => e.id === specBotId) : null;
            return (
              <div key={key} style={{ ...C.specRow, gap: isMobile ? 5 : 9,
                ...(specBotEx ? { borderLeft: `3px solid ${specBotEx.color || '#FFD700'}`, paddingLeft: 6 } : {}),
              }}>
                {specBotEx && (
                  <span title={`Tipset av ${specBotEx.name}`} style={{
                    fontSize: 8, color: specBotEx.color || '#FFD700',
                    background: `${specBotEx.color || '#FFD700'}18`,
                    border: `1px solid ${specBotEx.color || '#FFD700'}44`,
                    borderRadius: 4, padding: '1px 4px', flexShrink: 0, whiteSpace: 'nowrap',
                    fontFamily: "'Fira Code',monospace", alignSelf: 'center',
                  }}>🤖 {specBotEx.firstName || specBotEx.name.split(' ')[0]}</span>
                )}
                <span style={{ ...C.specLabel, fontSize: isMobile ? 11 : 12 }}>{label}{tooltip && <InfoTooltip text={tooltip} />}</span>
                <span style={{ ...C.ptsBadge, fontSize: isMobile ? 9 : 10, padding: isMobile ? '2px 4px' : '2px 6px', flexShrink: 0 }}>{pts}p</span>
                {specOk ? (
                  key === 'topscorer' ? (
                    <div style={{ width: isMobile ? 95 : 170, flexShrink: 0, borderRadius: 8, ...pulseStyle(`spec_${key}`, !!spec[key]) }}>
                    <PlayerAutocomplete
                      value={spec[key] || ''}
                      onChange={val => setSp(key, val)}
                      placeholder={isMobile ? 'Spiller...' : 'Søk etter spiller...'}
                      compact={isMobile}
                    />
                    </div>
                  ) : (
                    <div style={{ width: isMobile ? 95 : 170, flexShrink: 0, borderRadius: 8, ...pulseStyle(`spec_${key}`, !!spec[key]) }}>
                      <TeamSelect
                        value={spec[key] || ''}
                        onChange={val => setSp(key, val)}
                        teams={ALL_TEAMS}
                        compact={isMobile}
                      />
                    </div>
                  )
                ) : (
                  <span style={{ flex:1, fontSize:13, color: correct ? '#FFD700' : '#e8edf8', display:'flex', alignItems:'center', gap:6 }}>
                    {spec[key] ? <>{key !== 'topscorer' && <Flag team={spec[key]} />} {spec[key]}</> : <span style={{color:'rgba(255,255,255,.3)'}}>–</span>}
                    {specPts && <span style={{ marginLeft:'auto', fontSize:15, fontWeight:800, color:'#FFD700' }}>{specPts}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* VM-vinner bildekarusell */}
        {(() => {
          // Daglig seed gir samme bilde for alle brukere samme dag
          const daySeed = Math.floor(Date.now() / 86400000);
          const WC_IMGS = [
            '/arg.jfif',                                                          // Argentina 2022
            'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&fit=crop', // stadium crowd
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&fit=crop', // soccer ball
            'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=800&fit=crop', // football match
            'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=800&fit=crop', // stadium lights
            'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&fit=crop', // football game
            'https://images.unsplash.com/photo-1434648957308-5e6a859697e8?w=800&fit=crop', // trophy
            'https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=800&fit=crop', // MPhf5gE1qrI – WC 2022 fans
            'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&fit=crop', // 65yjpk2HSlA – stadium night
            'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&fit=crop', // IM2lm0RbbgA – packed stadium
            'https://images.unsplash.com/photo-1610201429753-a2bbbf01d5b0?w=800&fit=crop', // QcJ56_7JgFQ – world cup trophy
            'https://images.unsplash.com/photo-1580847097346-72d80f164702?w=800&fit=crop', // pTK5zcOMESQ – Berlin stadium
            'https://images.unsplash.com/photo-1551958219-acbc595d0a7c?w=800&fit=crop', // CVR95rpcJoo – Lofoten stadium
            'https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?w=800&fit=crop', // K4IVAFtu9GA – aerial stadium Brazil
            'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&fit=crop', // rFehnP5wN4Q – stadium daytime
            'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=800&fit=crop', // YpHQAk29xt4 – WC trophy
            'https://images.unsplash.com/photo-1588392382834-a891154bca4d?w=800&fit=crop', // _t4qb96wc14 – crowd cheering
            'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=800&fit=crop', // autxSXluVvc – fans flag
            'https://images.unsplash.com/photo-1623136564798-34e3d596e3cf?w=800&fit=crop', // RHd9lycurdI – Brazil fans
            'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&fit=crop', // MPhf5gE1qrI – fans stadium
            'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&fit=crop', // oc8m9Cj8dsc – celebration
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&fit=crop', // NPyS9whm_Yw – stadium
            'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?w=800&fit=crop', // dRVkXPa3a1A – fans streets
            'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&fit=crop', // L_Z0Sb2xcj0 – crowd banner
            'https://images.unsplash.com/photo-1626248801379-51a0748a5f96?w=800&fit=crop', // stadium action
          ];
          const img = { url: WC_IMGS[daySeed % WC_IMGS.length], caption: 'FIFA World Cup' };
          return (
            <div className="hide-portrait" style={{
              background: 'rgba(0,0,0,.2)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,.07)',
              padding: 16, flex: 1, minWidth: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 0,
            }}>
              <div style={{ width:'100%', height:'100%', borderRadius: 10, overflow:'hidden', position:'relative' }}>
                <img
                  src={img.url}
                  alt={img.caption}
                  style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block', borderRadius: 10 }}
                  onError={e => { e.target.src = '/arg.jfif'; }}
                />
                <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'6px 10px', background:'rgba(0,0,0,.55)', fontSize:10, color:'rgba(255,255,255,.6)', fontFamily:"'Fira Code',monospace", letterSpacing:1, borderRadius:'0 0 10px 10px' }}>
                  {img.caption}
                </div>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Tabs */}
        <div style={C.tabs}>
          {['group','knockout'].map(t => (
            <button key={t} style={{ ...C.tab, ...(tab===t ? C.tabOn : {}) }} onClick={() => setTab(t)}>
              {t === 'group' ? '📋 Gruppespill' : '🏟️ Sluttspill'}
            </button>
          ))}
        </div>

        {tab === 'group' && <>
          {/* Group cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(6, 1fr)' : 'repeat(12, 1fr)', gap: isMobile ? 4 : 10, marginBottom: 14 }}>
            {Object.entries(GROUPS).map(([g, teams]) => {
              const order = grpO[g] || [];
              const filled = order.filter(Boolean).length === 4;
              const groupDone = GROUP_MATCHES.filter(m => m.group === g).every(m => results[m.id]?.home !== undefined);
              const grpBotId = botFilled[`grp_${g}`];
              const grpBotEx = grpBotId ? PANEL_EXPERTS.find(e => e.id === grpBotId) : null;
              return (
                <button
                  key={g}
                  onClick={e => { e.stopPropagation(); setGrpPopup(g); }}
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: grpBotEx ? `1.5px solid ${grpBotEx.color || '#FFD700'}` : groupDone ? '1px solid rgba(255,215,0,.6)' : '1px solid rgba(255,255,255,.1)',
                    borderRadius: 8, padding: '5px 3px',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all .15s', minWidth: 0,
                    ...(!filled && pulseId === `grp_${g}` ? { animation: 'fieldPulse 0.6s ease-out forwards', borderColor: 'rgba(255,215,0,.8)' } : {}),
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                >
                  <div style={{ fontSize: isMobile ? 10 : 12, fontWeight: 800, color: grpBotEx ? (grpBotEx.color || '#FFD700') : filled ? '#FFD700' : 'rgba(255,255,255,.5)', fontFamily: "'Inter',sans-serif", marginBottom: 3, lineHeight: 1 }}>
                    {g}{grpBotEx && <span style={{ fontSize: 7, marginLeft: 2 }}>🤖</span>}
                  </div>
                  {(order.length === 4 ? order : [...order.filter(Boolean), ...teams.filter(t => !order.includes(t))]).map((team, i) => {
                    const code = COUNTRY_CODES[team];
                    const short = TEAM_SHORT[team] || team.slice(0,3).toUpperCase();
                    const placed = order.includes(team);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 2 : 3, marginBottom: 2, justifyContent: 'center' }}>
                        {code
                          ? <img src={`https://flagcdn.com/w20/${code}.png`} alt="" style={{ width: isMobile ? 11 : 13, height: isMobile ? 8 : 9, objectFit: 'cover', borderRadius: 1, flexShrink: 0, filter: placed ? 'none' : 'grayscale(100%) opacity(0.4)' }} />
                          : <span style={{ width: isMobile ? 11 : 13 }} />}
                        <span style={{ fontSize: isMobile ? 7 : 8, color: placed ? '#e8edf8' : 'rgba(255,255,255,.3)', whiteSpace: 'nowrap', fontFamily: "'Fira Code',monospace" }}>{short}</span>
                      </div>
                    );
                  })}
                </button>
              );
            })}
          </div>

          {isOwn && (
            <div style={{ textAlign: 'center', margin: '4px 0 12px', fontSize: isMobile ? 11 : 13, color: '#FFD700', fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: 0.5, userSelect: 'none', pointerEvents: 'none', opacity: 0.85 }}>
              ↑ Trykk på en gruppe for å fylle ut gruppeplassering ↑
            </div>
          )}

          {/* Chronological matches */}
          <div style={C.matchList}>
            {chronoGroupMatches.map(m => {
              const t = tips[m.id] || {};
              const act = results[m.id];
              const pts = act && t.home !== undefined && t.away !== undefined ? calcMatchPts(t, act) : null;
              const hasAct = act && act.home !== undefined && act.away !== undefined;
              const hasTip = t.home !== undefined && t.away !== undefined;
              const tH = hasTip ? parseInt(t.home) : null;
              const tA = hasTip ? parseInt(t.away) : null;
              const aH = hasAct ? parseInt(act.home) : null;
              const aA = hasAct ? parseInt(act.away) : null;
              const rightOutcome = hasAct && hasTip && matchOutcome(tH,tA) === matchOutcome(aH,aA);
              const rightHome    = hasAct && hasTip && tH === aH;
              const rightAway    = hasAct && hasTip && tA === aA;
              const superbonus   = rightOutcome && rightHome && rightAway && hasAct && (aH+aA) >= 5;
              return (
                <div key={m.id} style={{...C.mRow, gap:4, flexWrap:'nowrap', padding:'6px 8px', alignItems:'center',
                  ...(botFilled[m.id] ? { borderLeft: `3px solid ${PANEL_EXPERTS.find(e=>e.id===botFilled[m.id])?.color || '#FFD700'}` } : {}),
                }}>
                  {/* Bot-fill-merke */}
                  {botFilled[m.id] && (() => {
                    const ex = PANEL_EXPERTS.find(e => e.id === botFilled[m.id]);
                    return (
                      <span title={`Tipset av ${ex?.name || 'bot'}`} style={{
                        fontSize:9, color: ex?.color || '#FFD700', fontFamily:"'Fira Code',monospace",
                        background: `${ex?.color || '#FFD700'}18`, border: `1px solid ${ex?.color || '#FFD700'}44`,
                        borderRadius:4, padding:'1px 4px', flexShrink:0, whiteSpace:'nowrap',
                      }}>🤖 {ex?.firstName || 'Bot'}</span>
                    );
                  })()}
                  {/* Date/info box – hover to show match info */}
                  {(() => {
                    const isFirstMatch = m.id === 'A1';
                    const infoBoxRef = isFirstMatch ? { current: null } : null;
                    const setRef = isFirstMatch ? (el => { if (infoBoxRef) infoBoxRef.current = el; }) : undefined;
                    return (
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div
                          ref={setRef}
                          onClick={e => { e.stopPropagation(); setMatchPopup(m); }}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,215,0,.15)'; setMatchPopup(m); }}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
                          style={{
                            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                            minWidth:48, background:'rgba(255,255,255,.05)',
                            borderRadius:6, padding:'3px 5px', flexShrink:0, cursor:'pointer', transition:'background .15s',
                            border: isFirstMatch ? '1px solid #FFD700' : '1px solid transparent',
                            boxShadow: isFirstMatch ? '0 0 8px rgba(255,215,0,.35)' : 'none',
                          }}>
                          <span style={{fontSize:9,color:'rgba(255,255,255,.7)',fontFamily:"'Inter',sans-serif",whiteSpace:'nowrap'}}>{fmtDate(m.date)}</span>
                          {m.time && <span style={{fontSize:8,color:'rgba(255,255,255,.4)',fontFamily:"'Inter',sans-serif"}}>{m.time}</span>}
                          <span style={{fontSize:8,color:'rgba(255,215,0,.5)',fontFamily:"'Inter',sans-serif"}}>Gruppe {m.group}</span>
                        </div>
                        {isFirstMatch && (
                          <span style={{ position:'absolute', bottom:-14, left:0, right:0, textAlign:'center',
                            fontSize: 8, color: '#FFD700', whiteSpace: 'nowrap', fontFamily: "'Kanit',sans-serif",
                            fontWeight: 600, opacity: 0.75, pointerEvents:'none' }}>
                            kampinfo ↑
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {/* Home team – flex:1 so it pushes score box to center */}
                  <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-end',minWidth:0}}>
                    <span className="hide-portrait" style={{fontSize:12,color:'#e8edf8',textAlign:'right',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.home}</span>
                    <span className="show-portrait" style={{fontSize:11,color:'#e8edf8',fontWeight:700,whiteSpace:'nowrap'}}>{TEAM_SHORT[m.home]||m.home}</span>
                    <Flag team={m.home} size={18}/>
                  </div>
                  {/* Score box – fixed width so pts badge doesn't shift it */}
                  <div style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                    background:'rgba(255,255,255,.08)', borderRadius:8,
                    border: superbonus ? '1px solid #FFD700' : '1px solid rgba(255,255,255,.15)',
                    padding:'2px 8px', width:76, flexShrink:0,

                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <input style={{...C.sInp,width:32,fontSize:15,background:'transparent',border:'none',color:hasAct?(rightHome?'#FFD700':'#e8edf8'):'#e8edf8',textAlign:'center',padding:0}} type="number" min={0} max={20} disabled={!grpOk}
                        value={t.home ?? ''} placeholder='–' onChange={e => setTip(m.id,'home',e.target.value)} />
                      <span style={{color:superbonus?'#FFD700':rightOutcome?'#FFD700':'rgba(255,255,255,.5)',fontWeight:800,fontSize:15,lineHeight:1}}>–</span>
                      <input style={{...C.sInp,width:32,fontSize:15,background:'transparent',border:'none',color:hasAct?(rightAway?'#FFD700':'#e8edf8'):'#e8edf8',textAlign:'center',padding:0}} type="number" min={0} max={20} disabled={!grpOk}
                        value={t.away ?? ''} placeholder='–' onChange={e => setTip(m.id,'away',e.target.value)} />
                    </div>
                    {hasAct && <span style={{fontSize:9,color:'rgba(0,229,255,.75)',fontFamily:"'Fira Code',monospace",letterSpacing:1}}>{act.home}–{act.away}</span>}
                  </div>
                  {/* Away team */}
                  <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-start',minWidth:0}}>
                    <Flag team={m.away} size={18}/>
                    <span className="hide-portrait" style={{fontSize:12,color:'#e8edf8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.away}</span>
                    <span className="show-portrait" style={{fontSize:11,color:'#e8edf8',fontWeight:700,whiteSpace:'nowrap'}}>{TEAM_SHORT[m.away]||m.away}</span>
                  </div>
                  {/* Points – fixed width so it doesn't shift score box */}
                  <div style={{width:20,flexShrink:0,textAlign:'right'}}>
                    {renderPtsBadge(pts)}
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {tab === 'knockout' && <>
          {!koOk && <div style={C.lockBanner}>🔒 Sluttspill-vinduet er stengt.</div>}
          {KNOCKOUT_ROUNDS.map(({ phase: kp, label }) => (
            <div key={kp} style={{ marginBottom:18 }}>
              <span style={C.roundL}>{label}</span>
              {KNOCKOUT_MATCHES.filter(m => m.phase === kp).map(m => {
                const t = tips[m.id] || {};
                const act = results[m.id];
                const pts = act && t.home !== undefined && t.away !== undefined ? calcMatchPts(t, act) : null;
                const hasAct = act && act.home !== undefined && act.away !== undefined;
                const hasTip = t.home !== undefined && t.away !== undefined;
                const tH = hasTip ? parseInt(t.home) : null;
                const tA = hasTip ? parseInt(t.away) : null;
                const aH = hasAct ? parseInt(act.home) : null;
                const aA = hasAct ? parseInt(act.away) : null;
                const rightOutcome = hasAct && hasTip && matchOutcome(tH,tA) === matchOutcome(aH,aA);
                const rightHome    = hasAct && hasTip && tH === aH;
                const rightAway    = hasAct && hasTip && tA === aA;
                const superbonus   = rightOutcome && rightHome && rightAway && hasAct && (aH+aA) >= 5;

                // Resolve placeholder to actual team only when group is fully played
                const groupIsFinished = (grpLetter) => {
                  if (!grpLetter) return false;
                  return GROUP_MATCHES.filter(m => m.group === grpLetter).every(m => results[m.id]?.home !== undefined);
                };
                const resolveSlot = (slot) => {
                  if (!slot) return null;
                  const vinnerMatch = slot.match(/^Vinner ([A-L])$/);
                  const toerMatch   = slot.match(/^Toer ([A-L])$/);
                  if (vinnerMatch) {
                    const g = vinnerMatch[1];
                    if (!groupIsFinished(g)) return null;
                    return results[`grp_${g}`]?.[0] || (grpO[g] || [])[0] || null;
                  }
                  if (toerMatch) {
                    const g = toerMatch[1];
                    if (!groupIsFinished(g)) return null;
                    return results[`grp_${g}`]?.[1] || (grpO[g] || [])[1] || null;
                  }
                  return null;
                };
                // User's tip for the slot (shown in parens before group is done)
                const tipForSlot = (slot) => {
                  if (!slot) return null;
                  const vinnerMatch = slot.match(/^Vinner ([A-L])$/);
                  const toerMatch   = slot.match(/^Toer ([A-L])$/);
                  if (vinnerMatch) return (grpO[vinnerMatch[1]] || [])[0] || null;
                  if (toerMatch)   return (grpO[toerMatch[1]] || [])[1] || null;
                  return null;
                };
                const shortenSlot = (slot) => {
                  if (!slot || !isMobile) return slot;
                  return slot.replace('Vinner kamp ', 'Vinner ').replace('Taper kamp ', 'Taper ');
                };
                const resolvedHome = hasAct ? act.homeTeam : resolveSlot(m.home);
                const resolvedAway = hasAct ? act.awayTeam : resolveSlot(m.away);
                const tipHome = !resolvedHome ? tipForSlot(m.home) : null;
                const tipAway = !resolvedAway ? tipForSlot(m.away) : null;

                const TeamLabel = ({ slot, resolved, tip, align }) => {
                  const code = resolved ? COUNTRY_CODES[resolved] : null;
                  const tipCode = tip ? COUNTRY_CODES[tip] : null;
                  return (
                    <div style={{display:'flex',flexDirection:'column',alignItems: align==='right' ? 'flex-end' : 'flex-start',minWidth:0,flex:1}}>
                      {/* Placeholder or resolved team */}
                      <div style={{display:'flex',alignItems:'center',gap:3,justifyContent: align==='right' ? 'flex-end' : 'flex-start'}}>
                        {align==='right' && <span style={{fontSize:11,color: resolved ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.4)',textAlign:'right',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{resolved || slot}</span>}
                        {resolved && code
                          ? <img src={`https://flagcdn.com/w20/${code}.png`} alt="" style={{width:18,height:13,objectFit:'cover',borderRadius:2,flexShrink:0}} />
                          : !resolved && <span style={{fontSize:14}}>🏳️</span>}
                        {align==='left' && <span style={{fontSize:11,color: resolved ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{resolved || slot}</span>}
                      </div>
                      {/* User's tip in parens when group not done */}
                      {!resolved && tip && (
                        <div style={{display:'flex',alignItems:'center',gap:3,marginTop:2,justifyContent: align==='right' ? 'flex-end' : 'flex-start'}}>
                          {align==='right' && <span style={{fontSize:9,color:'rgba(255,215,0,.5)',fontFamily:"'Fira Code',monospace",whiteSpace:'nowrap'}}>({tip})</span>}
                          {tipCode && <img src={`https://flagcdn.com/w20/${tipCode}.png`} alt="" style={{width:14,height:10,objectFit:'cover',borderRadius:1,flexShrink:0,opacity:0.6}} />}
                          {align==='left' && <span style={{fontSize:9,color:'rgba(255,215,0,.5)',fontFamily:"'Fira Code',monospace",whiteSpace:'nowrap'}}>({tip})</span>}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div key={m.id} style={{...C.mRow, gap:4, flexWrap:'nowrap', padding:'6px 8px', alignItems:'center',
                    ...(botFilled[m.id] ? { borderLeft: `3px solid ${PANEL_EXPERTS.find(e=>e.id===botFilled[m.id])?.color || '#FFD700'}` } : {}),
                  }}>
                    {/* Bot-fill-merke */}
                    {botFilled[m.id] && (() => {
                      const ex = PANEL_EXPERTS.find(e => e.id === botFilled[m.id]);
                      return (
                        <span title={`Tipset av ${ex?.name || 'bot'}`} style={{
                          fontSize:9, color: ex?.color || '#FFD700', fontFamily:"'Fira Code',monospace",
                          background: `${ex?.color || '#FFD700'}18`, border: `1px solid ${ex?.color || '#FFD700'}44`,
                          borderRadius:4, padding:'1px 4px', flexShrink:0, whiteSpace:'nowrap',
                        }}>🤖 {ex?.firstName || 'Bot'}</span>
                      );
                    })()}
                    {/* Info box – hover to show match info */}
                    <div
                      onClick={e => { e.stopPropagation(); setMatchPopup(m); }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,215,0,.15)'; setMatchPopup(m); }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:48,background:'rgba(255,255,255,.05)',borderRadius:6,padding:'3px 5px',flexShrink:0,cursor:'pointer',transition:'background .15s',border:'1px solid transparent'}}>
                      <span style={{fontSize:9,color:'rgba(255,255,255,.5)',fontFamily:"'Fira Code',monospace",whiteSpace:'nowrap'}}>Kamp {m.matchNum}</span>
                      {m.date && <span style={{fontSize:9,color:'rgba(255,255,255,.7)',fontFamily:"'Inter',sans-serif",whiteSpace:'nowrap'}}>{fmtDate(m.date)}</span>}
                      {m.time && <span style={{fontSize:8,color:'rgba(255,255,255,.4)',fontFamily:"'Inter',sans-serif"}}>{m.time}</span>}
                    </div>
                    {/* Home */}
                    <TeamLabel slot={shortenSlot(m.home)} resolved={resolvedHome} tip={tipHome} align="right" />
                    {/* Score box */}
                    <div style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                      background:'rgba(255,255,255,.08)', borderRadius:8,
                      border: superbonus ? '1px solid #FFD700' : '1px solid rgba(255,255,255,.15)',
                      padding:'2px 8px', width:76, flexShrink:0,
                    }}>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <input style={{...C.sInp,width:32,fontSize:15,background:'transparent',border:'none',opacity:koOk?1:.4,color:hasAct?(rightHome?'#FFD700':'#e8edf8'):'#e8edf8',textAlign:'center',padding:0}} type="number" min={0} max={20} disabled={!koOk}
                          value={t.home??''} placeholder='–' onChange={e => setTip(m.id,'home',e.target.value)} />
                        <span style={{color:superbonus?'#FFD700':rightOutcome?'#FFD700':'rgba(255,255,255,.5)',fontWeight:800,fontSize:15,lineHeight:1}}>–</span>
                        <input style={{...C.sInp,width:32,fontSize:15,background:'transparent',border:'none',opacity:koOk?1:.4,color:hasAct?(rightAway?'#FFD700':'#e8edf8'):'#e8edf8',textAlign:'center',padding:0}} type="number" min={0} max={20} disabled={!koOk}
                          value={t.away??''} placeholder='–' onChange={e => setTip(m.id,'away',e.target.value)} />
                      </div>
                      {hasAct && <span style={{fontSize:9,color:'rgba(0,229,255,.75)',fontFamily:"'Fira Code',monospace",letterSpacing:1}}>{act.home}–{act.away}</span>}
                    </div>
                    {/* Away */}
                    <TeamLabel slot={shortenSlot(m.away)} resolved={resolvedAway} tip={tipAway} align="left" />
                    {/* Points */}
                    <div style={{width:20,flexShrink:0,textAlign:'right'}}>
                      {renderPtsBadge(pts)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>}

        {isOwn && <>
          <button style={{ ...C.btnDanger, width:'100%', marginTop:16 }} onClick={resetTips}>
            🗑️ Nullstill tips
          </button>
          {dirty && <p style={{ color:'#f59e0b', fontSize:11, textAlign:'center', marginTop:6, fontFamily:"'Fira Code',monospace" }}>⚠ Ulagrede endringer</p>}
        </>}
      </div>
    </div>

      {/* Flytende lagre-knapp */}
      {isOwn && (
        <div style={{ position:'fixed', bottom:20, left:0, right:0, zIndex:500, pointerEvents:'none', display:'flex', justifyContent:'center' }}>
          <div style={{ width:'100%', maxWidth:1200, display:'flex', justifyContent:'center', padding:'0 16px', boxSizing:'border-box' }}>
            <button
              style={{
                ...C.btnGold,
                pointerEvents:'all',
                padding:'10px 28px',
                fontSize:13,
                opacity: dirty ? 1 : 0.45,
                boxShadow:'0 4px 20px rgba(255,215,0,.3)',
                whiteSpace:'nowrap',
              }}
              onClick={save}
            >
              {saved ? '✅ Lagret!' : '💾 Lagre tips'}
            </button>
          </div>
        </div>
      )}

      {grpPopup && (
        <GroupOrderPopup group={grpPopup} grpO={grpO} setOrd={setOrd} results={results} grpOk={grpOk} onClose={() => setGrpPopup(null)} />
      )}
      {matchPopup && (
        <MatchInfoPopup match={matchPopup} onClose={() => setMatchPopup(null)} results={results} />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  DISCORD VIDEO-KNAPP
// ══════════════════════════════════════════════════════════════════════
const DISCORD_URL = 'https://discord.gg/4JpNQVWKD';

const DiscordIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z"/>
  </svg>
);

function VideoButton({ compact = false }) {
  return (
    <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" title="Bli med i Discord-videochat" style={{
      display: 'flex', alignItems: 'center', gap: compact ? 3 : 5,
      background: 'rgba(88,101,242,.2)', border: '1px solid rgba(88,101,242,.5)',
      color: '#8891f2', borderRadius: 6, padding: compact ? '0 5px' : '0 8px', height: 26,
      cursor: 'pointer', fontSize: compact ? 10 : 11,
      fontFamily: "'Inter',sans-serif", fontWeight: 600,
      textDecoration: 'none', flexShrink: 0,
    }}>
      <DiscordIcon size={13} />{!compact && ' Discord'}
    </a>
  );
}

function VideoChat({ me }) {
  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Videochat</span></div>
      <div style={C.cardBody}>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 16 }}>
          Videochat skjer via Discord. Klikk for å bli med i stemmekanalen – du kan ha Discord oppe ved siden av VM-tipping-appen.
        </p>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={{
          ...C.btnGold, width: '100%', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <DiscordIcon size={18} /> Åpne Discord-videochat
        </a>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════════════════════════════
function AdminPanel() {
  const [phase, setPhaseState] = useState('pre');
  const [results, setResultsState] = useState({});
  const [cards, setCardsState] = useState({});
  const [aTab, setATab] = useState('phase');
  const [ag, setAg] = useState('A');
  const [generatingBots, setGeneratingBots] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [summaries, setSummaries] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [showTopscorer, setShowTopscorer] = useState(false);

  useEffect(() => { getPhase().then(setPhaseState); }, []);
  useEffect(() => { getResults().then(setResultsState); }, []);
  useEffect(() => { getCardStats().then(setCardsState); }, []);
  useEffect(() => { getAdminMessage().then(setMsgInput); }, []);
  useEffect(() => { const u = subscribeMatchSummaries(setSummaries); return u; }, []);
  useEffect(() => { getAllUsers().then(us => setAllUsers(us.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_')))); }, []);

  const updPhase = async p => { setPhaseState(p); await setPhase(p); };
  const setResult = async (id, field, val) => { const upd = { ...results, [id]: { ...(results[id] || {}), [field]: parseInt(val) || 0 } }; setResultsState(upd); await setResults(upd); };
  const setGrpResult = async (g, i, val) => { const key = `grp_${g}`; const arr = results[key] ? [...results[key]] : ['', '', '', '']; arr[i] = val; const upd = { ...results, [key]: arr }; setResultsState(upd); await setResults(upd); };
  const setSpec = async (key, val) => { const upd = { ...results, [key]: val }; setResultsState(upd); await setResults(upd); };
  const updCard = async (team, type, val) => { const y = type === 'y' ? parseInt(val) || 0 : (cards[`_y_${team}`] || 0); const r = type === 'r' ? parseInt(val) || 0 : (cards[`_r_${team}`] || 0); const upd = { ...cards, [`_y_${team}`]: y, [`_r_${team}`]: r, [team]: y + r * 3 }; setCardsState(upd); await setCardStats(upd); };

  const resetAllResults = async () => {
    const confirmed = window.confirm(
      '⚠️ Er du sikker?\n\nDette nullstiller ALLE resultater:\n• Alle kampresultater (gruppe + sluttspill)\n• Grupperangeringer\n• Spesialtips-fasit\n• Kortstatistikk\n• Bot-kommentarer på Siste kamper\n\nHandlingen kan ikke angres.'
    );
    if (!confirmed) return;
    try {
      await setDoc(doc(db, 'config', 'results'), {});
      await setDoc(doc(db, 'config', 'cards'), {});
      setResultsState({});
      setCardsState({});
      // Slett alle bot-kommentarer (match summaries)
      const summarySnap = await getDocs(collection(db, 'summaries'));
      await Promise.all(summarySnap.docs.map(d => deleteDoc(doc(db, 'summaries', d.id))));
      alert('✅ Alle resultater og bot-kommentarer er nullstilt.');
    } catch(e) {
      alert('Feil ved nullstilling: ' + e.message);
    }
  };

  const generateAllBotTips = async (force=false) => {
    const topscorerMap = {
      ragnhild: 'Erik Solér',
      hendrik: 'Dennis Bergkamp',
      kimlevi: 'Jørn Hoel',
      bengt: 'Diego Armando Maradona',
      odd: 'Bjørn Wirkola',
    };
    setGeneratingBots(true);
    try {
      for (const expert of PANEL_EXPERTS) {
        const existingUser = await getUser('panel_' + expert.id);
        const existingTips = existingUser?.tips || {};
        const existingSpec = existingUser?.specialTips || {};
        const existingGrpO = existingUser?.groupOrders || {};
        const generated = await generateExpertTips(expert);
        const tips = generated.tips || generated;
        const groupOrders = generated.groupOrders || {};
        const newTips = {};
        Object.entries(tips).forEach(([k, v]) => {
          if (force || !existingTips[k]) newTips[k] = v;
        });
        const mergedTips = force ? newTips : { ...existingTips, ...newTips };
        const mergedGrpO = force ? groupOrders : { ...existingGrpO, ...groupOrders };
        if (Object.keys(mergedTips).length >= 0) {
          // Generate special tips too
          const teamList = ALL_TEAMS.join(', ');
          const specInstructions = {
            ragnhild: 'Velg basert på drakter og musikk. Brasil (gult) vinner, Nederland (oransje) er fin. Du vil gjerne velge Danmark eller Italia men de er ikke med - velg da Spania som er nesten like elegante. Mest kort: England (de er litt røffe).',
            hendrik: 'Nederland vinner ALT. Champion: Nederland. Runner_up: Nederland finnes ikke som nr 2 men hvis du må: Brasil. Third: Tyskland. Most_carded: England.',
            kimlevi: 'Velg HELT tilfeldig fra listen. Du aner ikke hvem som er bra.',
            bengt: 'Brasil vinner (Zico!), Argentina nummer to (Maradona!), Tyskland tredje (Beckenbauer!). Mest kort: Brasil selvfølgelig, de er aggressive.',
            odd: 'Brasil kan ikke vinne (de jukser). Canada vinner hjemmebane! Runner_up: USA (hjemmebane fordel). Third: Mexico. Mest kort: Brasil (bevis på juks).',
          };
          const specPrompt = 'Du er ' + expert.name + '. ' +
            (specInstructions[expert.id] || '') +
            '\n\nVelg fra DISSE lagene: ' + teamList +
            '\n\nSvar KUN med JSON: {"champion":"Brasil","runner_up":"Frankrike","third":"England","most_carded":"Argentina"}';
          let specialTips = {};
          try {
            const d = await cfPost('generateTips', { prompt: specPrompt, maxTokens: 200 });
            specialTips = JSON.parse((d.text || '{}').replace(/```json|```/g,'').trim());
          } catch(e) { console.warn('Special tips failed:', e); }
          specialTips.topscorer = topscorerMap[expert.id] || '';
          const mergedSpec = { ...specialTips, ...existingSpec };
          mergedSpec.topscorer = topscorerMap[expert.id] || '';
          await setDoc(doc(db, 'users', 'panel_' + expert.id), { tips: mergedTips, specialTips: mergedSpec, groupOrders: mergedGrpO, displayName: expert.name, password: 'bot' });
        }
      }
      alert('Bot-tips generert! ✅');
    } catch(e) { alert('Feil: ' + e.message); }
    setGeneratingBots(false);
  };

  const downloadBackup = async () => {
    try {
      const users = await getAllUsers();
      const results = await getResults();
      const cards = await getCardStats();
      const phase = await getPhase();
      const backup = {
        exportDate: new Date().toISOString(),
        phase,
        results,
        cards,
        users: users.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_')).map(u => ({
          username: u.id,
          displayName: u.displayName,
          tips: u.tips || {},
          groupOrders: u.groupOrders || {},
          specialTips: u.specialTips || {},
        })),
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vm-tipping-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert('Feil ved backup: ' + e.message);
    }
  };

  return (
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot} /> Admin</span>
        <button style={{ ...C.btnGold, width:'auto', padding:'7px 16px', fontSize:12 }} onClick={downloadBackup}>
          💾 Last ned backup
        </button>
        <button style={{ ...C.btnSecondary, padding:'7px 16px', fontSize:12 }} onClick={generateAllBotTips} disabled={generatingBots}>
          {generatingBots ? '⟳ Genererer...' : '🤖 Generer bot-tips'}
        </button>
        <button style={{ ...C.btnSecondary, padding:'7px 16px', fontSize:11, color:'#ff9966' }} onClick={() => generateAllBotTips(true)} disabled={generatingBots}>
          🔄 Tving regenerer
        </button>
        <button style={{ ...C.btnSecondary, padding:'7px 16px', fontSize:11, color:'#a78bfa' }} onClick={async () => {
          await autoFillMissingTips('group_lock');
          alert('Auto-fill kjørt!');
        }}>
          🤖 Kjør auto-fill
        </button>
        <button style={{ ...C.btnSecondary, padding:'7px 16px', fontSize:11, color:'#67e8f9' }} onClick={async () => {
          const username = prompt('Brukernavn (Firestore doc ID):');
          if (!username) return;
          const expertId = prompt('Expert ID (ragnhild/hendrik/kimlevi/bengt/odd):');
          if (!expertId) return;
          const botUser = await getUser('panel_' + expertId);
          if (!botUser?.groupOrders) { alert('Bot mangler groupOrders'); return; }
          const u = await getUser(username);
          if (!u) { alert('Fant ikke bruker'); return; }
          const expert = PANEL_EXPERTS.find(e => e.id === expertId);
          const filledBy = { ...(u.botFilledMatches || {}) };
          Object.keys(GROUPS).forEach(g => {
            if (!(u.groupOrders?.[g]?.filter(Boolean).length === 4)) {
              filledBy['grp_' + g] = expertId;
            }
          });
          await updateUser(username, {
            groupOrders: botUser.groupOrders,
            botFilledMatches: filledBy,
            assignedExpert: expertId,
          });
          alert('Gruppeplasseringer kopiert til ' + username + ' fra ' + (expert?.name || expertId));
        }}>
          📋 Kopier gruppeordre til bruker
        </button>
        <button style={C.btnDanger} onClick={resetAllResults}>
          🗑️ Nullstill resultater
        </button>
      </div>
      <div style={C.cardBody}>
        <div style={C.tabs}>
          {[['phase', 'Fase'], ['results', 'Gruppe'], ['knockout', 'Sluttspill'], ['special', 'Spesial'], ['cards', 'Kort'], ['msg', 'Melding'], ['matches', 'Kamper'], ['missing', '⚠️ Mangler'], ['live', '📡 Live']].map(([t, l]) => (
            <button key={t} style={{ ...C.tab, ...(aTab === t ? C.tabOn : {}) }} onClick={() => setATab(t)}>{l}</button>
          ))}
        </div>
        {aTab === 'phase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...C.mono12, marginBottom: 8 }}>Gjeldende: <strong style={{ color: YEL }}>{phase}</strong></span>
            {PHASE_OPTIONS.map(p => (
              <button key={p.value} onClick={() => updPhase(p.value)} style={{ ...C.phBtn, ...(phase === p.value ? C.phBtnOn : {}) }}>{p.label}</button>
            ))}
          </div>
        )}
        {aTab === 'results' && <>
          <div style={C.gTabs}>{Object.keys(GROUPS).map(g => <button key={g} style={{ ...C.gTab, ...(ag === g ? C.gTabOn : {}) }} onClick={() => setAg(g)}>Gr.{g}</button>)}</div>
          {GROUP_MATCHES.filter(m => m.group === ag).map(m => (
            <div key={m.id} style={C.mRow}>
              <span style={C.mTeam}><Flag team={m.home} /> {m.home}</span>
              <input style={C.sInp} type="number" min={0} value={results[m.id]?.home ?? ''} placeholder='–' onChange={e => setResult(m.id, 'home', e.target.value)} />
              <span style={C.dash}>–</span>
              <input style={C.sInp} type="number" min={0} value={results[m.id]?.away ?? ''} placeholder='–' onChange={e => setResult(m.id, 'away', e.target.value)} />
              <span style={{ ...C.mTeam, textAlign: 'right' }}>{m.away} <Flag team={m.away} /></span>
            </div>
          ))}
          <span style={{ ...C.secH, marginTop: 14 }}>Grupperangering</span>
          {[0, 1, 2, 3].map(pos => (
            <div key={pos} style={C.plRow}>
              <span style={C.plPos}>{pos + 1}.</span>
              <TeamSelect
                value={results[`grp_${ag}`]?.[pos] || ''}
                onChange={val => setGrpResult(ag, pos, val)}
                teams={GROUPS[ag]}
              />
            </div>
          ))}
        </>}
        {aTab === 'knockout' && (() => {
          // Track which teams are already used across all knockout matches
          const usedTeams = new Set();
          Object.entries(results).forEach(([id, r]) => {
            if (id.startsWith('r32_') || id.startsWith('r16_') || id.startsWith('qf_') || id.startsWith('sf_') || id === 'bronze' || id === 'final') {
              if (r.homeTeam) usedTeams.add(r.homeTeam + '_' + id);
              if (r.awayTeam) usedTeams.add(r.awayTeam + '_' + id);
            }
          });
          const setKOTeam = async (matchId, side, team) => {
            const cur = results[matchId] || {};
            await setResults({ ...results, [matchId]: { ...cur, [side === 'home' ? 'homeTeam' : 'awayTeam']: team } });
            setResultsState(r => ({ ...r, [matchId]: { ...cur, [side === 'home' ? 'homeTeam' : 'awayTeam']: team } }));
          };
          const setKOScore = (matchId, side, val) => {
            const cur = results[matchId] || {};
            setResultsState(r => ({ ...r, [matchId]: { ...cur, [side]: val === '' ? '' : parseInt(val) } }));
          };
          const saveKOScore = async (matchId) => {
            const cur = results[matchId] || {};
            await setResults({ ...results, [matchId]: cur });
          };
          return KNOCKOUT_ROUNDS.map(({ phase: kp, label }) => (
            <div key={kp} style={{ marginBottom: 16 }}>
              <span style={C.roundL}>{label}</span>
              {KNOCKOUT_MATCHES.filter(m => m.phase === kp).map(m => {
                const r = results[m.id] || {};
                const homeTeam = r.homeTeam || '';
                const awayTeam = r.awayTeam || '';
                // Teams used in OTHER matches (not this one)
                const takenHome = new Set(
                  KNOCKOUT_MATCHES.filter(x => x.id !== m.id).map(x => results[x.id]?.homeTeam).filter(Boolean)
                );
                const takenAway = new Set(
                  KNOCKOUT_MATCHES.filter(x => x.id !== m.id).map(x => results[x.id]?.awayTeam).filter(Boolean)
                );
                const taken = new Set([...takenHome, ...takenAway]);
                return (
                  <div key={m.id} style={{ ...C.mRow, gap:6, flexWrap:'wrap', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'rgba(255,215,0,.7)', fontFamily:"'Fira Code',monospace", minWidth:55 }}>Kamp {m.matchNum}</span>
                    <select style={{ ...C.sel, flex:1, minWidth:100 }} value={homeTeam}
                      onChange={e => setKOTeam(m.id, 'home', e.target.value)}>
                      <option value=''>– Hjemmelag –</option>
                      {ALL_TEAMS.filter(t => !taken.has(t) || t === homeTeam).map(t => (
                        <option key={t} value={t}>{FLAGS[t]||''} {t}</option>
                      ))}
                    </select>
                    <input style={{ ...C.sInp, width:40 }} type="number" min={0} value={r.home ?? ''} placeholder='–'
                      onChange={e => setKOScore(m.id, 'home', e.target.value)}
                      onBlur={() => saveKOScore(m.id)} />
                    <span style={C.dash}>–</span>
                    <input style={{ ...C.sInp, width:40 }} type="number" min={0} value={r.away ?? ''} placeholder='–'
                      onChange={e => setKOScore(m.id, 'away', e.target.value)}
                      onBlur={() => saveKOScore(m.id)} />
                    <select style={{ ...C.sel, flex:1, minWidth:100 }} value={awayTeam}
                      onChange={e => setKOTeam(m.id, 'away', e.target.value)}>
                      <option value=''>– Bortelag –</option>
                      {ALL_TEAMS.filter(t => !taken.has(t) || t === awayTeam).map(t => (
                        <option key={t} value={t}>{FLAGS[t]||''} {t}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          ));
        })()}
        {aTab === 'special' && (
          <div style={C.specBox}>
            {[{ key: 'champion', label: '🥇 Verdensmester' }, { key: 'runner_up', label: '🥈 Sølvvinner' },
              { key: 'third', label: '🥉 Bronsevinner' }, { key: 'most_carded', label: '🟨 Flest gule/røde kort' }].map(({ key, label }) => (
              <div key={key} style={C.specRow}>
                <span style={C.specLabel}>{label}</span>
                <select style={C.sel} value={results[key] || ''} onChange={e => setSpec(key, e.target.value)}>
                  <option value=''>– Ikke satt –</option>
                  {ALL_TEAMS.map(t => <option key={t} value={t}>{FLAGS[t]||''} {t}</option>)}
                </select>
                {results[key] && <Flag team={results[key]} />}
              </div>
            ))}
            {/* Toppscorer – text + popup */}
            <div style={C.specRow}>
              <span style={C.specLabel}>⚽ Toppscorer</span>
              <input style={{ ...C.inp, marginBottom:0, flex:1, fontSize:13, padding:'6px 10px' }}
                value={results['topscorer'] || ''}
                onChange={e => setSpec('topscorer', e.target.value)}
                placeholder="Skriv spillernavn…" />
              <button style={{ ...C.btnSecondary, padding:'6px 12px', fontSize:12, marginLeft:6 }}
                onClick={() => setShowTopscorer(true)}>
                Se tips
              </button>
            </div>
            {showTopscorer && createPortal(
              <>
                <div onClick={() => setShowTopscorer(false)} style={{ position:'fixed', inset:0, zIndex:899, background:'rgba(0,0,0,.6)', backdropFilter:'blur(3px)' }} />
                <div style={{
                  position:'fixed', bottom:28, left:12, zIndex:900, width:300,
                  background:'rgba(13,18,48,.97)', border:'2px solid rgba(255,215,0,.3)',
                  borderRadius:14, padding:20, boxShadow:'0 12px 40px rgba(0,0,0,.8)',
                  maxHeight:'70vh', overflowY:'auto',
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize:13, color:'rgba(255,215,0,.8)', fontFamily:"'Fira Code',monospace", marginBottom:14, textTransform:'uppercase', letterSpacing:1 }}>
                    Toppscorertips
                  </div>
                  {allUsers.length === 0 && <p style={{ color:'rgba(255,255,255,.4)', fontSize:13 }}>Ingen spillere.</p>}
                  {allUsers.map(u => {
                    const tip = u.specialTips?.topscorer || '';
                    const correct = results['topscorer'] && tip && tip.toLowerCase() === results['topscorer'].toLowerCase();
                    return (
                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                        <span style={{ flex:1, fontSize:13, color: correct ? '#4ade80' : '#e8edf8' }}>{u.displayName}</span>
                        <span style={{ fontSize:13, color: correct ? '#4ade80' : 'rgba(255,255,255,.5)', fontStyle: tip ? 'normal' : 'italic' }}>
                          {tip || '–'}
                        </span>
                        {correct && <span style={{ fontSize:14 }}>✅</span>}
                      </div>
                    );
                  })}
                </div>
              </>, document.body
            )}
          </div>
        )}
        {aTab === 'cards' && <>
          <span style={{ ...C.mono12, marginBottom: 10, display: 'block' }}>🟨 Gult = 1kp · 🟥 Rødt = 3kp</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
            {ALL_TEAMS.map(team => (
              <div key={team} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#0b0f1a', borderRadius: 6 }}>
                <Flag team={team} /><span style={{ flex: 1, fontSize: 13, color: '#e8eaf0' }}> {team}</span>
                <label style={{ color: '#fbbf24', fontSize: 10 }}>🟨</label>
                <input style={{ ...C.sInp, width: 40 }} type="number" min={0} value={cards[`_y_${team}`] || ''} placeholder='0' onChange={e => updCard(team, 'y', e.target.value)} />
                <label style={{ color: '#f87171', fontSize: 10 }}>🟥</label>
                <input style={{ ...C.sInp, width: 40 }} type="number" min={0} value={cards[`_r_${team}`] || ''} placeholder='0' onChange={e => updCard(team, 'r', e.target.value)} />
                <span style={{ color: YEL, fontSize: 11, minWidth: 36, textAlign: 'right', fontFamily: "'Fira Code',monospace" }}>{cards[team] || 0}kp</span>
              </div>
            ))}
          </div>
        </>}
        {aTab === 'msg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={C.secH}>Admin-melding i banneret</span>
            <textarea style={{ ...C.ta, fontSize: 14 }} rows={4}
              value={msgInput} onChange={e => setMsgInput(e.target.value)}
              placeholder="Skriv en melding til alle spillere… (la stå tom for å skjule)" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...C.btnGold, flex: 1 }} onClick={async () => { await setAdminMessage(msgInput); alert('✅ Melding lagret!'); }}>
                💾 Lagre melding
              </button>
              <button style={{ ...C.btnDanger, flex: 1 }} onClick={async () => { setMsgInput(''); await setAdminMessage(''); }}>
                🗑️ Slett melding
              </button>
            </div>
            <p style={C.mono12}>Meldingen vises som en scrollende ticker i banneret. Hvis meldingen er lang scroller den to ganger, deretter vises "Les melding fra admin" til spilleren trykker på den.</p>
          </div>
        )}
        {aTab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={C.secH}>Slett kamp fra "Siste kamper"</span>
            {GROUP_MATCHES.filter(m => results[m.id]?.home !== undefined).length === 0 && (
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Ingen spilte kamper ennå.</p>
            )}
            {GROUP_MATCHES.filter(m => results[m.id]?.home !== undefined).slice().reverse().map(m => {
              const r = results[m.id];
              const sum = summaries[m.id];
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 8 }}>
                  <Flag team={m.home} />
                  <span style={{ fontSize: 13, flex: 1 }}>{m.home} {r.home}–{r.away} {m.away}</span>
                  <Flag team={m.away} />
                  {sum && <span style={{ fontSize: 10, color: '#4ade80', fontFamily: "'Fira Code',monospace" }}>✍️+🤖</span>}
                  <button style={{ ...C.btnDanger, padding: '5px 10px', fontSize: 11 }} onClick={async () => {
                    if (!window.confirm(`Slette kommentarer for ${m.home}–${m.away}?`)) return;
                    await deleteMatchSummary(m.id);
                  }}>
                    🗑️ Slett
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {aTab === 'missing' && (() => {
          const phases = [
            { key: 'group',  label: 'Gruppespill',   matches: GROUP_MATCHES },
            { key: 'r32',    label: '16-delsfinaler', matches: KNOCKOUT_MATCHES.filter(m => m.phase === 'r32') },
            { key: 'r16',    label: '8-delsfinaler',  matches: KNOCKOUT_MATCHES.filter(m => m.phase === 'r16') },
            { key: 'qf',     label: 'Kvartfinaler',   matches: KNOCKOUT_MATCHES.filter(m => m.phase === 'qf') },
            { key: 'sf',     label: 'Semifinaler',    matches: KNOCKOUT_MATCHES.filter(m => m.phase === 'sf') },
            { key: 'final',  label: 'Finale + bronse',matches: KNOCKOUT_MATCHES.filter(m => m.phase === 'bronze' || m.phase === 'final') },
          ];
          const realUsers = allUsers.filter(u => !u.id.startsWith('panel_'));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={C.secH}>Manglende tips per fase</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: 0 }}>
                Viser spillere som mangler minst én kamp i fasen. Disse risikerer bot-fill når fristen går ut.
              </p>
              {phases.map(({ key, label, matches }) => {
                if (matches.length === 0) return null;
                const missing = realUsers.map(u => {
                  const missingMatches = matches.filter(m => {
                    const t = u.tips?.[m.id];
                    return t?.home === undefined || t?.away === undefined;
                  });
                  const missingGrp = key === 'group' ? Object.keys(
                    Object.fromEntries(
                      [...new Set(GROUP_MATCHES.map(m => m.group))].map(g => [g, (u.groupOrders?.[g] || []).filter(Boolean).length < 4])
                    )
                  ).filter(g => (u.groupOrders?.[g] || []).filter(Boolean).length < 4) : [];
                  return { u, missingMatches, missingGrp };
                }).filter(x => x.missingMatches.length > 0 || x.missingGrp.length > 0);

                const allOk = missing.length === 0;
                return (
                  <div key={key} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 14px', border: `1px solid ${allOk ? 'rgba(74,222,128,.2)' : 'rgba(255,100,100,.2)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: allOk ? 0 : 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: allOk ? '#4ade80' : '#fca5a5' }}>
                        {allOk ? '✅' : '⚠️'} {label}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                        {matches.length} kamper
                      </span>
                      {allOk && <span style={{ fontSize: 11, color: '#4ade80' }}>– alle har levert</span>}
                    </div>
                    {missing.map(({ u, missingMatches, missingGrp }) => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                        <span style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, minWidth: 110 }}>
                          {u.displayName || u.id}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>
                          {missingMatches.length > 0 && `${missingMatches.length} kamp${missingMatches.length > 1 ? 'er' : ''} mangler`}
                          {missingGrp.length > 0 && ` • Gruppeordre: ${missingGrp.join(', ')}`}
                          {u.botFilledMatches && Object.values(u.botFilledMatches).length > 0 &&
                            <span style={{ color: '#FFD700' }}> • Bot har fylt {Object.values(u.botFilledMatches).length} felt</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {aTab === 'live' && <LiveAdmin />}
      </div>
    </div>
  );
}

function LiveAdmin() {
  const [liveStatus, setLiveStatus] = useState('');
  const buildLookup = async () => {
    setLiveStatus('Bygger lookup...');
    try {
      const allMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];
      const res = await fetch(CF_V2('buildfixturelookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: allMatches.map(m => ({ id: m.id, home: m.home, away: m.away, date: m.date })) }),
      });
      const data = await res.json();
      if (data.ok) {
        setLiveStatus(`✅ Lookup bygget: ${data.matched} kamper matchet${data.unmatched > 0 ? `, ⚠️ ${data.unmatched} ikke matchet: ${(data.unmatchedList||[]).join(', ')}` : ''}`);
      } else {
        setLiveStatus('❌ Feil: ' + (data.error || 'Ukjent feil'));
      }
    } catch(e) { setLiveStatus('❌ Feil: ' + e.message); }
  };
  const manualPoll = async () => {
    setLiveStatus('Poller nå...');
    try {
      const res = await fetch(CF_V2('manualpoll'), { method: 'POST' });
      const data = await res.json();
      setLiveStatus(data.ok ? '✅ Poll OK – ' + new Date().toLocaleTimeString() : '❌ Feil: ' + data.error);
    } catch(e) { setLiveStatus('❌ Feil: ' + e.message); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:4 }}>
        pollFootball kjører automatisk hvert minutt under live-kamper. Bruk disse knappene ved behov.
      </div>
      <button onClick={buildLookup} style={{ background:'rgba(255,215,0,.12)', border:'1px solid rgba(255,215,0,.3)', color:'#FFD700', borderRadius:8, padding:'8px 14px', cursor:'pointer', textAlign:'left', fontSize:12 }}>
        🗺️ Bygg fixture-lookup (kjør én gang ved kampstart)
      </button>
      <button onClick={manualPoll} style={{ background:'rgba(74,222,128,.1)', border:'1px solid rgba(74,222,128,.3)', color:'#4ade80', borderRadius:8, padding:'8px 14px', cursor:'pointer', textAlign:'left', fontSize:12 }}>
        📡 Kjør manuell poll nå
      </button>
      <button onClick={async () => {
        const matchId = prompt('Kamp-ID (f.eks. B2, D1, A1):');
        if (!matchId) return;
        setLiveStatus('Genererer referat for ' + matchId + '...');
        try {
          const res = await fetch(CF_V2('triggersummary'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: matchId.trim().toUpperCase() }),
          });
          const data = await res.json();
          setLiveStatus(data.ok ? '✅ Referat postet for ' + (data.matchId||matchId) : '❌ ' + (data.error||'ukjent'));
        } catch(e) { setLiveStatus('❌ ' + e.message); }
      }} style={{ background:'rgba(147,51,234,.1)', border:'1px solid rgba(147,51,234,.3)', color:'#c084fc', borderRadius:8, padding:'8px 14px', cursor:'pointer', textAlign:'left', fontSize:12 }}>
        🤖 Generer tabellreferat for spesifikk kamp
      </button>
      <button onClick={async () => {
        setLiveStatus('Oppdaterer toppscorere...');
        try {
          const res = await fetch(CF_V2('refreshstatscache'), { method: 'POST' });
          const data = await res.json();
          setLiveStatus(data.ok ? '✅ Toppscorere oppdatert!' : '❌ ' + (data.error||'ukjent'));
        } catch(e) { setLiveStatus('❌ ' + e.message); }
      }} style={{ background:'rgba(251,146,60,.1)', border:'1px solid rgba(251,146,60,.3)', color:'#fb923c', borderRadius:8, padding:'8px 14px', cursor:'pointer', textAlign:'left', fontSize:12 }}>
        ⚽ Oppdater toppscorerliste manuelt
      </button>
      {liveStatus && <div style={{ fontSize:11, color:'#4ade80', fontFamily:"'Fira Code',monospace", marginTop:4 }}>{liveStatus}</div>}
    </div>
  );
}


// ── Info Page ────────────────────────────────────────────────────────
function InfoPage() {
  const nyRegel = <em style={{ color:'#FFD700', fontStyle:'italic', fontSize:11, marginLeft:8, textShadow:'0 0 8px rgba(255,215,0,0.7)', letterSpacing:1 }}>NY REGEL!</em>;
  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ background:'rgba(22,27,44,.75)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:28, marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:22, color:'#FFD700', textTransform:'uppercase', letterSpacing:2, marginBottom:20 }}>Om VM-tipping 2026</h2>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🏆 Poengsystem – Kamper</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>✅ Riktig utfall (H/U/B): <strong style={{color:'#FFD700'}}>2 poeng</strong></div>
          <div>⚽ Riktig antall mål hjemmelag: <strong style={{color:'#FFD700'}}>1 poeng</strong></div>
          <div>⚽ Riktig antall mål bortelag: <strong style={{color:'#FFD700'}}>1 poeng</strong></div>
          <div style={{marginTop:6}}>⚡ Fulltreffer (rett resultat): <strong style={{color:'#FFD700'}}>4 poeng totalt</strong></div>
          <div style={{marginTop:6}}>
            <strong style={{color:'#FFD700'}}>⚡ SUPERBONUS:</strong> <span style={{color:'rgba(255,255,255,.8)'}}>Tipp rett resultat i en kamp med 5 mål eller mer og du får <strong style={{color:'#FFD700'}}>5 poeng</strong> – ett ekstra for å tørre å tippe høyt!</span>
            {nyRegel}
          </div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>📋 Poengsystem – Grupper</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🎯 Riktig gruppeplassering: <strong style={{color:'#FFD700'}}>5 poeng per lag</strong></div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Maks per gruppe: 20 poeng (4 lag × 5p)</div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🌟 Spesialtips (låses før gruppespillet)</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🥇 Riktig verdensmester: <strong style={{color:'#FFD700'}}>30 poeng</strong></div>
          <div>🥈 Riktig sølvvinner: <strong style={{color:'#FFD700'}}>20 poeng</strong></div>
          <div>🥉 Riktig bronsevinner: <strong style={{color:'#FFD700'}}>10 poeng</strong></div>
          <div>⚽ Riktig toppscorer (spillernavn): <strong style={{color:'#FFD700'}}>20 poeng</strong></div>
          <div>🟨 Riktig lag med flest kort: <strong style={{color:'#FFD700'}}>10 poeng</strong>{nyRegel}</div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>⏰ Deadlines og innlevering</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.9, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div style={{marginBottom:10}}>Tippekonkurransen har automatiske deadlines basert på kampoppsettet. En grønn linje nederst på skjermen teller ned mot neste deadline.</div>

          <div style={{borderLeft:'3px solid #FFD700', paddingLeft:12, marginBottom:10}}>
            <div style={{color:'#FFD700', fontWeight:700, marginBottom:2}}>📋 Gruppespillet – deadline: 11. juni kl. 21:00</div>
            <div>Alle gruppespillkamper, gruppeplasseringer og spesialtips (VM-vinner, toppscorer osv.) må være levert <strong style={{color:'#FFD700'}}>10 minutter</strong> før første kamp sparkes i gang. Etter dette låses disse for alltid!</div>
          </div>

          <div style={{borderLeft:'3px solid #60a5fa', paddingLeft:12, marginBottom:10}}>
            <div style={{color:'#60a5fa', fontWeight:700, marginBottom:2}}>🏟️ Sluttspillsrundene – løpende deadlines</div>
            <div>Deadline for hver sluttspillsrunde er <strong style={{color:'#FFD700'}}>10 minutter</strong> før første kamp i den runden:</div>
            <div style={{marginTop:6, fontSize:13, color:'rgba(255,255,255,.65)'}}>
              <div>• 16-delsfinaler: 28. juni kl. 20:50</div>
              <div>• 8-delsfinaler: 4. juli kl. 16:50</div>
              <div>• Kvartfinaler: 9. juli kl. 19:50</div>
              <div>• Semifinaler: 14. juli kl. 18:50</div>
              <div>• Finaler (inkl. bronsefinale): 18. juli kl. 20:50</div>
            </div>
            <div style={{marginTop:6}}>Sluttspillstips for kommende runder kan fritt endres helt frem til sin deadline, men allerede spilte og pågående runder låses permanent.</div>
          </div>

          <div style={{borderLeft:'3px solid #f87171', paddingLeft:12, marginBottom:10}}>
            <div style={{color:'#f87171', fontWeight:700, marginBottom:2}}>🤖 Automatisk utfylling</div>
            <div>Har du ikke levert tips til en fase innen deadline, fyller en tilfeldig valgt "ekspert" fra <strong style={{color:'#FFD700'}}>Ekspertpanelet</strong> inn de manglende tipsene for deg. Den samme eksperten blir da din hjelper videre også, skulle du gå på samme tabben flere ganger 😛</div>
          </div>

        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🃏 Daglig Quiz {nyRegel}</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>Gjett VM-spilleren fra Panini-kortet! Ny spiller hver dag kl. 06:00.</div>
          <div style={{marginTop:4}}>🏆 Spilleren med flest rette svar ved slutten av finalen (19. juli 2026) tildeles <strong style={{color:'#FFD700'}}>0,5 ekstrapoeng</strong> i sammendraget.</div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Ved delt førsteplass i quizzen deles det halve poenget mellom vinnerne. VM-quiz starter 11. juni og avsluttes 19. juli.</div>
        </div>
      </div>

      <div style={{ background:'rgba(22,27,44,.75)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:28, marginBottom:16 }}>
        <h3 style={{ color:'#FFD700', fontSize:15, marginBottom:16, textTransform:'uppercase', letterSpacing:1 }}>🍬 Premier</h3>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <img src="/godteri.png" alt="Godteri" style={{ width:'100%', maxWidth:400, borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,.4)' }} />
          <div style={{ color:'rgba(255,255,255,.8)', fontSize:14, lineHeight:1.8, textAlign:'center' }}>
            Som vanlig er premien en svær bolle med godteri! 🎉
          </div>
          <div style={{ width:'100%', background:'rgba(0,0,0,.2)', borderRadius:10, padding:14 }}>
            <div style={{ fontSize:13, color:'#FFD700', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Godteribollefordelingsnøkkel</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', lineHeight:1.6, marginBottom:12 }}>
              Ved delt førsteplass samles premie for første- og andreplass og deles likt mellom vinnerne. Det samme for delt andreplass, da får man 30+20%=25% hver. Ved delt tredjeplass deles tredjepremien likt mellom spillerne.
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', marginBottom:6, background:'rgba(255,215,0,.08)', borderRadius:8, border:'1px solid rgba(255,215,0,.2)' }}>
              <span style={{ fontSize:22 }}>🥇</span>
              <span style={{ color:'#FFD700', fontWeight:700, fontSize:15, flex:1 }}>1. plass</span>
              <span style={{ color:'#FFD700', fontWeight:800, fontSize:18 }}>50%</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', marginBottom:6, background:'rgba(255,255,255,.04)', borderRadius:8, border:'1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontSize:22 }}>🥈</span>
              <span style={{ color:'rgba(255,255,255,.8)', fontWeight:700, fontSize:15, flex:1 }}>2. plass</span>
              <span style={{ color:'rgba(255,255,255,.8)', fontWeight:800, fontSize:18 }}>30%</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'rgba(255,255,255,.04)', borderRadius:8, border:'1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontSize:22 }}>🥉</span>
              <span style={{ color:'rgba(255,255,255,.8)', fontWeight:700, fontSize:15, flex:1 }}>3. plass</span>
              <span style={{ color:'rgba(255,255,255,.8)', fontWeight:800, fontSize:18 }}>20%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background:'rgba(22,27,44,.75)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:28 }}>
        <h3 style={{ color:'#fff', fontSize:15, marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>📅 VM 2026 – Nøkkeldatoer</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { date:'11. juni 2026', event:'Første gruppespillkamp' },
            { date:'25. juni 2026', event:'Siste gruppespillkamp' },
            { date:'28. juni – 1. juli', event:'Sekstendelsfinalene' },
            { date:'4–6. juli 2026', event:'Åttendedelsfinalene' },
            { date:'9–10. juli 2026', event:'Kvartfinalene' },
            { date:'14–15. juli 2026', event:'Semifinalene' },
            { date:'18. juli 2026', event:'Bronsefinale' },
            { date:'19. juli 2026', event:'Finale' },
          ].map(({date,event})=>(
            <div key={date} style={{display:'flex',gap:12,padding:'8px 12px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.05)'}}>
              <span style={{color:'#FFD700',fontFamily:"'Fira Code',monospace",fontSize:12,minWidth:160,flexShrink:0}}>{date}</span>
              <span style={{color:'rgba(255,255,255,.8)',fontSize:14}}>{event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Music Player ─────────────────────────────────────────────────────

// ── Info Page ────────────────────────────────────────────────────────


// ── YouTube Player ────────────────────────────────────────────────────
function YouTubePlayer() {
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(true);
  const [iframeMounted, setIframeMounted] = useState(false);
  const playerDivRef = useRef(null);
  const playerRef = useRef(null);

  const PLAYLIST_ID = 'PLZ-7xLISie3crAStc-KmPn4Oausod43CV';
  const YT_IDS = ['L20NUEcjsZs','1FeEa2Ew2yo','eG9z0R9oDe4','dHuLtbLhnJQ','GqRbaybv3tA','qiSqdBU2vio','T8T1a45HX4o','xm7et8ecVjM','wU26xVT_vBU','V15BYnSr0P8','D3jKArZm0wg','JkDCVLompxQ','D_QLxj8jCF0','EcBntqpUpg0','JEPmnB-Wewk','qWcOxPfzRPs','VPGJwRCXb7U','LdZK5zkH_4s','cc4og_BpscM','RtJqHUsedYY','bFOAZD6P4QE','A6fGu5Zsr48','Og8giwn8pfg','pcbGxT7nG60','Qm9KCQd3mg4','9lyNR0UMVic','vwT1Xb4vMpQ','VJ13O6qHIEI','-YL6dR120lU','mFkfKSPHIfw','45et6rqenvA','BCxiZAs497A','lFQdcPTTzSg','228FtMaq8uY','fcnDmrtj6Sk','vrY1THC_NQE','HLDak8dEyZw','zbjBKLTTxK4','TVKcgzCM9Z0','5FvRS8Q7DGY','GNzA7g0s2-k'];
  const [startIndex] = useState(() => Math.floor(Math.random() * YT_IDS.length));

  const expand = () => { setMinimized(false); setIframeMounted(true); };

  // Last inn YouTube IFrame API og initialiser player når div er klar
  useEffect(() => {
    if (!iframeMounted || !playerDivRef.current) return;

    const initPlayer = () => {
      // eslint-disable-next-line no-undef
      playerRef.current = new YT.Player(playerDivRef.current, {
        width: '240',
        height: '135',
        videoId: YT_IDS[startIndex],
        playerVars: {
          list: PLAYLIST_ID,
          listType: 'playlist',
          index: startIndex,
          autoplay: 0,
          rel: 0,
          loop: 1,
        },
        events: {
          onReady: (e) => {
            // Sett riktig startindeks eksplisitt via API etter at spilleren er klar
            e.target.playVideoAt(startIndex);
            e.target.stopVideo();
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Last inn API-scriptet hvis det ikke er der ennå
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [iframeMounted]); // eslint-disable-line

  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, zIndex: 500,
      background: 'rgba(1,23,76,.95)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,215,0,.25)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      overflow: 'hidden',
      width: minimized ? 100 : 240,
      transition: 'width .3s ease',
    }}>
      {minimized ? (
        /* Minimert: bare noteikon-knapp */
        <button onClick={expand} title="VM-musikk" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          height: 40, padding: '0 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#FFD700',
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 1,
          whiteSpace: 'nowrap',
        }}>VM-musikk ▲</button>
      ) : (
        /* Utvidet: header med tekst + knapper */
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(255,215,0,.08)',
            borderBottom: '1px solid rgba(255,215,0,.15)',
          }}>
            <span style={{ fontSize: 12, color: '#FFD700', fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: 1 }}>
              🎵 VM-musikk
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setMinimized(true)} style={{
                background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
                borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>▼</button>
              <button onClick={() => setVisible(false)} style={{
                background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
                borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
          </div>
          {/* YouTube IFrame API monterer spilleren i denne div-en */}
          <div ref={playerDivRef} style={{ width: 240, height: 135 }} />
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
//  PANELET
// ══════════════════════════════════════════════════════════════════════

const PANEL_EXPERTS = [
  {
    id: 'ragnhild',
    name: 'Ragnhild Kristiansen',
    firstName: 'Ragnhild',
    age: 60,
    from: 'Mandal',
    emoji: '👵',
    img: '/ragnhild.jpg',
    color: '#c2855a',
    tagline: 'Gladkristen med sans for det estetiske',
    bio: 'Vokste opp i et strengt kristenkonservativt hjem i Mandal på 70-tallet, men brøt ut og meldte seg inn i rødstrømpebevegelsen i 1978 – noe som skapte bråk i søndagsskolen. Har siden forsont seg med bakgrunnen sin, og er i dag aktiv i både menigheten og i den lokale husflidsforeningen. Gift tre ganger med samme mann. Hagen hennes er kåret til årets vakreste i Vest-Agder to ganger på rad, som ga henne en plass som Side-3-pike i Vårt Land. Har aldri sett en hel fotballkamp, men husker at hun syntes italienernes drakter var veldig flotte under VM i 1982. Tipper basert på estetikk, musikk og om landet generelt virker "skikkelig".',
    personality: `Du er Ragnhild Kristiansen, 60 år, fra Mandal. Du er en tidligere rødstrømpe oppvokst i et kristenkonservativt sørlandsmiljø på 70-tallet. Du har ingen peiling på fotball og tipper basert på hvilke land du liker – særlig drakter, musikk og om landet virker skikkelig og ordentlig. Du snakker varmt, litt moraliserende, og er alltid hyggelig men naiv om fotball. Du refererer gjerne til Fædrelandsvennen, kirken og sørlanske verdier. Svar alltid på norsk og hold deg i karakter. Svar kort, maks 3-4 setninger. Du bruker mange emojis, spesielt smilefjes, beende-hender-emoji og klemme-emoji. Du har sett Kim-Levi bruke aubergine-emoji sammen med fersken-emoji og skjønner ikke hva det skal bety. Dette nevner du hvis noen kommenterer bruken din av emojis.`,
    tipStyle: 'conservative_aesthetic',
  },
  {
    id: 'hendrik',
    name: 'Hendrik van der Berg',
    firstName: 'Hendrik',
    age: 58,
    from: 'Eindhoven → Drammen',
    emoji: '🇳🇱',
    img: '/hendrik.jpg',
    color: '#e67e00',
    tagline: 'Nederlandsk innvandrer med agorafobi og snever musikksans',
    bio: 'Kom til Norge i 1993 etter å ha truffet en norsk dame på et DJ Bobo-konsert i Amsterdam. Forholdet tok slutt etter tre måneder, men Hendrik ble værende. Jobbet i mange år i et lager i Drammen, men har siden 2014 ikke vært utenfor leiligheten sin. Diagnostisert med kraftig agorafobi, men trives egentlig veldig godt hjemme. Har en imponerende samling av DJ Bobo-memorabilia. Kjenner til navnnet Dennis Bergkamp og er stolt av ham, men er overbevist om at skøyteløperen Rintje Ritsma også hadde en karriere i Ajax på 90-tallet. Leier filmer digitalt og handler mat via Kolonial.no. Tror på astrologi, og tipper ut i fra dette.',
    personality: `Du er Hendrik van der Berg, 58 år, nederlandsk innvandrer som kom til Norge i 1993 og nå bor i Drammen. Du har kraftig agorafobi og har ikke vært utenfor leiligheten på mange år. Du hører mye på DJ Bobo og synes han er genial. Du kjenner til Dennis Bergkamp og er stolt av ham. Du tror også at Rintje Ritsma spilte fotball i Ajax på siden av skøytekarrieren. Du blander inn nederlandske ord av og til (for eksempel hoi, ja, goed, lekker). Du tipper ut i fra astrologi, det vil si hvilke land og spillere som har navn som ligner mest på astrologiske navn og uttrykk. Svar kort, maks 3-4 setninger på norsk med litt nederlandsk aksent og med vanlige skrivefeil.`,
    tipStyle: 'mixed_free',
  },
  {
    id: 'kimlevi',
    name: 'Kim-Levi Ditlefsen',
    firstName: 'Kim-Levi',
    age: 47,
    from: 'Henningsvær',
    emoji: '🎣',
    img: '/kim-levi.jpg?v=2',
    color: '#2a7aaa',
    tagline: 'Fisker, Pokemon-samler, fotballekspert siden 1998',
    bio: 'Fisker fra Henningsvær i Lofoten. Bor fremdeles hjemme hos mora si, noe han ikke synes er noe problem overhodet. Er stygg i kjeften når han er på sjøen, men egentlig snill som en labb. Eneste fotballminne er en Tromsø IL-kamp i 1998, men husker ikke hvem de spilte mot eller hva resultatet ble – bare at han frøs. Samler på Pokémon-kort og har en Charizard 1. utgave som han mener er verdt minst 40.000 kr. Har nylig begynt å se på VM-Tipping som en mulighet til å "tjene litt kroner på bortimot ingenting". Tipper på magefølelse og Pokémon-logikk.',
    personality: `Du er Kim-Levi Ditlefsen, 47 år, fisker fra Henningsvær i Lofoten som bor hjemme hos mora. Du er stygg i kjeften og bruker kraftuttrykk, men er egentlig grei nok. Du har null peiling på fotball – eneste minne er en Tromsø-kamp i 1998 du ikke husker noe fra. Du er veldig opptatt av Pokémon-kort og fisking. Du tipper på magefølelse og ut i fra hvilke lag og spillere som har navn som høres mest ut som noe fra pokemon. Svar på norsk med lofotdialekt-farget språk, vær gjerne litt grov men ikke sjikanerende. Maks 3-4 setninger.`,
    tipStyle: 'random_gut',
  },
  {
    id: 'bengt',
    name: 'Bengt Sandvik',
    firstName: 'Bengt',
    age: 52,
    from: 'Trondheim',
    emoji: '🤼',
    img: '/bengt.jpg',
    color: '#7a4aaa',
    tagline: 'Wrestlingfan. Kan fotball fra 80-tallet utenat.',
    bio: 'Trives best på Narvesen med en Kvikk Lunsj og klistremerkeboka si fra Mexico-VM i håp om å treffe noen som har 66 Hristo Kolev eller 337 Chris Waddle. Er veldig glad i kortspill, tennis og wrestling – særlig Hulk Hogan og André the Giant. Kan fotball fra 80-tallet utenat: Maradona, Platini, Zico, Socrates – spør ham om hva som helst fra denne perioden, for etter 1992 er det blankt. Er overbevist om at VAR betyr Veldig Artig Reprise og at dommeren løper bort til skjermen fordi han ikke fikk med seg målet første gangen. Han er lett tilbakstående, men avtjente likevel verneplikten sin i militæret - som kokkeassistent. Veldig snill og entusiastisk, og vil gjerne hjelpe til med alt. Spiste vafler med brunost i tre år på rad til frokost, og hevder dette er verdensrekord uten å ha sjekket med Guinness. Tipper som om det fremdeles er 80-tallet.',
    personality: `Du er Bengt Sandvik, 52 år fra Trondheim. Du liker wrestling, kortspill og tennis. Du kan fotball fra 80-tallet utenat – Maradona, Platini, Zico – men vet ingenting om fotball etter 1992. Du er blid og entusiastisk. Du tror fremdeles ting er som på 80-tallet.

VIKTIG: Du skriver ALLTID på bokmål, men har litt dysleksi. Dette betyr at du konsekvent gjør disse typiske dysleksifeilene:

- Hopper over bokstaver: "interessant" blir "intresant", "gratulerer" blir "gratlerer"
- Du bruker "å" der det skal være "og" og motsatt
- Aldri alle feilene på en gang – ca. 3-5 feil per svar, spredt naturlig utover

TEGNSETTING – dette er absolutt og ufravikelig:
- Du bruker KUN komma gjennom hele meldingen, aldri punktum, aldri spørsmålstegn, aldri tankestrek, aldri noe annet
- Hele meldingen er én lang setning med komma mellom leddene
- Meldingen avsluttes ALLTID med akkurat ett utropstegn, og bare ett
- Eksempel: "ja det var en bra kamp, Argentina spilte veldig bra, spesielt Maradona, han var jo suveren på 80-tallet også, så det overraker meg itj!"
Svar maks 3-4 komma-adskilte ledd.`,
    tipStyle: 'retro_80s',
  },
  {
    id: 'odd',
    name: 'Odd Snerten',
    firstName: 'Odd',
    age: 63,
    from: 'Oppdal',
    emoji: '🚜',
    img: '/odd.jpg',
    color: '#4a7a2a',
    tagline: 'Bonde. Mistenker Brasil for juks.',
    bio: 'Bonde fra Oppdal i tredje generasjon. Har aldri vært sør for Lillehammer frivillig, og ser ikke noen grunn til å begynne. Spiser leverpostei til alle måltider – frokost, lunsj og middag – og mener det er alt en mann trenger. Sier "nei, nei, nei" tre ganger før han sier noe som helst, og er generelt skeptisk til det meste som kommer sørfra. Tipper fotball basert på om landet har god landbrukspolitikk og om de har snø om vinteren. Er dypt overbevist om at Brasil jukser på en eller annen måte, og at det er samme dommer som dømmer hver kamp, en engelskmann ved navn Reffrey. Har aldri sett en fotballkamp, men hørte et referat på NRK radio en gang i 1987.',
    personality: `Du er Odd Snerten, 63 år, bonde fra Oppdal. Du har aldri vært sør for Lillehammer frivillig. Du spiser leverpostei til alle måltider. Du starter gjerne med "nei, nei, nei" og er skeptisk til det meste. Du tipper basert på om landet har god landbrukspolitikk og snø om vinteren. Du er overbevist om at Brasil jukser og at en engelskmann ved navn Reffrey dømmer hver eneste kamp.

VIKTIG – du snakker ALLTID i autentisk trønderdialekt fra Oppdal. Bruk disse trekkene konsekvent:
- "e" for "jeg", "itj" for "ikke", "hainn" for "han", "ho" for "hun", "dømm" for "dem/de"
- "vårrå" for "være", "sei" for "si/sier", "kåmmå" for "komme", "hoill" for "holde"
- "tå" for "av", "te'" for "til", "omkreng" for "omkring", "ivæg" for "i vei/avgårde"
- "kess" for "hvordan/der han", "aillfall" for "i alle fall", "ferresten" for "forresten" brukes mye
- "ska'" for "skal", "ha'" for "har", "va'" for "var", "veit" for "vet"
- Setninger som: "Nei, nei, nei, det e' itj sånn det fungere'", "Æ ska' sei dæ", "Det vet e'itj"
- Kortform av ord: "da'n" for "dagen", "mårrån" for "morningen", "mæsta" for "nesten"
Svar maks 3-4 setninger.`,
    tipStyle: 'agriculture_snow',
  },
];;

// Firebase helpers for panel
async function getPanelChoices() {
  const snap = await getDoc(doc(db, 'config', 'panelChoices'));
  return snap.exists() ? snap.data() : {};
}
async function setPanelChoice(username, expertId) {
  const snap = await getDoc(doc(db, 'config', 'panelChoices'));
  const data = snap.exists() ? snap.data() : {};
  data[username] = expertId;
  await setDoc(doc(db, 'config', 'panelChoices'), data);
}

// Generate tips via Claude API for a panel expert
async function generateExpertTips(expert) {
  const matchLines = GROUP_MATCHES.map(m => m.id + ': ' + m.home + ' vs ' + m.away).join('\n');
  const groupLines = Object.entries(GROUPS).map(([g, teams]) =>
    `Gruppe ${g}: ${teams.join(', ')}`
  ).join('\n');

  const styleInstructions = {
    ragnhild: `VIKTIG: Du MÅ tippe basert UTELUKKENDE på drakter og musikk, IKKE fotballkunnskap.
- Brasil har vakre gule drakter og samba → tipper Brasil vinner alltid
- Nederland har flott oransje → tipper Nederland vinner
- Italia er elegant blå (selv om de ikke er med) → du er skuffet
- Land du liker estetisk: Brasil, Nederland, Spania, Frankrike, Argentina, Mexico
- Land du er skeptisk til: USA (for mye reklame), England (grå drakter), Korea (ukjent musikk)
- Du tipper ALLTID høyere score for vakre lag. F.eks Brasil 3-0, Nederland 2-0.
- Kamper mellom to "stygge" lag ender 0-0 etter din mening
- Grupperangeringer: ranger lag basert på samme estetiske logikk`,

    hendrik: `VIKTIG: Du tipper Nederland til å vinne ALT. Nederland er uslåelige i dine øyne.
- Nederland vinner alle kamper, minst 2-0
- Land du kjenner fra TV: Brasil ok, Tyskland ok, Frankrike ok
- Du tror fremdeles Rintje Ritsma er på laget til Nederland
- Kamper uten nederlandske lag: tipp tilfeldig men helst lav score
- DJ Bobo er fra Sveits → tipper Sveits litt høyere enn normalt
- Grupperangeringer: Nederland øverst i sin gruppe, resten tilfeldig`,

    kimlevi: `VIKTIG: Du aner INGENTING om fotball. Tipp HELT TILFELDIG og kaotisk.
- Ingen logikk whatsoever. Høye tall er like sannsynlig som lave.
- Du kan tippe 5-4, 0-7, 3-3 - helt tilfeldig
- Tromsø er ikke med i VM så du er ikke engasjert
- Noen ganger tipper du 0-0 på alt fordi du ikke gidder
- Maks variasjon: noen kamper 4-3, andre 0-0, noen 1-5
- Grupperangeringer: tilfeldig rekkefølge, ikke tenk`,

    bengt: `VIKTIG: Din fotballkunnskap er fra 80-tallet og du tror verden er slik fremdeles.
- Brasil er alltid best (Zico, Socrates, Falcao) → Brasil vinner ALT
- Argentina er farlige (Maradona) → Argentina vinner mye
- Vest-Tyskland/Tyskland er alltid solide → Germany vinner
- Du har aldri hørt om Sør-Korea, Marokko, Senegal → tipp 0-2 mot disse
- Kamper med "moderne" lag du ikke kjenner → hjemmelag taper alltid
- Grupperangeringer: Brasil og Argentina øverst alltid, ukjente lag sist`,

    odd: `VIKTIG: Brasil JUKSER alltid, og land uten snø er ikke til å stole på.
- Brasil taper ALLE kamper (de jukser, men det hjelper dem ikke mot deg)
- Land med snø vinner: Norge, Sverige, Canada, Island (ikke med men likevel)
- Canada hjemmebane → Canada vinner alltid
- Mexico er mistenkt for juks (det er varmt der)
- Kamper mellom to "sørlige" land: begge taper (0-0 eller 1-1)
- Frankrike er litt ok fordi de har bønder i Normandie
- Grupperangeringer: snøland øverst, varmland sist`,
  };

  const prompt = `Du er ${expert.name}. ${expert.personality}

${styleInstructions[expert.id] || ''}

Det er 2026 og VM i fotball spilles i USA, Mexico og Canada.

Tipp disse kampene:
${matchLines}

Tipp også grupperangeringer for disse gruppene (alle 4 lag per gruppe i rekkefølge 1-4):
${groupLines}

Svar KUN med JSON (ingen annen tekst, ingen forklaring):
{"tips": {"A1": {"home": 2, "away": 1}, ...}, "groupOrders": {"A": ["lag1","lag2","lag3","lag4"], "B": [...], ...}}`;

  const data = await cfPost('generateTips', { prompt, maxTokens: 4000 });
  console.log('CF response for tips:', JSON.stringify(data).slice(0, 500));
  const text = data.text || '{}';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    console.log('Parsed tips keys:', Object.keys(parsed.tips || {}).length, 'groups:', Object.keys(parsed.groupOrders || {}).length);
    return { tips: parsed.tips || {}, groupOrders: parsed.groupOrders || {} };
  } catch(e) {
    console.error('Parse error:', e, 'Text was:', text.slice(0, 200));
    return { tips: {}, groupOrders: {} };
  }
}

// Store per-expert chat history in memory
// expertChatHistory removed – stateless calls only (cost reduction)

const PANEL_GROUP_CONTEXT = `
Du er en av fem deltakere i et VM-tippekompani som har holdt på siden 2018. De andre deltakerne er:

1. Ragnhild Kristiansen (60, Mandal) – tidligere rødstrømpe, nå aktiv i menigheten. Tipper på drakter og musikk.
2. Hendrik van der Berg (58, Drammen) – nederlandsk innvandrer med agorafobi. DJ Bobo-fan.
3. Kim-Levi Ditlefsen (47, Henningsvær) – fisker, bor hjemme hos mor. Samler Pokémon-kort.
4. Bengt Sandvik (52, Trondheim) – wrestling-fan. Kan fotball fra 80-tallet utenat.
5. Odd Snerten (63, Oppdal) – bonde i tredje generasjon. Mistenker Brasil for juks.

Du kan nevne de andre ved fornavn og si hva du TROR de mener – men du skriver ALDRI for dem og later ALDRI som du er dem.
`;

const CHAT_SYSTEM_SUFFIX = `

ABSOLUTTE REGLER – BRYT ALDRI DISSE:
1. Det er 2026. VM i fotball spilles i USA, Mexico og Canada (juni–juli 2026).
2. Skriv ALDRI med **bold** eller *kursiv* markdown-formatering. Skriv vanlig tekst.
3. Du er KUN deg selv. Du skriver ALDRI for andre personer. ALDRI "Ragnhild: ...", "Odd: ...", "Kim-Levi: ..." osv.
4. ALDRI bruk "---" eller andre skillelinjer for å separere "ulike personers" svar. Det finnes bare ett svar: ditt.
5. Du er én person som svarer én gang. Ikke skriv mer enn 3-4 setninger.
6. Hvis du er fristet til å skrive hva en annen person sier: bare hopp over det og si din egen mening i stedet.
`;

// Bygger en tekstlig oversikt over konkurransen som sendes til boten
function buildCompetitionContext(users, results, liveEvent) {
  let ctx = '';

  // Live-kamp
  if (liveEvent) {
    if (liveEvent.type === 'goal') {
      const { shortHome, shortAway, homeGoals, awayGoals, playerName, minute } = liveEvent;
      ctx += `\n\nLIVE KAMP PÅ GANG NÅ: ${shortHome} ${homeGoals}-${awayGoals} ${shortAway}. Siste mål: ${playerName} '${minute}. Svar basert på dette hvis noen spør om kampen eller stillingen.`;
    } else if (liveEvent.text) {
      ctx += `\n\nLIVE KAMP PÅ GANG NÅ: ${liveEvent.text}. Svar basert på dette hvis noen spør om kampen.`;
    }
  }

  if (!users || users.length === 0) return ctx;

  // Stillingstabell
  const realUsers = users.filter(u => !u.id.startsWith('panel_') && u.id !== 'admin');
  const sorted = [...realUsers]
    .map(u => ({ ...u, ...calcScore(u, results) }))
    .sort((a, b) => b.total - a.total || b.fulltreff - a.fulltreff);
  const lines = sorted.map((u, i) =>
    `${i + 1}. ${u.displayName}: ${u.total}p (${u.fulltreff} fulltreff)`
  ).join('\n');
  ctx += `\n\nAKTUELL STILLINGSTABELL I TIPPEKONKURRANSEN:\n${lines}`;

  // Pågående og kommende kamper med tips
  const now = Date.now();
  const allMatches = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES];

  const FINISHED = new Set(['FT','AET','PEN','AWD','WO']);
  const liveMatches = allMatches.filter(m => {
    const ms = new Date(m.date + 'T' + (m.time || '00:00') + ':00+02:00').getTime();
    if (ms > now || now - ms > 3 * 60 * 60 * 1000) return false;
    const r = results[m.id];
    if (!r) return true; // ikke startet ennå men innenfor vindu
    return !FINISHED.has(r.status); // ikke ferdig
  });

  const upcomingMatches = allMatches
    .filter(m => {
      const ms = new Date(m.date + 'T' + (m.time || '00:00') + ':00+02:00').getTime();
      return ms > now && !results[m.id];
    })
    .sort((a, b) => {
      const msA = new Date(a.date + 'T' + (a.time || '00:00') + ':00+02:00').getTime();
      const msB = new Date(b.date + 'T' + (b.time || '00:00') + ':00+02:00').getTime();
      return msA - msB;
    })
    .slice(0, 3);

  const fmtMatchWithTips = (m, label) => {
    const tipLines = realUsers
      .filter(u => u.tips?.[m.id]?.home !== undefined)
      .map(u => `  ${u.displayName}: ${u.tips[m.id].home}-${u.tips[m.id].away}`)
      .join('\n');
    return `${label}: ${m.home} vs ${m.away} (${m.date} kl. ${m.time || '?'})\nTips:\n${tipLines || '  (ingen tips)'}`;
  };

  if (liveMatches.length > 0) {
    ctx += `\n\nKAMP SOM SPILLES NÅ (ikke ferdigspilt ennå):`;
    liveMatches.forEach(m => {
      ctx += `\n${fmtMatchWithTips(m, '🔴 LIVE')}`;
    });
  } else {
    ctx += `\n\nDet er ingen kamp som spilles akkurat nå.`;
  }

  if (upcomingMatches.length > 0) {
    ctx += `\n\nNESTE KAMPER (ikke påbegynt ennå):`;
    upcomingMatches.forEach((m, i) => {
      ctx += `\n${fmtMatchWithTips(m, i === 0 ? 'Neste kamp' : `Kamp ${i + 1}`)}`;
    });
  }

  // Spesialtips-sammendrag
  ctx += `\n\nBruk tabellen og tipsene aktivt når noen spør om hvem som leder, hvem som har tippet hva, hvem som har 0-0 på en kamp, osv.`;
  return ctx;
}

async function chatWithExpert(expert, message, history, competitionContext = '') {
  const fallbacks = {
    ragnhild: ['Å, så hyggelig at du spør! Jeg tipper på land med fine drakter og god musikk, det gjør jeg.', 'Ja, jeg synes Italia har de fineste draktene. Og de er jo katolikker, det er noe.', 'Nei, fotball er ikke min greie egentlig, men jeg prøver så godt jeg kan!'],
    hendrik: ['Hoi! Dennis Bergkamp var jo fantastisk, ikke sant? Rintje Ritsma spilte jo også litt, tror jeg.', 'Ja, ja, ik ben hier. Jeg hører på DJ Bobo og tenker på fotball. Goed, goed.', 'Nederlandsk fotball er jo det beste. Eller, hva vet jeg egentlig? Jeg har ikke vært ute på lenge.'],
    kimlevi: ['Kem faen vet, æ har jo bare sett én kamp. Charizard er uansett verdt mer enn dette.', 'Jævla spørsmål! Men æ tipper på magefølelsen, den er sjeldent feil på sjøen.', 'Mor sier jeg burde bry meg mer om fotball. Men Pokémon-kortene gir bedre avkastning.'],
    bengt: ['Hei hei! Maradona hadde jo gjort det bra her, tror jeg! Hva mener du?', 'Nei, dette minner meg om da Zico spilte i -82. Fantastisk tider! Hva spurte du om igjen?', 'Jeg scoret ti mål mot Rosenborg som keeper, så jeg vet litt om fotball, jeg!'],
    odd: [`Nei, nei, nei. Brasil jukse' aillfall, det veit æ. Æ ska' hent' leverposteien å tenk på det.`, `Nei, nei, nei. Kvar'n som hæll ha' snø om vinteren e' te' å stoil på. Det e' min filosofi, det.`, `Nei, nei, nei. Fotball e' ein bygreie, men æ følge' med æ, frå Oppdal. Reffrey dømme' aillfall urettferdig.`],
  };
  // Kall via sikker Cloud Function
  try {
    const systemPrompt = expert.personality + '\n\n' + PANEL_GROUP_CONTEXT + competitionContext + CHAT_SYSTEM_SUFFIX;
    const data = await cfPost('expertChat', { systemPrompt, message });
    const text = data.text;
    if (text && text.length > 3) return text;
    if (data.error) return '(API-feil: ' + data.error + ')';
  } catch(e) {
    console.error('CF error:', e);
    return '(Nettverksfeil: ' + e.message + ')';
  }
  // Fallback: rotate through hardcoded responses
  const opts = fallbacks[expert.id] || ['Hei!'];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ── Expert Profile Card ───────────────────────────────────────────────
function ExpertCard({ expert, me, panelChoices, userNames={}, onShowTips }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [imgPopup, setImgPopup] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const imgRef = useRef(null);
  const hideTimer = useRef(null);

  const showImg = () => { clearTimeout(hideTimer.current); setImgPopup(true); };
  const hideImg = () => { hideTimer.current = setTimeout(() => setImgPopup(false), 120); };
  const choosers = Object.entries(panelChoices).filter(([, v]) => v === expert.id).map(([k]) => userNames[k] || k);
  const myChoice = panelChoices[me.username] === expert.id;

  const cancelChoice = async () => {
    const snap = await getDoc(doc(db, 'config', 'panelChoices'));
    const data = snap.exists() ? snap.data() : {};
    delete data[me.username];
    await setDoc(doc(db, 'config', 'panelChoices'), data);
    setDone(false);
  };

  const fillMyTips = async () => {
    setLoading(true);
    try {
      const u = await getUser(me.username);
      const { tips, groupOrders } = await generateExpertTips(expert);
      console.log('Generated tips:', Object.keys(tips).length, 'group orders:', Object.keys(groupOrders).length);
      if (Object.keys(tips).length === 0) {
        alert('Fikk ingen tips fra ' + expert.firstName + '. Prøv igjen.');
        setLoading(false);
        return;
      }
      await updateUser(me.username, {
        tips: { ...(u?.tips || {}), ...tips },
        groupOrders: { ...(u?.groupOrders || {}), ...groupOrders },
        botSource: expert.id,
      });
      await setPanelChoice(me.username, expert.id);
      setDone(true);
    } catch(e) {
      console.error('fillMyTips error:', e);
      alert('Feil: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <div style={{ ...C.card, border: myChoice ? `2px solid ${expert.color}` : '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Square image – hover to show large popup */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              ref={imgRef}
              onMouseEnter={showImg}
              onMouseLeave={hideImg}
              style={{ width:90, borderRadius:8, overflow:'hidden', cursor:'pointer', border:`2px solid ${expert.color}44` }}>
              <img src={expert.img} alt={expert.name} style={{ width:'100%', height:'auto', display:'block' }}
                onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML = '<span style="font-size:36px">' + expert.emoji + '</span>'; }} />
            </div>
            {imgPopup && imgRef.current && createPortal(
              <div
                onMouseEnter={showImg}
                onMouseLeave={hideImg}
                style={{
                  position: 'fixed',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: imgRef.current.getBoundingClientRect().left,
                  zIndex: 9000,
                  width: 440,
                  maxWidth: 'calc(100vw - 24px)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: `2px solid ${expert.color}`,
                  boxShadow: `0 8px 32px rgba(0,0,0,.7), 0 0 20px ${expert.color}44`,
                  background: '#0d1230',
                  pointerEvents: 'auto',
                }}>
                <img src={expert.img} alt={expert.name}
                  style={{ width:'100%', height:'auto', display:'block' }}
                  onError={e => e.target.style.display='none'} />
                <div style={{ padding:'10px 12px', borderTop:`1px solid ${expert.color}33` }}>
                  <div style={{ color: expert.color, fontWeight:700, fontSize:13, fontFamily:"'Kanit',sans-serif" }}>{expert.name}</div>
                  <div style={{ color:'rgba(255,255,255,.5)', fontSize:11, marginTop:2 }}>{expert.age} år · {expert.from}</div>
                </div>
              </div>,
              document.body
            )}
          </div>
          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:17, fontWeight:700, color:expert.color, cursor:'pointer', textDecoration:'underline', textDecorationColor:expert.color+'66' }}
              onClick={() => onShowTips && onShowTips(expert)}>{expert.name}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:2 }}>{expert.age} år · {expert.from}</div>
            <div style={{ fontSize:12, color:expert.color, fontStyle:'italic', marginBottom:8 }}>{expert.tagline}</div>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.65)', lineHeight:1.6, margin:0 }}>{expert.bio}</p>
            {choosers.length > 0 && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:"'Fira Code',monospace", marginTop:8 }}>
                Valgt av: {choosers.join(', ')}
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
              <button style={{ background:`linear-gradient(135deg, ${expert.color}, ${expert.color}bb)`, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:.5, opacity:loading?0.6:1, whiteSpace:'nowrap' }}
                onClick={() => setConfirm(true)} disabled={loading}>
                {loading ? '⟳' : done ? '✅ Valgt!' : 'Bruk ekspert'}
              </button>
              {myChoice && (
                <button style={{...C.btnSecondary, padding:'7px 12px', fontSize:11, color:'#ff7777'}}
                  onClick={cancelChoice}>
                  Angre
                </button>
              )}
            </div>
            {confirm && (
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                <div style={{background:'#0d1230',border:`2px solid ${expert.color}`,borderRadius:16,padding:28,maxWidth:400,width:'100%'}}>
                  <p style={{color:'#e8edf8',fontSize:15,lineHeight:1.6,marginBottom:16}}>
                    Er du sikker på at du vil la <strong style={{color:expert.color}}>{expert.firstName}</strong> tippe for deg?
                  </p>
                  <p style={{color:'rgba(255,255,255,.65)',fontSize:13,lineHeight:1.6,marginBottom:8}}>
                    ✅ Kamptips og grupperangeringer fylles ut automatisk.
                  </p>
                  <p style={{color:'#f59e0b',fontSize:13,lineHeight:1.6,marginBottom:20}}>
                    ⚠️ Spesialtips (verdensmester, toppscorer osv.) fylles <strong>ikke</strong> ut av boten – husk å gjøre det selv!
                  </p>
                  <div style={{display:'flex',gap:10}}>
                    <button style={{...C.btnGold,flex:1}} onClick={() => { setConfirm(false); fillMyTips(); }}>Ja, kjør på!</button>
                    <button style={{...C.btnSecondary,flex:1}} onClick={() => setConfirm(false)}>Avbryt</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Expert Tips View ──────────────────────────────────────────────────
function ExpertTipsView({ expert }) {
  const [userData, setUserData] = useState(null);
  useEffect(() => {
    getUser('panel_' + expert.id).then(u => setUserData(u));
  }, [expert.id]);

  if (!userData) return <div style={{color:'rgba(255,255,255,.4)',fontSize:13,padding:8}}>Laster...</div>;
  const tips = userData.tips || {};
  const spec = userData.specialTips || {};
  if (Object.keys(tips).length === 0) return <div style={{color:'rgba(255,255,255,.4)',fontSize:13,padding:8}}>Ingen tips levert ennå.</div>;

  return (
    <div>
      {/* Special tips */}
      <span style={C.secH}>Spesialtips</span>
      <div style={{...C.specBox, marginBottom:16}}>
        {SPEC_FIELDS.map(({key,label}) => (
          <div key={key} style={{...C.specRow}}>
            <span style={{...C.specLabel,fontSize:12}}>{label}</span>
            <span style={{color:spec[key]?'#e8edf8':'rgba(255,255,255,.3)',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
              {key==='topscorer'
                ? spec[key]
                  ? <>{TOPSCORER_FLAGS[spec[key]] && <img src={`https://flagcdn.com/w40/${TOPSCORER_FLAGS[spec[key]]}.png`} width={16} height={11} alt="" style={{borderRadius:2,objectFit:'cover'}}/>} {spec[key]}</>
                  : '–'
                : spec[key] ? <><Flag team={spec[key]} size={16}/> {spec[key]}</> : '–'
              }
            </span>
          </div>
        ))}
      </div>
      {/* All group matches */}
      {Object.keys(GROUPS).map(g => (
        <div key={g} style={{marginBottom:12}}>
          <span style={{...C.roundL}}>Gruppe {g}</span>
          {GROUP_MATCHES.filter(m => m.group === g && tips[m.id]).map(m => (
            <div key={m.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
              <span style={{fontSize:12,flex:1,display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}><Flag team={m.home} size={14}/> {m.home}</span>
              <span style={{fontFamily:"'Fira Code',monospace",color:'#FFD700',padding:'2px 8px',background:'rgba(255,215,0,.08)',borderRadius:5,fontSize:13,flexShrink:0}}>
                {tips[m.id].home}–{tips[m.id].away}
              </span>
              <span style={{fontSize:12,flex:1,display:'flex',alignItems:'center',gap:4}}>{m.away} <Flag team={m.away} size={14}/></span>
            </div>
          ))}
        </div>
      ))}
      {/* Knockout matches - always show */}
      <div style={{marginTop:8}}>
        <span style={{...C.secH}}>Sluttspill</span>
        {KNOCKOUT_ROUNDS.map(({phase:kp, label}) => {
          const kMatches = KNOCKOUT_MATCHES.filter(m => m.phase === kp);
          const tippedMatches = kMatches.filter(m => tips[m.id]);
          return (
            <div key={kp} style={{marginBottom:12}}>
              <span style={{...C.roundL}}>{label}</span>
              {tippedMatches.length === 0 ? (
                <div style={{fontSize:12,color:'rgba(255,255,255,.3)',padding:'4px 0',fontStyle:'italic'}}>Ikke tippet ennå – låses opp etter gruppespillet</div>
              ) : (
                tippedMatches.map(m => (
                  <div key={m.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                    <span style={{fontSize:10,color:'rgba(255,255,255,.4)',minWidth:55,fontFamily:"'Fira Code',monospace"}}>Kamp {m.matchNum}</span>
                    <span style={{fontSize:12,flex:1,textAlign:'right',color:'rgba(255,255,255,.6)'}}>{m.home}</span>
                    <span style={{fontFamily:"'Fira Code',monospace",color:'#FFD700',padding:'2px 8px',background:'rgba(255,215,0,.08)',borderRadius:5,fontSize:13,flexShrink:0}}>
                      {tips[m.id].home}–{tips[m.id].away}
                    </span>
                    <span style={{fontSize:12,flex:1,color:'rgba(255,255,255,.6)'}}>{m.away}</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel Leaderboard ────────────────────────────────────────────────
function PanelLeaderboard({ onSelect }) {
  const [rows, setRows] = useState([]);
  const [results, setResultsState] = useState({});
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => {
    Promise.all(PANEL_EXPERTS.map(async e => {
      const u = await getUser('panel_' + e.id);
      const score = u ? calcScore(u, results) : { total: 0, fulltreff: 0 };
      return { ...e, ...score };
    })).then(r => setRows(r.sort((a,b) => b.total - a.total)));
  }, [results]);

  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot}/>Ekspertpanel – poengtabell</span></div>
      <div style={C.cardBody}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ ...C.lbRow, cursor:'pointer' }} onClick={() => onSelect(r)}>
            <span style={C.lbRank}><span style={{color:'rgba(255,255,255,.4)',fontSize:13}}>{i+1}</span></span>

            <span style={{...C.lbName,color:r.color}}>{r.name}</span>
            {(r.fulltreff||0)>0 && renderFulltreff(r.fulltreff)}
            <div style={{textAlign:'right'}}>
              <div style={C.lbPts}>{r.total}</div>
              <div style={C.lbPtsL}>poeng</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Panel Page ────────────────────────────────────────────────────────
function PanelPage({ me }) {
  const [panelChoices, setPanelChoices] = useState({});
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    getAllUsers().then(users => {
      const map = {};
      users.forEach(u => { map[u.id] = u.displayName || u.id; });
      setUserNames(map);
    });
    getPanelChoices().then(setPanelChoices);
    const unsub = onSnapshot(doc(db, 'config', 'panelChoices'), snap => {
      if (snap.exists()) setPanelChoices(snap.data());
    });
    return unsub;
  }, []);

  return (
    <div className="fu">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:22, fontWeight:700, color:'#FFD700', textTransform:'uppercase', letterSpacing:2, margin:0 }}>🎙️ Ekspertpanel</h2>
        <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginTop:6, lineHeight:1.7 }}>
          Fem eksperter med sine egne tips og sterke meninger. Call på dem i chatten med <span style={{color:'#FFD700'}}>@fornavn</span>. Trykk på bildet for å zoome.<br/>
          Du kan la en av ekspertene fylle ut alle dine tips ved å trykke <span style={{color:'#FFD700'}}>"Bruk ekspert"</span> på profilen deres.<br/>
          <span style={{color:'rgba(255,100,100,.8)'}}>OBS:</span> Glemmer du å levere tips i tide velges det tilfeldig en ekspert som fyller ut for deg!
        </p>
      </div>
      <PanelLeaderboard onSelect={setSelectedExpert} />
      {selectedExpert && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:600,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'16px 16px 0 16px',overflowY:'auto'}}
          onClick={() => setSelectedExpert(null)}>
          <div style={{background:'#0d1230',border:`2px solid ${selectedExpert.color}`,borderRadius:12,width:'100%',maxWidth:600,marginTop:16,marginBottom:32,overflow:'hidden'}}
            onClick={e => e.stopPropagation()}>
            <div style={{...C.cardHeader,borderBottom:`1px solid ${selectedExpert.color}33`,position:'sticky',top:0,background:'#0d1230',zIndex:1}}>
              <span style={{...C.cardTitle,color:selectedExpert.color}}>{selectedExpert.firstName}s tips</span>
              <button onClick={() => setSelectedExpert(null)} style={{...C.btnSecondary,padding:'5px 14px',fontSize:12}}>× Lukk</button>
            </div>
            <div style={C.cardBody}><ExpertTipsView expert={selectedExpert}/></div>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:16 }}>
        {PANEL_EXPERTS.map(expert => (
          <ExpertCard key={expert.id} expert={expert} me={me} panelChoices={panelChoices} userNames={userNames} onShowTips={setSelectedExpert} />
        ))}
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════
//  CHAT PAGE
// ══════════════════════════════════════════════════════════════════════
function ChatPage({ me }) {
  const isMobile = useIsMobile();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [results, setResults] = useState({});
  const [liveEvent, setLiveEvent] = useState(null);
  const chatBoxRef = useRef(null);
  const { soundOn, toggleSound, playSound } = useChatSound();
  const prevMsgCount = useRef(0);

  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeOnlineUsers(setOnlineUsers); return u; }, []);
  useEffect(() => { const u = subscribeResults(setResults); return u; }, []);
  useEffect(() => { const u = subscribeLiveEvent(ev => setLiveEvent(ev?.type ? ev : null)); return u; }, []);
  useEffect(() => {
    getAllUsers().then(us => setUsers(
      us.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'))
    ));
  }, []);
  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [msgs]);
  useEffect(() => {
    if (msgs.length > 0 && prevMsgCount.current > 0 && msgs.length > prevMsgCount.current) {
      const latest = msgs[msgs.length - 1];
      if (latest?.user !== me.displayName) playSound();
    }
    prevMsgCount.current = msgs.length;
  }, [msgs]); // eslint-disable-line

  const sendMsg = async () => {
    const t = input.trim(); if (!t) return;
    const senderIsBot = PANEL_EXPERTS.some(e => e.name === me.displayName);
    setInput('');
    await sendChatMessage(me.displayName, t, '');

    if (msgs.length >= 40) {
      msgs.slice(0, msgs.length - 39).forEach(m => { if (m.id) deleteChatMessage(m.id); });
    }

    if (senderIsBot) return;

    if (t.toLowerCase().includes('@funfact')) {
      const expert = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];
      setTimeout(async () => {
        const prompt = `${expert.personality}\n\nKom med én interessant funfact om fotball-VM (FIFA World Cup). Finn noe genuint interessant, overraskende eller morsomt – historisk statistikk, rekorder, kuriøse hendelser, underdog-historier. Presenter det som deg selv med din personlighet og dialekt. Maks 3 setninger.`;
        const reply = await chatWithExpert(expert, prompt, []);
        await sendChatMessage(expert.name, `🎲 Funfact: ${reply}`, '');
      }, 800);
      return;
    }

    const mentionMatches = [...t.matchAll(/@([a-zæøå-]+)/gi)];
    const mentionedExperts = [];
    mentionMatches.forEach(match => {
      const mentioned = match[1].toLowerCase().replace('-','');
      const expert = PANEL_EXPERTS.find(e =>
        e.firstName.toLowerCase() === match[1].toLowerCase() ||
        e.firstName.toLowerCase().replace('-','') === mentioned ||
        e.id === mentioned
      );
      if (expert && !mentionedExperts.find(e => e.id === expert.id)) mentionedExperts.push(expert);
    });
    mentionedExperts.forEach((expert, i) => {
      setTimeout(async () => {
        const ctx = buildCompetitionContext(users, results, liveEvent);
        const reply = await chatWithExpert(expert, t, [], ctx);
        await sendChatMessage(expert.name, reply, '');
      }, 1000 + i * 2000);
    });
  };

  return (
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot}/> Chat</span>
        <div style={{ ...C.cardHeaderActions, gap: isMobile ? 4 : 6 }}>
          <VideoButton compact={isMobile} />
          <OnlineIndicator onlineUsers={onlineUsers} compact={isMobile} />
          <SoundToggle soundOn={soundOn} onToggle={toggleSound} />
        </div>
      </div>
      <div ref={chatBoxRef} style={{ height:'calc(100vh - 280px)', minHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'12px 16px', background:'rgba(0,0,0,.15)' }}>
        {msgs.length === 0 && <p style={{ color:'rgba(255,255,255,.3)', textAlign:'center', marginTop:60, fontSize:13 }}>Si hei! 👋</p>}
        {msgs.map((m, i) => (
          <ChatBubble key={m.id || i} m={m} mine={m.user === me.displayName}
            isAdmin={me.isAdmin} onDelete={deleteChatMessage} username={me.displayName} />
        ))}
      </div>
      <div style={C.chatInputRow}>
        <ImageUploadButton onImage={dataUrl => sendChatMessage(me.displayName, '', dataUrl)} />
        <input style={{...C.inp,marginBottom:0,flex:1,fontSize:13,padding:'8px 12px'}}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&sendMsg()}
          placeholder="Skriv melding…"
          onPaste={async e=>{
            const items=e.clipboardData?.items;if(!items)return;
            for(let item of items){
              if(item.type.startsWith('image/')){
                e.preventDefault();
                const file=item.getAsFile();
                const dataUrl = await compressImage(file);
                sendChatMessage(me.displayName,'',dataUrl);
                return;
              }
            }
          }}
        />
        <button style={{...C.btnSend}} onClick={sendMsg}>Send</button>

      </div>
    </div>
  );
}



// ── Auto Phase Management ─────────────────────────────────────────────
const PHASE_SCHEDULE = [
  { phase: 'pre',          until: new Date('2026-06-11T22:30:00+02:00') },
  { phase: 'group_lock',   until: new Date('2026-06-27T23:59:00+02:00') },
  { phase: 'group_done',   until: new Date('2026-06-28T16:00:00+02:00') },
  { phase: 'r32_lock',     until: new Date('2026-07-03T23:59:00+02:00') },
  { phase: 'r32_done',     until: new Date('2026-07-04T17:00:00+02:00') },
  { phase: 'r16_lock',     until: new Date('2026-07-07T23:59:00+02:00') },
  { phase: 'r16_done',     until: new Date('2026-07-09T21:00:00+02:00') },
  { phase: 'qf_lock',      until: new Date('2026-07-12T23:59:00+02:00') },
  { phase: 'qf_done',      until: new Date('2026-07-14T00:00:00+02:00') },
  { phase: 'sf_lock',      until: new Date('2026-07-15T23:59:00+02:00') },
  { phase: 'sf_done',      until: new Date('2026-07-18T21:00:00+02:00') },
  { phase: 'bronze_lock',  until: new Date('2026-07-19T21:00:00+02:00') },
  { phase: 'finished',     until: null },
];

function getAutoPhase() {
  const now = new Date();
  for (const p of PHASE_SCHEDULE) {
    if (!p.until || now < p.until) return p.phase;
  }
  return 'finished';
}

// Hvilke kamper tilhører hvilken fase-lås
const PHASE_MATCHES = {
  group_lock:  GROUP_MATCHES.map(m => m.id),
  r32_lock:    KNOCKOUT_MATCHES.filter(m => m.phase === 'r32').map(m => m.id),
  r16_lock:    KNOCKOUT_MATCHES.filter(m => m.phase === 'r16').map(m => m.id),
  qf_lock:     KNOCKOUT_MATCHES.filter(m => m.phase === 'qf').map(m => m.id),
  sf_lock:     KNOCKOUT_MATCHES.filter(m => m.phase === 'sf').map(m => m.id),
  bronze_lock: KNOCKOUT_MATCHES.filter(m => m.phase === 'bronze' || m.phase === 'final').map(m => m.id),
};

// Kjøres når fase låser – fyller ut manglende tips med sticky ekspert-tildeling.
// Regler:
//  • Brukeren beholder sin tildelte ekspert (u.assignedExpert) på tvers av faser.
//  • Ved første tildeling velges eksperten round-robin basert på totalt antall brukere
//    som allerede har fått tildelt eksperten (minst-brukte-ekspert prinsipp).
//  • Innen en gruppe eksperter er utbrukt (alle tildelt ≥ N brukere), starter man på nytt.
async function autoFillMissingTips(lockPhase) {
  const matchIds = PHASE_MATCHES[lockPhase];
  if (!matchIds || matchIds.length === 0) return;

  const users = await getAllUsers();
  const realUsers = users.filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));

  // Build assignment counts to find least-used expert for new assignments
  const assignCounts = {};
  PANEL_EXPERTS.forEach(e => { assignCounts[e.id] = 0; });
  realUsers.forEach(u => {
    if (u.assignedExpert && assignCounts[u.assignedExpert] !== undefined) {
      assignCounts[u.assignedExpert]++;
    }
  });

  for (const u of realUsers) {
    // Sjekk om brukeren mangler noen av kampene i denne fasen
    const missing = matchIds.filter(id => {
      const t = u.tips?.[id];
      return t?.home === undefined || t?.away === undefined;
    });

    // Also check group orders and spec tips for group_lock
    const missingGroups = lockPhase === 'group_lock'
      ? Object.keys(GROUPS).filter(g => (u.groupOrders?.[g] || []).filter(Boolean).length < 4)
      : [];
    const missingSpec = lockPhase === 'group_lock'
      ? SPEC_FIELDS.filter(f => !u.specialTips?.[f.key])
      : [];

    if (missing.length === 0 && missingGroups.length === 0 && missingSpec.length === 0) continue;

    // Determine expert: sticky (same as before) or assign new (least-used)
    let expertId = u.assignedExpert;
    if (!expertId || !PANEL_EXPERTS.find(e => e.id === expertId)) {
      // Find least-used expert
      const minCount = Math.min(...Object.values(assignCounts));
      const candidates = PANEL_EXPERTS.filter(e => assignCounts[e.id] === minCount);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      expertId = picked.id;
      assignCounts[expertId]++;
    }

    const expert = PANEL_EXPERTS.find(e => e.id === expertId);
    if (!expert) continue;
    const botUser = await getUser('panel_' + expert.id);
    if (!botUser) continue;

    // Copy missing match tips from bot
    const newTips = { ...(u.tips || {}) };
    const filledBy = { ...(u.botFilledMatches || {}) };
    missing.forEach(id => {
      const botTip = botUser.tips?.[id];
      if (botTip?.home !== undefined && botTip?.away !== undefined) {
        newTips[id] = { home: botTip.home, away: botTip.away };
        filledBy[id] = expert.id;
      }
    });

    // Fill group orders from bot
    let newGrpO = { ...(u.groupOrders || {}) };
    if (missingGroups.length > 0 && botUser.groupOrders) {
      missingGroups.forEach(g => {
        if (botUser.groupOrders[g]) {
          newGrpO[g] = botUser.groupOrders[g];
          filledBy[`grp_${g}`] = expert.id;
        }
      });
    }

    // Fill spec tips from bot – except topscorer (random player from ALL_TEAMS instead)
    let newSpec = { ...(u.specialTips || {}) };
    if (missingSpec.length > 0) {
      missingSpec.forEach(f => {
        if (f.key === 'topscorer') {
          // Pick a random player from ALL_PLAYERS (same pool as the PlayerAutocomplete dropdown)
          const randomPlayer = ALL_PLAYERS[Math.floor(Math.random() * ALL_PLAYERS.length)];
          newSpec[f.key] = randomPlayer.name;
          filledBy[`spec_${f.key}`] = expert.id;
        } else {
          if (botUser.specialTips?.[f.key]) {
            newSpec[f.key] = botUser.specialTips[f.key];
            filledBy[`spec_${f.key}`] = expert.id;
          }
        }
      });
    }

    await updateUser(u.id, {
      tips: newTips,
      groupOrders: newGrpO,
      specialTips: newSpec,
      botFilledMatches: filledBy,
      assignedExpert: expertId,
      botSource: u.botSource || expertId,
    });
  }
}


// ── API-Football auto-fetch ───────────────────────────────────────────
// World Cup 2026 competition ID on API-Football
const WC_2026_ID = 1; // FIFA World Cup

// Map Norwegian team names to API-Football team names for matching
const TEAM_NAME_MAP = {
  'Mexico':'Mexico','Sør-Afrika':'South Africa','Sør-Korea':'South Korea',
  'Tsjekkia':'Czech Republic','Canada':'Canada','Bosnia-Herz':'Bosnia and Herzegovina',
  'Qatar':'Qatar','Sveits':'Switzerland','Brasil':'Brazil','Marokko':'Morocco',
  'Haiti':'Haiti','Skottland':'Scotland','USA':'USA','Paraguay':'Paraguay',
  'Australia':'Australia','Tyrkia':'Turkey','Tyskland':'Germany','Curacao':'Curacao',
  'Elfenbenskysten':'Ivory Coast','Ecuador':'Ecuador','Nederland':'Netherlands',
  'Japan':'Japan','Sverige':'Sweden','Tunisia':'Tunisia','Belgia':'Belgium',
  'Egypt':'Egypt','Iran':'Iran','New Zealand':'New Zealand','Spania':'Spain',
  'Kapp Verde':'Cape Verde','Saudi-Arabia':'Saudi Arabia','Uruguay':'Uruguay',
  'Frankrike':'France','Senegal':'Senegal','Irak':'Iraq','Norge':'Norway',
  'Argentina':'Argentina','Algerie':'Algeria','Østerrike':'Austria','Jordan':'Jordan',
  'Portugal':'Portugal','Kongo DR':'DR Congo','Usbekistan':'Uzbekistan','Colombia':'Colombia',
  'England':'England','Kroatia':'Croatia','Ghana':'Ghana','Panama':'Panama',
};

// eslint-disable-next-line no-unused-vars
async function fetchAndUpdateResults() {
 if (true) return; // Disabled – Cloud Function handles this now
  const apiKey = process.env.REACT_APP_FOOTBALL_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=' + WC_2026_ID + '&season=2026&status=FT',
      { headers: { 'x-apisports-key': apiKey } }
    );
    const data = await res.json();
    if (!data.response) return;

    const updates = {};
    const cardUpdates = {};

    data.response.forEach(fixture => {
      const home = fixture.teams?.home?.name;
      const away = fixture.teams?.away?.name;
      const homeGoals = fixture.goals?.home;
      const awayGoals = fixture.goals?.away;
      if (homeGoals === null || awayGoals === null) return;

      // Find matching group match
      const match = GROUP_MATCHES.find(m => {
        const mh = TEAM_NAME_MAP[m.home];
        const ma = TEAM_NAME_MAP[m.away];
        return (mh === home && ma === away) || (mh === away && ma === home);
      });

      if (match) {
        const reversed = TEAM_NAME_MAP[match.home] === away;
        updates[match.id] = {
          home: reversed ? awayGoals : homeGoals,
          away: reversed ? homeGoals : awayGoals,
        };
      }

      // Cards per team
      const events = fixture.events || [];
      events.forEach(ev => {
        if (ev.type === 'Card') {
          const teamName = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === ev.team?.name);
          if (!teamName) return;
          if (!cardUpdates[teamName]) cardUpdates[teamName] = { y: 0, r: 0 };
          if (ev.detail === 'Yellow Card') cardUpdates[teamName].y++;
          else if (ev.detail === 'Red Card' || ev.detail === 'Yellow-Red Card') cardUpdates[teamName].r++;
        }
      });
    });

    // Save results to Firebase
    if (Object.keys(updates).length > 0) {
      const cur = await getResults();
      await setResults({ ...cur, ...updates });
    }

    // Save cards to Firebase
    if (Object.keys(cardUpdates).length > 0) {
      const curCards = await getCardStats();
      const newCards = { ...curCards };
      Object.entries(cardUpdates).forEach(([team, {y, r}]) => {
        newCards['_y_' + team] = y;
        newCards['_r_' + team] = r;
        newCards[team] = y + r * 3;
      });
      await setCardStats(newCards);
    }
  } catch(e) {
    console.warn('API-Football fetch error:', e);
  }
}



// ══════════════════════════════════════════════════════════════════════
//  VM COUNTDOWN (bottom right)
// ══════════════════════════════════════════════════════════════════════
const VM_START = new Date('2026-06-11T19:00:00Z'); // 21:00 CEST

function VMCountdownBanner({ adminMessage, onAdminMessageClick, isMobile, bannerH }) {
  const [countdownLabel, setCountdownLabel] = useState('');
  const [phase, setPhase] = useState('scroll');
  const [repeat, setRepeat] = useState(0);
  const [liveEvent, setLiveEvent] = useState(null); // {type,text,homeScored,...}

  useEffect(() => {
    const update = () => {
      const diff = VM_START - Date.now();
      if (diff <= 0) { setCountdownLabel(''); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days >= 1) setCountdownLabel(`${days} dag${days !== 1 ? 'er' : ''} til VM starter!`);
      else if (hours >= 1) setCountdownLabel(`${hours} time${hours !== 1 ? 'r' : ''} og ${mins} min til kickoff!`);
      else setCountdownLabel(`${mins} minutt${mins !== 1 ? 'er' : ''} til VM starter! ⚽`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, []);

  // Lytt på live-hendelser fra Cloud Function via Firestore
  const prevEventRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const [bannerAnim, setBannerAnim] = useState(null); // 'goal'|'yellow'|'red'|'finished'|null
  useEffect(() => {
    const unsub = subscribeLiveEvent(ev => {
      if (ev?.type) {
        const evKey = ev.type + (ev.playerName || '') + (ev.minute || '') + (ev.text || '');
        // Ignorer hendelser fra FØR siden ble lastet (unngår replay ved refresh/oppstart)
        const isAfterMount = (ev.ts || 0) > mountTimeRef.current;
        if (evKey !== prevEventRef.current && isAfterMount) {
          prevEventRef.current = evKey;
          setLiveEvent(ev);
          if (ev.type === 'goal') {
            setBannerAnim('goal');
            setTimeout(() => { setLiveEvent(null); setBannerAnim(null); }, 30000);
            setTimeout(() => fireGoalConfetti(3), 400);
            try { new Audio('/goal.wav').play(); } catch(e) {}
          } else if (ev.type === 'card') {
            const isRed = ev.cardColor === 'Red';
            setBannerAnim(isRed ? 'red' : 'yellow');
            // Blink 3 ganger (gult) eller 10 sek (rødt), deretter stå med ramme
            const blinkDuration = isRed ? 10000 : 1500;
            setTimeout(() => setBannerAnim(isRed ? 'red-solid' : 'yellow-solid'), blinkDuration);
            setTimeout(() => { setLiveEvent(null); setBannerAnim(null); }, 30000);
            try { new Audio('/whistle.wav').play(); } catch(e) {}
          } else if (ev.type === 'finished') {
            setBannerAnim('finished');
            setTimeout(() => { setLiveEvent(null); setBannerAnim(null); }, 30000);
            try { new Audio('/whistle.wav').play(); } catch(e) {}
          }
        } else if (evKey === prevEventRef.current) {
          // Samme hendelse — ikke gjør noe (unngår reset av 30-sek timer)
        } else {
          // Gammel hendelse (>60 sek) — vis bare score
          setLiveEvent(ev);
        }
      } else {
        prevEventRef.current = null;
        setLiveEvent(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => { setPhase('scroll'); setRepeat(0); }, [adminMessage]);
  useEffect(() => {
    if (!adminMessage || phase === 'static') return;
    if (phase === 'pause') {
      setPhase('static');
    }
  }, [phase, adminMessage]);

  const vmOver = VM_START <= Date.now();
  // Priority: liveEvent > adminMessage > countdown
  const show = liveEvent || adminMessage || (!vmOver && countdownLabel);
  if (!show) return null;

  const w = isMobile ? 180 : 340;
  const YEL = '#FFD700';

  // Render live event inline with yellow scoring team number
  const renderLiveContent = () => {
    if (!liveEvent) return null;
    if (liveEvent.type === 'goal') {
      const { homeTeam, awayTeam, homeGoals, awayGoals, homeScored, playerName, minute, suffix } = liveEvent;
      return (
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight:700, whiteSpace:'nowrap', justifyContent:'center' }}>
          <span style={{ color: YEL, fontWeight:900, letterSpacing:1 }}>MÅL!</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><Flag team={homeTeam} size={14} /><span style={{ color: homeScored ? YEL : 'rgba(255,255,255,.9)', fontSize:11 }}>{TEAM_SHORT[homeTeam] || homeTeam.slice(0,3).toUpperCase()}</span></span>
          <span style={{ color: homeScored ? YEL : 'rgba(255,255,255,.9)' }}>{homeGoals}</span>
          <span style={{ color:'rgba(255,255,255,.4)' }}>–</span>
          <span style={{ color: !homeScored ? YEL : 'rgba(255,255,255,.9)' }}>{awayGoals}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><Flag team={awayTeam} size={14} /><span style={{ color: !homeScored ? YEL : 'rgba(255,255,255,.9)', fontSize:11 }}>{TEAM_SHORT[awayTeam] || awayTeam.slice(0,3).toUpperCase()}</span></span>
          <span style={{ color:'rgba(255,255,255,.55)', fontSize:10, marginLeft:2 }}>· {playerName}{suffix} '{minute}</span>
        </div>
      );
    }
    // card or finished
    return <div style={{ fontSize:11, color: YEL, fontFamily:"'Inter',sans-serif", fontWeight:700, textAlign:'center', whiteSpace:'nowrap' }}>{liveEvent.text}</div>;
  };

  const displayText = !liveEvent && (adminMessage
    ? (phase === 'static' ? '📢 Les melding fra admin' : null)
    : `⏱ ${countdownLabel}`);

  return (
    <div onClick={adminMessage && !liveEvent ? onAdminMessageClick : undefined} style={{
      position: 'fixed',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9000,
      width: w,
      background: 'rgba(1,23,76,.95)',
      backgroundImage: 'linear-gradient(rgba(255,215,0,.08), rgba(255,215,0,.08))',
      border: `1px solid ${
        bannerAnim === 'goal' ? 'rgba(74,222,128,.7)' :
        bannerAnim === 'yellow' || bannerAnim === 'yellow-solid' ? 'rgba(255,215,0,.8)' :
        bannerAnim === 'red' || bannerAnim === 'red-solid' ? 'rgba(220,38,38,.8)' :
        bannerAnim === 'finished' ? 'rgba(255,255,255,.6)' :
        liveEvent ? 'rgba(74,222,128,.4)' : 'rgba(255,215,0,.25)'
      }`,
      animation: bannerAnim === 'goal' ? 'bannerGoal 1.2s ease-in-out infinite' :
        bannerAnim === 'yellow' ? 'bannerYellowBlink 0.5s ease-in-out 3' :
        bannerAnim === 'red' ? 'bannerRedBlink 0.5s ease-in-out infinite' :
        'none',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,.5)',
      padding: '5px 14px',
      overflow: 'hidden',
      cursor: adminMessage && !liveEvent ? 'pointer' : 'default',
      pointerEvents: 'all',
    }}>
      {liveEvent ? renderLiveContent() :
        adminMessage && phase !== 'static' ? (
          <div style={{
            overflow: 'hidden', margin: '0 -14px',
            maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}>
            <span key={phase + repeat} onAnimationEnd={() => setPhase('pause')}
              style={{ fontSize: 11, color: YEL, fontFamily:"'Inter',sans-serif", fontWeight:700, whiteSpace:'nowrap', display:'inline-block', padding:'0 20px', animation:`tickerScroll ${Math.max(4, Math.round(adminMessage.length * 0.09))}s linear forwards` }}>
              📢 {adminMessage}
            </span>
          </div>
        ) : (
          <div style={{ fontSize:11, color: YEL, fontFamily:"'Inter',sans-serif", fontWeight:700, letterSpacing:0.5, textAlign:'center' }}>
            {displayText}
          </div>
        )
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  ADMIN MESSAGE TICKER (in banner)
// ══════════════════════════════════════════════════════════════════════

function AdminMessagePopup({ message, onClose }) {
  if (!message) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(13,18,48,.97)', border: '2px solid rgba(255,215,0,.4)',
        borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,.6)',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,215,0,.6)', fontFamily: "'Fira Code',monospace", textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Melding fra admin</div>
        <p style={{ fontSize: 15, color: '#e8edf8', lineHeight: 1.7, margin: 0 }}>{message}</p>
        <button onClick={onClose} style={{ ...C.btnSecondary, marginTop: 20, width: '100%' }}>Lukk ✕</button>
      </div>
    </div>
  );
}

// ── Live match events ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
async function fetchLiveEvents() {
  const apiKey = process.env.REACT_APP_FOOTBALL_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=' + WC_2026_ID + '&season=2026&status=1H-2H-ET-P',
      { headers: { 'x-apisports-key': apiKey } }
    );
    const data = await res.json();
    if (!data.response?.length) return null;

    const fixture = data.response[0];
    const home = fixture.teams?.home?.name;
    const away = fixture.teams?.away?.name;
    const homeGoals = fixture.goals?.home ?? 0;
    const awayGoals = fixture.goals?.away ?? 0;

    const norHome = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === home) || home;
    const norAway = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === away) || away;
    const shortHome = TEAM_SHORT[norHome] || norHome.slice(0,3).toUpperCase();
    const shortAway = TEAM_SHORT[norAway] || norAway.slice(0,3).toUpperCase();

    const events = (fixture.events || []).slice(-1)[0]; // latest event
    if (!events) return null;

    const ev = events;
    const evTeam = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === ev.team?.name) || ev.team?.name;
    const isHome = evTeam === norHome;
    const min = ev.time?.elapsed;

    if (ev.type === 'Goal') {
      const sm = ev.detail === 'Own Goal' ? ' (s.m.)' : ev.detail === 'Penalty' ? ' (str.)' : '';
      return {
        type: 'goal',
        text: `${shortHome}-${shortAway} ${homeGoals}-${awayGoals} – ${ev.player?.name || '?'} '${min}${sm}`,
        homeScored: isHome,
        homeGoals, awayGoals,
        shortHome, shortAway,
        playerName: ev.player?.name || '?',
        minute: min,
        suffix: sm,
      };
    } else if (ev.type === 'Card') {
      const cardIcon = ev.detail?.includes('Yellow') ? '🟨' : '🟥';
      return {
        type: 'card',
        text: `${cardIcon} ${ev.player?.name || '?'} '${min} (${isHome ? shortHome : shortAway})`,
      };
    } else if (ev.type === 'subst') {
      return null; // skip substitutions
    }
    return null;
  } catch(e) {
    console.warn('Live events fetch error:', e);
    return null;
  }
}
// eslint-disable-next-line no-unused-vars
async function fetchFinishedMatch() {
  const apiKey = process.env.REACT_APP_FOOTBALL_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=' + WC_2026_ID + '&season=2026&status=FT-AET-PEN&last=1',
      { headers: { 'x-apisports-key': apiKey } }
    );
    const data = await res.json();
    if (!data.response?.length) return null;
    const f = data.response[0];
    const home = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === f.teams?.home?.name) || f.teams?.home?.name;
    const away = Object.keys(TEAM_NAME_MAP).find(k => TEAM_NAME_MAP[k] === f.teams?.away?.name) || f.teams?.away?.name;
    const sh = TEAM_SHORT[home] || home?.slice(0,3).toUpperCase();
    const sa = TEAM_SHORT[away] || away?.slice(0,3).toUpperCase();
    const hg = f.goals?.home ?? 0, ag = f.goals?.away ?? 0;
    const status = f.fixture?.status?.short;
    let suffix = '';
    if (status === 'AET') {
      const pHome = f.score?.penalty?.home, pAway = f.score?.penalty?.away;
      suffix = (pHome != null) ? ` (${pHome}-${pAway} e.s.)` : ` (${hg}-${ag} e.e.o.)`;
    } else if (status === 'PEN') {
      const pHome = f.score?.penalty?.home, pAway = f.score?.penalty?.away;
      suffix = ` (${pHome}-${pAway} e.s.)`;
    }
    return { text: `Kamp slutt: ${sh}-${sa} ${hg}-${ag}${suffix}` };
  } catch(e) { return null; }
}



// ══════════════════════════════════════════════════════════════════════
//  PODIUM POPUP – vises på /podium eller etter VM er ferdig
// ══════════════════════════════════════════════════════════════════════
// Fires a confetti burst on both canvas layers (back=behind popup, front=above popup)
function fireConfettiBurst(backCanvas, frontCanvas) {
  const COLORS = ['#FFD700','#FFD700','#FFD700','#f59e0b','#fbbf24','#01174C','#ffffff','#4ade80'];
  const W = backCanvas.width, H = backCanvas.height;

  // Random horizontal spread centre for this burst (25–75% of width)
  const cx = W * (0.25 + Math.random() * 0.5);

  const makeParticle = (layer) => ({
    x: cx + (Math.random() - 0.5) * W * 0.55,
    y: H + Math.random() * 120,
    vx: (Math.random() - 0.5) * (layer === 'back' ? 7 : 5),
    vy: -(Math.random() * (layer === 'back' ? 15 : 11) + 5),
    gravity: layer === 'back' ? 0.23 : 0.19,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: Math.random() * 9 + 5,
    h: Math.random() * 5 + 3,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.22,
    opacity: 1,
    fade: 0.003 + Math.random() * 0.003,
  });

  const back  = Array.from({ length: 110 }, () => makeParticle('back'));
  const front = Array.from({ length: 60  }, () => makeParticle('front'));

  const ctxB = backCanvas.getContext('2d');
  const ctxF = frontCanvas.getContext('2d');

  let raf;
  const draw = () => {
    ctxB.clearRect(0, 0, W, H);
    ctxF.clearRect(0, 0, W, H);
    let anyAlive = false;

    [{ ctx: ctxB, parts: back }, { ctx: ctxF, parts: front }].forEach(({ ctx, parts }) => {
      parts.forEach(p => {
        p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
        p.angle += p.spin;
        p.opacity = Math.max(0, p.opacity - p.fade);
        if (p.opacity > 0) anyAlive = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
    });

    if (anyAlive) raf = requestAnimationFrame(draw);
    else { ctxB.clearRect(0, 0, W, H); ctxF.clearRect(0, 0, W, H); }
  };
  draw();
  return () => cancelAnimationFrame(raf);
}

// Fire N confetti bursts on the permanent goal canvases (used on goals)
function fireGoalConfetti(bursts = 3) {
  const back  = document.getElementById('vm-goal-confetti-back');
  const front = document.getElementById('vm-goal-confetti-front');
  if (!back || !front) return;

  back.width  = front.width  = window.innerWidth;
  back.height = front.height = window.innerHeight;

  // Randomised delays for 3 bursts spread across ~4 s
  const gaps = [0, 1200 + Math.random() * 600, 2800 + Math.random() * 800];
  gaps.slice(0, bursts).forEach(delay => {
    setTimeout(() => fireConfettiBurst(back, front), delay);
  });
}

function useConfetti(active) {
  useEffect(() => {
    if (!active) return;

    const back  = document.getElementById('vm-confetti-canvas');
    const front = document.getElementById('vm-confetti-front');
    if (!back || !front) return;

    const resize = () => {
      back.width  = front.width  = window.innerWidth;
      back.height = front.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 10 bursts over 20 s with randomised delays (not evenly spaced)
    // Gaps: roughly 0–3 s each, summing to ~20 s total
    const gaps = [0, 1400, 2600, 3200, 4800, 6100, 7500, 9300, 11200, 14800];
    const cancels = [];
    const timeouts = gaps.map((delay, i) => setTimeout(() => {
      const cancel = fireConfettiBurst(back, front);
      cancels.push(cancel);
    }, delay));

    return () => {
      window.removeEventListener('resize', resize);
      timeouts.forEach(clearTimeout);
      cancels.forEach(fn => fn && fn());
      back.getContext('2d').clearRect(0, 0, back.width, back.height);
      front.getContext('2d').clearRect(0, 0, front.width, front.height);
    };
  }, [active]);
}

function PodiumPopup({ gold, silver, bronze, onClose }) {
  useConfetti(true);

  // Image native size: 730×500
  const IMG_W = 730, IMG_H = 500;

  // Name box pixel coords (in image space):
  // Silver:  TL(172,346) BR(227,363)
  // Gold:    TL(334,315) BR(403,333)
  // Bronze:  TL(513,370) BR(567,387)
  const BOXES = [
    { name: silver, x1:172, y1:346, x2:227, y2:363 },
    { name: gold,   x1:334, y1:315, x2:403, y2:333 },
    { name: bronze, x1:513, y1:370, x2:567, y2:387 },
  ];

  // Measure the rendered image width so we can scale font exactly
  const imgRef = useRef(null);
  const [imgRenderW, setImgRenderW] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (imgRef.current) setImgRenderW(imgRef.current.getBoundingClientRect().width);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Scale factor: rendered px per image px
  const scale = imgRenderW > 0 ? imgRenderW / IMG_W : 1;

  return createPortal(
    <>
      {/* Confetti canvas – full screen, split z-index via two layers */}
      {/* Back layer (behind popup) */}
      <canvas id="vm-confetti-canvas" style={{
        position: 'fixed', inset: 0, zIndex: 1998,
        pointerEvents: 'none', width: '100%', height: '100%',
      }} />

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1999,
        background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>

        {/* Popup card – constrained by both width AND available height so image never clips */}
        {/* IMG ratio 730:500 = 1.46:1. Reserve ~100px for button + padding below image. */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: `min(${IMG_W}px, calc((100vh - 120px) * ${IMG_W / IMG_H}))`,
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,.8)',
          overflow: 'hidden',
          zIndex: 2000,
        }}>
          {/* The podium image – fills container width */}
          <img
            ref={imgRef}
            src="/podium.png"
            alt="Seierspall"
            style={{ width: '100%', display: 'block' }}
            onLoad={() => {
              if (imgRef.current) setImgRenderW(imgRef.current.getBoundingClientRect().width);
            }}
          />

          {/* Name labels – centred on the original box midpoint, black pill with white border */}
          {BOXES.map(({ name, x1, y1, x2, y2 }, i) => {
            // Centre of the name box in image-space
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const boxH_px = (y2 - y1) * scale;
            const fontSize = Math.max(7, Math.min(boxH_px * 0.78, 13));
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${(cx / IMG_W) * 100}%`,
                top:  `${(cy / IMG_H) * 100}%`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.82)',
                border: '1.5px solid #ffffff',
                borderRadius: 4,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                <span style={{
                  color: '#ffffff',
                  fontFamily: "'Kanit', sans-serif",
                  fontWeight: 700,
                  fontSize,
                  lineHeight: 1,
                  display: 'block',
                }}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            background: 'linear-gradient(135deg, #FFD700, #f59e0b)',
            border: 'none', borderRadius: 12,
            color: '#01174C', fontFamily: "'Kanit', sans-serif",
            fontWeight: 800, fontSize: 18, letterSpacing: 1,
            padding: '12px 48px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,215,0,.5)',
            zIndex: 2001, position: 'relative',
          }}
        >
          Snakkes! 🏆
        </button>
      </div>

      {/* Front confetti layer (same canvas element is already above popup via z-index trick)
          We use a second canvas for front-layer particles */}
      <canvas id="vm-confetti-front" style={{
        position: 'fixed', inset: 0, zIndex: 2002,
        pointerEvents: 'none', width: '100%', height: '100%',
      }} />
    </>,
    document.body
  );
}

// Runs front-layer confetti on the second canvas


// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vm_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('vm_tab') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const podiumMode = window.location.pathname === '/podium';
  const [podiumDismissed, setPodiumDismissed] = useState(false);
  const [podiumPlayers, setPodiumPlayers] = useState({ gold: '', silver: '', bronze: '' });

  // Fetch top 3 for podium
  useEffect(() => {
    if (!podiumMode) return;
    Promise.all([getAllUsers(), getResults()]).then(([users, results]) => {
      const ranked = users
        .filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'))
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total);
      setPodiumPlayers({
        gold:   ranked[0]?.displayName || '–',
        silver: ranked[1]?.displayName || '–',
        bronze: ranked[2]?.displayName || '–',
      });
    });
  }, []); // eslint-disable-line

  // Browser back/forward navigation
  const setTabWithHistory = useCallback((newTab) => {
    try { localStorage.setItem('vm_tab', newTab); } catch {}
    window.history.pushState({ tab: newTab }, '', '');
    setTab(newTab);
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const t = e.state?.tab || 'dashboard';
      try { localStorage.setItem('vm_tab', t); } catch {}
      setTab(t);
    };
    window.addEventListener('popstate', onPop);
    // Set initial history entry with the restored tab
    const initialTab = (() => { try { return localStorage.getItem('vm_tab') || 'dashboard'; } catch { return 'dashboard'; } })();
    window.history.replaceState({ tab: initialTab }, '', '');
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [phase, setPhaseState] = useState('pre');
  const [lbSelected, setLbSelected] = useState(null);
  const [viewUser, setViewUser] = useState(null);

  const handleShowTips = (r) => {
    setViewUser(r);
    setTab('tips');
  };
  const [adminMessage, setAdminMessageState] = useState('');
  const [showMsgPopup, setShowMsgPopup] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tickerScroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
      @keyframes fieldPulse {
        0%   { box-shadow: 0 0 0 0 rgba(255,215,0,0); border-color: rgba(255,255,255,.15); }
        40%  { box-shadow: 0 0 0 4px rgba(255,215,0,.35); border-color: rgba(255,215,0,.8); }
        100% { box-shadow: 0 0 0 0 rgba(255,215,0,0); border-color: rgba(255,255,255,.15); }
      }
      @keyframes bannerGoal {
        0%, 100% { box-shadow: 0 0 8px 2px rgba(74,222,128,.3); border-color: rgba(74,222,128,.7); }
        50% { box-shadow: 0 0 18px 6px rgba(74,222,128,.6); border-color: rgba(74,222,128,1); }
      }
      @keyframes bannerYellowBlink {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0); border-color: rgba(255,215,0,.2); }
        50% { box-shadow: 0 0 16px 5px rgba(255,215,0,.7); border-color: rgba(255,215,0,1); }
      }
      @keyframes bannerRedBlink {
        0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); border-color: rgba(220,38,38,.2); }
        50% { box-shadow: 0 0 16px 5px rgba(220,38,38,.8); border-color: rgba(220,38,38,1); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const unsub = subscribeAdminMessage(setAdminMessageState);
    return unsub;
  }, []);

  const handleLogin = u => {
    try { localStorage.setItem('vm_user', JSON.stringify(u)); } catch {}
    setUser(u);
    setTab('dashboard');
  };
  const handleLogout = () => {
    try { localStorage.removeItem('vm_user'); localStorage.removeItem('vm_tab'); } catch {}
    setUser(null);
    setTab('dashboard');
  };

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePhase(setPhaseState);
    return unsub;
  }, [user]);

  useEffect(() => { window.scrollTo(0,0); }, [tab]);
  useEffect(() => {
    if (!user) return;
    updatePresence(user.username, user.displayName);
    const interval = setInterval(() => updatePresence(user.username, user.displayName), 30000);
    return () => clearInterval(interval);
  }, [user]);



  useEffect(() => {
    if (!user?.isAdmin) return;
    const check = async () => {
      const auto = getAutoPhase();
      const cur = await getPhase();
      if (auto !== cur) {
        await setPhase(auto);
        // Trigger auto-fill for brukere som mangler tips når fase låser
        if (auto.endsWith('_lock')) {
          await autoFillMissingTips(auto);
        }
      }
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [user]); // eslint-disable-line

  if (!user) return <AuthScreen onLogin={handleLogin} />;
  return (
    <div style={C.app}>
      <Banner user={user} tab={tab} setTab={t => { setViewUser(null); setTabWithHistory(t); }} phase={phase} onLogout={handleLogout}
        adminMessage={adminMessage} onAdminMessageClick={() => setShowMsgPopup(true)} />
      <div style={C.main}>
        {tab === 'dashboard'   && <Dashboard me={user} phase={phase} onShowTips={handleShowTips} setTab={setTabWithHistory} />}
        {tab === 'leaderboard' && <Leaderboard me={user} phase={phase} initialSelected={lbSelected} onClearSelected={() => setLbSelected(null)} onShowTips={handleShowTips} />}
        {tab === 'tips'        && !user.isAdmin && <TipsForm me={user} phase={phase} viewUser={viewUser} />}
        {tab === 'chat'       && !user.isAdmin && <ChatPage me={user} />}
        {tab === 'video'       && !user.isAdmin && <VideoChat me={user} />}
        {tab === 'info'        && !user.isAdmin && <InfoPage />}
        {tab === 'panel'       && !user.isAdmin && <PanelPage me={user} />}
        {tab === 'admin'       && user.isAdmin  && <AdminPanel />}
      </div>
      <div style={{ textAlign:'center', padding:'12px 16px 48px', fontSize:11, color:'rgba(255,255,255,.2)', fontFamily:"'Fira Code',monospace", letterSpacing:0.5 }}>
        VM-tipping 2026 · <a href="https://heiarosenb.org" style={{ color:'rgba(255,255,255,.25)', textDecoration:'none' }}>HeiaRosenb.org</a>
        {' '}© 2026 Vetle Baden Skatvoldsmyr · Ønsker du å bruke koden så spør :)
      </div>
      <DeadlineBar user={user} isAdmin={user.isAdmin} />
      <VMCountdownBar />
      {/* Permanent goal-confetti canvases – always in DOM so goal bursts work on any page */}
      <canvas id="vm-goal-confetti-back"  style={{ position:'fixed', inset:0, zIndex:9998, pointerEvents:'none', width:'100%', height:'100%' }} />
      <canvas id="vm-goal-confetti-front" style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none', width:'100%', height:'100%' }} />
      {podiumMode && !podiumDismissed && (
        <>
          <PodiumPopup
            gold={podiumPlayers.gold}
            silver={podiumPlayers.silver}
            bronze={podiumPlayers.bronze}
            onClose={() => setPodiumDismissed(true)}
          />
        </>
      )}
      <YouTubePlayer />
      {showMsgPopup && <AdminMessagePopup message={adminMessage} onClose={() => setShowMsgPopup(false)} />}
    </div>
  );
}
