import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getUser, getAllUsers, createUser, updateUser,
  getResults, setResults, getPhase, setPhase,
  getCardStats, setCardStats,
  subscribeChatMessages, sendChatMessage, deleteChatMessage,
  subscribePhase, subscribeResults,
  updatePresence, subscribeOnlineUsers,
  db,
} from './firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';
import { calcScore, calcMatchPts } from './scoring';
import { getTodaysPlayer, shuffle, isQuizScoring } from './quizPlayers';
import {
  INVITE_CODE, ADMIN_CODE,
  GROUPS, ALL_TEAMS, GROUP_MATCHES, KNOCKOUT_MATCHES, KNOCKOUT_ROUNDS,
  PHASE_OPTIONS, OPEN_PHASES, FLAGS, WS_MSGS, SPEC_FIELDS, STADIUMS,
} from './constants';
import { C } from './styles';

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
const winStatus = p => ({ open: OPEN_PHASES.has(p), ...(WS_MSGS[p] || WS_MSGS.pre) });

const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
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
          <img src="/vm-logo.png" alt="VM-tipping 2026" style={C.authLogoImg} />
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

// ── Status Bar (bottom) ─────────────────────────────────────────────
function StatusBar({ phase, isAdmin }) {
  const [visible, setVisible] = useState(true);
  const ws = winStatus(phase);
  if (isAdmin || !visible) return null;
  const isOpen = ws.open;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isOpen ? 'rgba(0,80,30,.92)' : 'rgba(100,20,20,.92)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      color: isOpen ? '#a0ffb8' : '#ffaaaa',
      height: 32, fontSize: 12, fontWeight: 600, letterSpacing: 1,
      borderTop: `1px solid ${isOpen ? 'rgba(100,255,150,.15)' : 'rgba(255,100,100,.15)'}`,
      fontFamily: "'Kanit',sans-serif",
    }}>
      {isOpen ? 'Åpent – lever dine tips!' : ws.label}
      <button onClick={() => setVisible(false)} style={{
        position: 'absolute', right: 12,
        background: 'rgba(255,255,255,.15)', border: 'none',
        color: 'rgba(255,255,255,.6)', borderRadius: '50%',
        width: 18, height: 18, cursor: 'pointer', fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit',
      }}>×</button>
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
                <span style={{ fontSize:14, color:'#FFD700', fontFamily:"'Kanit',sans-serif", fontWeight:700, letterSpacing:0.5, textAlign:'center' }}>{user.displayName}</span>
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
                style={{ display:'flex', alignItems:'center', gap:12, width:'100%', background: isOn?`${color}18`:'transparent', border:'none', borderLeft: isOn?`4px solid ${color}`:'4px solid transparent', color: isOn?color:'rgba(255,255,255,.8)', padding:'14px 20px', cursor:'pointer', fontFamily:"'Kanit',sans-serif", fontSize:16, fontWeight:600, textAlign:'left' }}>
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


// Format fulltreff as ⚡×N
function renderFulltreff(count) {
  if (!count || count === 0) return null;
  return (
    <span style={{fontSize:12,color:'#FFD700',fontWeight:700,whiteSpace:'nowrap'}}>⚡×{count}</span>
  );
}

// Online users popup indicator
function OnlineIndicator({ onlineUsers }) {
  const [show, setShow] = useState(false);
  const isMobile = useIsMobile();
  return (
    <div style={{ position:'relative' }}
      onMouseEnter={() => !isMobile && setShow(true)}
      onMouseLeave={() => !isMobile && setShow(false)}
      onClick={() => isMobile && setShow(s => !s)}>
      <span style={{ fontSize:12, color:'#4ade80', fontFamily:"'Fira Code',monospace", display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 6px #4ade80' }}/>
        {onlineUsers.length} online
      </span>
      {show && (
        <>
          {isMobile && <div onClick={() => setShow(false)} style={{ position:'fixed', inset:0, zIndex:98 }}/>}
          <div style={{
            position:'absolute', top:'100%', right:0, zIndex:99,
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
  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) return null;

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;
    return { text, botId: expert.id, botName: expert.name };
  } catch(e) {
    console.error('Bot summary error:', e);
    return null;
  }
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
  if (!process.env.REACT_APP_ANTHROPIC_KEY) return null;
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

function PaniniCard({ player, blur, showName, compact, quizLabel }) {
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

  const w          = compact ? 100 : 140;
  const imgH       = compact ? 110 : 143;
  const nameBarH   = compact ? 20  : 26;
  const stripeH    = compact ? 14  : 18;
  const borderW    = compact ? 2.5 : 3;
  const logoSize   = compact ? 32  : 44;
  const yearLogoH  = compact ? 10  : 14;
  const flagH      = compact ? 11  : 14;
  const numSize    = compact ? 7   : 9;

  const yearLogoSrc    = `/vm-logos/${player.year}.png`;
  const vmHostName     = VM_HOST_NAME[player.year] || `VM ${player.year}`;
  const playerFlagCode = COUNTRY_CODES[player.country];

  return (
    <div style={{
      width: w,
      borderRadius: 8,
      overflow: 'hidden',
      border: `${borderW}px solid #f0d080`,
      boxShadow: '0 4px 16px rgba(0,0,0,.6)',
      background: '#f5e6c0',
      flexShrink: 0,
      position: 'relative',
      fontFamily: "'Kanit',sans-serif",
    }}>

      {/* ── TOPP-STRIPE: vertsnavn venstre, VM-logo (år-spesifikk) høyre ── */}
      <div style={{
        background: '#f0d080',
        height: stripeH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${compact ? 5 : 6}px`,
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
          fontFamily: "'Kanit',sans-serif",
        }}>
          #{player.num}
        </div>
      </div>

      {/* ── BLÅ LINJA: navn sentrert, landflagg absolutt til høyre ── */}
      <div style={{
        background: '#003087',
        height: nameBarH,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Navn / quiz-label / blur – alltid perfekt sentrert */}
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
            maxWidth: '80%',
          }}>
            {player.name}
          </span>
        ) : null}

        {/* Landflagg – absolutt posisjonert til høyre, 3px padding */}
        {playerFlagCode && (
          <img
            src={`https://flagcdn.com/w40/${playerFlagCode}.png`}
            alt={player.country}
            style={{
              position: 'absolute',
              right: 3,
              height: flagH,
              width: 'auto',
              objectFit: 'cover',
              borderRadius: 2,
            }}
          />
        )}
      </div>

      {/* ── BUNN-STRIPE: PANINI venstre, FIFA WORLD CUP høyre ── */}
      <div style={{
        background: '#f0d080',
        height: stripeH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${compact ? 5 : 6}px`,
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
          fontSize: compact ? 5 : 6,
          color: '#555',
          fontWeight: 700,
        }}>
          FIFA WORLD CUP
        </span>
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

    const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
    if (!apiKey) {
      // Fallback uten API
      const fallbacks = correct
        ? ['Godt jobba! Nytt kort kl. 06:00.', 'Imponerende! Nytt kort kl. 06:00.']
        : ['Bedre lykke neste gang! Nytt kort kl. 06:00.', 'Ikke lett! Nytt kort kl. 06:00.'];
      setComment(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      setLoading(false);
      return;
    }

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
      .then(r => r.json())
      .then(d => { setComment(d.content?.[0]?.text || ''); })
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
      <div style={{ fontSize: 11, color: expert.color, fontWeight: 700, marginBottom: 4, fontFamily: "'Kanit',sans-serif" }}>
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
        <div style={{ fontSize:11, color:'rgba(255,215,0,.7)', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, marginBottom:14, textAlign:'center' }}>
          Hvem er dette? • VM {player.year}
        </div>
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
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:bg, border, borderRadius:8, padding:'10px 14px', marginBottom:8, cursor: answered ? 'default' : 'pointer', fontFamily:"'Kanit',sans-serif", fontSize:13, color: answered && isCorrect ? '#FFD700' : '#e8edf8', fontWeight: answered && isCorrect ? 700 : 400, textAlign:'left' }}>
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
                  <span style={{ fontSize:12, color:'rgba(255,255,255,.4)', fontStyle:'italic' }}>{r.answer}</span>
                  <span style={{ fontSize:13 }}>{r.correct ? '✅' : '❌'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>, document.body
  );
}

function QuizWidget({ username }) {
  const player = getTodaysPlayer();
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
        <PaniniCard player={player} blur={!myAnswer} showName={!!myAnswer} quizLabel={!myAnswer ? quizLabel : undefined} compact />
      </div>
      {showPopup && (
        <QuizPopup player={player} username={username} onClose={() => setShowPopup(false)}
          onAnswered={() => getQuizAnswer(username, player.id).then(a => { if (a) setMyAnswer(a); })} />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function Dashboard({ me, phase, onShowTips, setTab }) {
  const isMobile = useIsMobile();
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
  const chatBot = useRef(null);

  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeOnlineUsers(setOnlineUsers); return u; }, []);
  useEffect(() => { const u = subscribeMatchSummaries(setSummaries); return u; }, []);
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

    // @funfact – random expert shares a VM fun fact
    if (t.toLowerCase().includes('@funfact')) {
      const expert = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];
      setTimeout(async () => {
        const prompt = `${expert.personality}\n\nKom med én interessant funfact om fotball-VM (FIFA World Cup). Finn noe genuint interessant, overraskende eller morsomt – historisk statistikk, rekorder, kuriøse hendelser, underdog-historier. Presenter det som deg selv med din personlighet og dialekt. Maks 3 setninger.`;
        const reply = await chatWithExpert(expert, prompt, []);
        await sendChatMessage(expert.name, `🎲 Funfact: ${reply}`, '');
      }, 800);
      return;
    }

    // @mentions
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
        const reply = await chatWithExpert(expert, t, []);
        await sendChatMessage(expert.name, reply, '');
      }, 1000 + i * 2000);
    });
  };

  const saveSummary = async (matchId) => {
    if (!summaryText.trim()) return;
    await setMatchSummary(matchId, summaryText.trim(), me.displayName);
    setEditingSummary(null); setSummaryText('');
  };

  const fmt = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  };

  const medals = ['🥇', '🥈', '🥉'];
  const myRank = users.findIndex(u => u.id === me.username) + 1;
  const finishedMatches = GROUP_MATCHES.filter(m => {
    const r = results[m.id];
    return r && r.home !== undefined && r.away !== undefined;
  }).slice(-8).reverse();

  return (
    <>
    <div>
      {/* Stats widgets */}
      {(() => {
        const finishedCount = GROUP_MATCHES.filter(m => results[m.id]?.home !== undefined).length;
        const totalGoals = GROUP_MATCHES.reduce((s,m) => {
          const r = results[m.id];
          return r?.home !== undefined ? s + (r.home||0) + (r.away||0) : s;
        }, 0);
        const myPts = users.find(u => u.id === me.username)?.total || 0;
        const stats = [
          { num: myRank ? `#${myRank}` : '–', label: isMobile ? 'Plass' : 'Din plassering' },
          { num: myPts, label: isMobile ? 'Poeng' : 'Dine poeng' },
          { num: users.length, label: 'Deltakere' },
          { num: finishedCount, label: isMobile ? 'Kamper' : 'Spilte kamper' },
          { num: totalGoals, label: isMobile ? 'Mål' : 'Antall mål' },
        ];
        return (
          <div style={{
            ...(isMobile ? C.statsRowMobile : C.statsRowDesktop),
            alignItems: 'stretch',
            gridTemplateColumns: isMobile ? undefined : 'repeat(5, 1fr) auto',
          }}>
            {stats.map(({ num, label }) => (
              <div key={label} style={isMobile ? { ...C.statWidget, ...C.statWidgetMobile } : C.statWidget}>
                <div style={C.statNum}>{num}</div>
                <div style={C.statLabel}>{label}</div>
              </div>
            ))}
            <QuizWidget username={me.username} />
          </div>
        );
      })()}
      <div style={isMobile ? C.dashGrid3Mobile : C.dashGrid3}>
      {/* Tabell */}
      <div style={{ ...C.card, ...C.dashCardFixed }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => setTab('leaderboard')}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Tabell</span>
          <span style={{ fontSize:11, color:'rgba(255,215,0,.6)', fontFamily:"'Fira Code',monospace" }}>Se full tabell →</span>
        </div>
        <div style={C.dashCardFixedBody}>
          {users.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', padding: 20, fontSize: 13 }}>Ingen deltakere ennå.</p>}
          {users.slice(0, 8).map((r, i) => {
            const tipsLocked = !OPEN_PHASES.has(phase);
            const canView = tipsLocked || r.id === me.username;
            return (
            <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}), cursor: canView ? 'pointer' : 'default' }}
              onClick={() => canView && onShowTips && onShowTips(r)}>
              <span style={C.lbRank}>{medals[i] || <span style={{ color: '#4a5a80', fontSize: 13 }}>{i + 1}</span>}</span>
              <span style={{ ...C.lbName, textDecoration: canView ? 'underline' : 'none', textDecorationColor:'rgba(255,215,0,.3)' }}>
                {r.displayName}
                {!canView && <span style={C.lbLockIcon}>🔒</span>}
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
          {users.length > 8 && (
            <div style={{ textAlign:'center', padding:'8px 0 4px', borderTop:'1px solid rgba(255,255,255,.05)', marginTop:4 }}>
              <button onClick={() => setTab('leaderboard')}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:12, cursor:'pointer', fontFamily:"'Fira Code',monospace" }}>
                +{users.length - 8} til
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <div style={{ ...C.card, ...C.dashCardFixed }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => setTab('chat')}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Chat</span>
          <div style={{ display:'flex', alignItems:'center', gap:10 }} onClick={e => e.stopPropagation()}>
            <OnlineIndicator onlineUsers={onlineUsers} />
            <button onClick={e => { e.stopPropagation(); setChatFullscreen(f => !f); }} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }} title="Fullskjerm">⛶</button>
          </div>
        </div>
        <div style={C.dashCardFixedChat} ref={chatBoxRef}>
          {msgs.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Si hei! 👋</p>}
          {msgs.map((m, i) => {
            const mine = m.user === me.displayName;
            const botExpert = PANEL_EXPERTS.find(e => e.name === m.user);
            const botColor = botExpert?.color;
            return (
                <div key={m.id || i} style={{ ...C.chatMsg, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                  <span style={{ ...C.chatBubble, background: mine ? 'rgba(30,45,80,.9)' : 'rgba(20,25,40,.9)', border: `1px solid ${mine ? 'rgba(42,61,112,.8)' : 'rgba(42,48,80,.6)'}`, ...(botColor ? { borderLeft: `3px solid ${botColor}` } : {}) }}>
                    {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:200,borderRadius:8,display:'block'}} /> : renderChatText(m.text)}
                  </span>
                  <div style={{display:'flex',gap:8,alignItems:'center',justifyContent: mine?'flex-end':'flex-start'}}>
                    <span style={{...C.chatUser,color: mine?'rgba(255,215,0,.7)': botColor || 'rgba(255,255,255,.45)'}}>{m.user}</span>
                    <span style={C.chatTime}>{fmt(m.ts)}</span>
                    {mine && <button onClick={() => deleteChatMessage(m.id)} style={{background:'none',border:'none',color:'rgba(255,100,100,.4)',cursor:'pointer',fontSize:11,padding:'0 2px',lineHeight:1}} title="Slett">✕</button>}
                  </div>
                </div>
            );
          })}
        </div>
        <div style={C.chatInputRow}>
          <label style={{cursor:'pointer',padding:'6px 10px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:16,flexShrink:0}} title="Last opp bilde">
            🖼️
            <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
              const file=e.target.files[0]; if(!file)return;
              const dataUrl = await compressImage(file);
              sendChatMessage(me.displayName,'',dataUrl);
              e.target.value='';
            }}/>
          </label>
          <input style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 13, padding: '8px 12px' }}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()}
            placeholder="Skriv melding… (lim inn bilde med Ctrl+V)"
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
          <button style={{ ...C.btnCyan, padding: '8px 16px', fontSize: 12 }} onClick={sendMsg}>Send</button>
        </div>
      </div>

      {/* Kamper */}
      <div style={{ ...C.card, ...C.dashCardFixed }}>
        <div style={{ ...C.cardHeader, cursor:'pointer' }} onClick={() => setTab('leaderboard')}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Siste kamper</span>
          <div style={{ display:'flex', alignItems:'center', gap:10 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize:11, color:'rgba(255,215,0,.6)', fontFamily:"'Fira Code',monospace" }}>Alle kamper →</span>
            <button onClick={e => { e.stopPropagation(); setMatchesFullscreen(f => !f); }} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }} title="Fullskjerm">⛶</button>
          </div>
        </div>
        {finishedMatches.length === 0 && (
          <p style={{ color: '#4a5a80', textAlign: 'center', padding: 24, fontSize: 13 }}>
            Ingen kampresultater ennå – admin legger inn etter kampene.
          </p>
        )}
        <div style={C.dashCardFixedMatchList}>
          {finishedMatches.map(m => {
            const r = results[m.id];
            const sum = summaries[m.id];
            const isEditing = editingSummary === m.id;
            return (
              <div key={m.id} style={{ ...C.matchCard, borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:0 }}>
                <div style={C.matchTeams}>
                  <span style={C.matchTeam}><Flag team={m.home} /> {m.home}</span>
                  <span style={C.matchScore}>{r.home} – {r.away}</span>
                  <span style={{ ...C.matchTeam, textAlign: 'right' }}>{m.away} <Flag team={m.away} /></span>
                </div>
                <div style={C.matchScorers}>Gruppe {m.group} · {fmtDate(m.date)}{m.time ? ' · ' + m.time : ''}</div>
                {/* Spillers kampreferat */}
                {sum?.text ? (
                  <div style={{ marginTop:6 }}>
                    <div style={C.matchSummaryText}>{sum.text}</div>
                    <div style={C.matchSummaryAuthor}>✍️ {sum.author}</div>
                  </div>
                ) : isEditing ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea style={{ ...C.ta, fontSize: 12, marginBottom: 6 }} rows={3}
                      value={summaryText} onChange={e => setSummaryText(e.target.value)}
                      placeholder="Skriv et kort kampreferat…" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...C.btnGold, padding: '6px 14px', fontSize: 11 }} onClick={() => saveSummary(m.id)}>Lagre</button>
                      <button style={{ ...C.btnSecondary, padding: '6px 14px', fontSize: 11 }} onClick={() => setEditingSummary(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <button style={C.matchSummaryBtn} onClick={() => { setEditingSummary(m.id); setSummaryText(''); }}>
                    ✍️ Skriv kampreferat
                  </button>
                )}
                {/* Bot-sammendrag */}
                {sum?.botText ? (
                  <div style={{ ...C.botSummaryBox, borderLeft: `3px solid ${PANEL_EXPERTS.find(e => e.name === sum.botName)?.color || 'rgba(255,215,0,.5)'}`, paddingLeft: 10 }}>
                    <div style={C.botSummaryText}>{sum.botText}</div>
                    <div style={{ ...C.botSummaryAuthor, color: PANEL_EXPERTS.find(e => e.name === sum.botName)?.color || 'rgba(255,215,0,.5)' }}>
                      {PANEL_EXPERTS.find(e => e.name === sum.botName)?.emoji || '🤖'} {sum.botName}
                    </div>
                  </div>
                ) : (
                  <BotSummaryTrigger matchId={m.id} match={m} results={results} users={users} summaries={summaries} />
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
              {msgs.map((m, i) => {
                const mine = m.user === me.displayName;
                const botExpert = PANEL_EXPERTS.find(e => e.name === m.user);
                const botColor = botExpert?.color;
                return (
                  <div key={m.id||i} style={{ ...C.chatMsg, alignSelf: mine?'flex-end':'flex-start' }}>
                    <span style={{ ...C.chatBubble, background: mine?'rgba(30,45,80,.9)':'rgba(20,25,40,.9)', border:`1px solid ${mine?'rgba(42,61,112,.8)':'rgba(42,48,80,.6)'}`, ...(botColor ? { borderLeft:`3px solid ${botColor}` } : {}) }}>
                      {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:300,borderRadius:8,display:'block'}}/> : renderChatText(m.text)}
                    </span>
                    <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:mine?'flex-end':'flex-start'}}>
                      <span style={{...C.chatUser,color:mine?'rgba(255,215,0,.7)':botColor || 'rgba(255,255,255,.45)'}}>{m.user}</span>
                      <span style={C.chatTime}>{fmt(m.ts)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBot}/>
            </div>
            <div style={{ ...C.chatInputRow, flexShrink:0 }}>
              <label style={{cursor:'pointer',padding:'6px 10px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:16,flexShrink:0}}>
                🖼️<input type="file" accept="image/*,image/gif" style={{display:'none'}} onChange={e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>sendChatMessage(me.displayName,'',ev.target.result);reader.readAsDataURL(file);e.target.value='';}}/>
              </label>
              <input style={{...C.inp,marginBottom:0,flex:1,fontSize:13,padding:'8px 12px'}}
                value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendMsg()}
                placeholder="Skriv melding…"/>
              <button style={{...C.btnCyan,padding:'8px 16px',fontSize:12}} onClick={sendMsg}>Send</button>
            </div>
          </div>
    
    {matchesFullscreen && (
      <div style={{ position:'fixed', inset:0, zIndex:999, background:'#0a0e1a', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ ...C.cardHeader, flexShrink:0, position:'sticky', top:0, background:'#0a0e1a', zIndex:1 }}>
          <span style={C.cardTitle}><span style={C.cardTitleDot}/> Siste kamper – Fullskjerm</span>
          <button onClick={() => setMatchesFullscreen(false)} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ flex:1, padding:'0 0 40px 0' }}>
          {finishedMatches.length === 0 && (
            <p style={{ color:'#4a5a80', textAlign:'center', padding:40, fontSize:13 }}>Ingen kampresultater ennå.</p>
          )}
          {finishedMatches.map(m => {
            const r = results[m.id];
            const sum = summaries[m.id];
            const isEditing = editingSummary === m.id;
            const botExpert = sum?.botName ? PANEL_EXPERTS.find(e => e.name === sum.botName) : null;
            const botColor = botExpert?.color || 'rgba(255,215,0,.5)';
            return (
              <div key={m.id} style={{ ...C.matchCard, borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:0 }}>
                <div style={C.matchTeams}>
                  <span style={C.matchTeam}><Flag team={m.home} /> {m.home}</span>
                  <span style={C.matchScore}>{r.home} – {r.away}</span>
                  <span style={{ ...C.matchTeam, textAlign:'right' }}>{m.away} <Flag team={m.away} /></span>
                </div>
                <div style={C.matchScorers}>Gruppe {m.group} · {fmtDate(m.date)}{m.time ? ' · ' + m.time : ''}</div>
                {sum?.text && (
                  <div style={{ marginTop:6 }}>
                    <div style={C.matchSummaryText}>{sum.text}</div>
                    <div style={C.matchSummaryAuthor}>✍️ {sum.author}</div>
                  </div>
                )}
                {!sum?.text && isEditing && (
                  <div style={{ marginTop:8 }}>
                    <textarea style={{ ...C.ta, fontSize:12, marginBottom:6 }} rows={3}
                      value={summaryText} onChange={e => setSummaryText(e.target.value)}
                      placeholder="Skriv et kort kampreferat…" />
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ ...C.btnGold, padding:'6px 14px', fontSize:11 }} onClick={() => saveSummary(m.id)}>Lagre</button>
                      <button style={{ ...C.btnSecondary, padding:'6px 14px', fontSize:11 }} onClick={() => setEditingSummary(null)}>Avbryt</button>
                    </div>
                  </div>
                )}
                {!sum?.text && !isEditing && (
                  <button style={C.matchSummaryBtn} onClick={() => { setEditingSummary(m.id); setSummaryText(''); }}>✍️ Skriv kampreferat</button>
                )}
                {sum?.botText && (
                  <div style={{ ...C.botSummaryBox, borderLeft:`3px solid ${botColor}`, paddingLeft:10 }}>
                    <div style={C.botSummaryText}>{sum.botText}</div>
                    <div style={{ ...C.botSummaryAuthor, color:botColor }}>{botExpert?.emoji || '🤖'} {sum.botName}</div>
                  </div>
                )}
                {!sum?.botText && (
                  <BotSummaryTrigger matchId={m.id} match={m} results={results} users={users} summaries={summaries} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
    )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════════════════════════════
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
            <span style={{ ...C.lbName, textDecoration: canView ? 'underline' : 'none', textDecorationColor:'rgba(255,215,0,.3)' }}>
              {r.displayName}
              {!canView && <span style={C.lbLockIcon}>🔒</span>}
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
      fontSize: 15, fontFamily: "'Kanit',sans-serif", fontWeight: 800, minWidth: 20,
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
function MatchInfoPopup({ match, onClose }) {
  const s = STADIUMS[match.stadium] || {};
  const fmtD = d => { if (!d) return ''; const [y,m,day] = d.split('-'); return `${day}.${m}.${y}`; };
  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:899 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position:'fixed', zIndex:900, width:280,
        bottom:28, left:12,
        background:'rgba(13,18,48,.97)',
        border:'2px solid rgba(255,215,0,.3)', borderRadius:14,
        overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.8)',
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
          <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', lineHeight:1.9 }}>
            <div>📅 {fmtD(match.date)} · {match.time} CEST</div>
            {s.name && <div>🏟️ {s.name}</div>}
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
          return (
            <div key={pos} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ color:'rgba(255,255,255,.4)', fontSize:12, width:16 }}>{pos+1}.</span>
              {grpOk ? (
                <select style={{ ...C.sel, flex:1, opacity:1 }} value={picked} onChange={e => setOrd(group, pos, e.target.value)}>
                  <option value=''>– Velg –</option>
                  {teams.map(t => <option key={t} value={t}>{FLAGS[t]||''} {t}</option>)}
                </select>
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
            <span style={{ fontSize:18, fontWeight:800, color:'#FFD700', fontFamily:"'Kanit',sans-serif" }}>{totalGrpPts}</span>
          </div>
        )}

      </div>
    </>, document.body
  );
}

function TipsForm({ me, phase, viewUser }) {
  const isOwn = !viewUser || viewUser.id === me.username;
  const userId = viewUser ? viewUser.id : me.username;

  const [tips, setTips]   = useState({});
  const [grpO, setGrpO]   = useState({});
  const [spec, setSpec]   = useState({});
  const [botSource, setBotSource] = useState(null);
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
      if (u) { setTips(u.tips || {}); setGrpO(u.groupOrders || {}); setSpec(u.specialTips || {}); setBotSource(u.botSource || null); }
      setLoading(false);
    });
  }, [userId]);

  const grpOk = isOwn && phase === 'pre';
  const koOk  = isOwn && OPEN_PHASES.has(phase);

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
    setTips(keptTips); setGrpO(keptGrpO); setSpec(keptSpec);
    await updateUser(me.username, { tips: keptTips, groupOrders: keptGrpO, specialTips: keptSpec });
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const save = async () => {
    await updateUser(me.username, { tips, groupOrders: grpO, specialTips: spec });
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
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot} /> {isOwn ? 'Mine tips' : `${displayName}s tips`}</span>
      </div>
      <div style={C.cardBody}>
        {botSource && isOwn && (
          <div style={C.botBanner}>🤖 Disse tipsene ble generert av <strong>{PANEL_EXPERTS.find(e=>e.id===botSource)?.name || botSource}</strong></div>
        )}

        {/* Spesialtips */}
        <div style={C.specBox}>
          <span style={C.secH}>🌟 Spesialtips – låses før gruppespillet</span>
          {SPEC_FIELDS.map(({ key, label, pts }) => {
            const correctVal = results[key];
            const tipVal = spec[key];
            const correct = correctVal && tipVal && tipVal === correctVal;
            const specPts = correct ? pts : null;
            return (
              <div key={key} style={C.specRow}>
                <span style={C.specLabel}>{label}</span>
                <span style={C.ptsBadge}>{pts}p</span>
                {grpOk ? (
                  key === 'topscorer' ? (
                    <input style={{ ...C.inp, marginBottom:0, flex:1, fontSize:13, padding:'6px 10px' }}
                      value={spec[key]||''} onChange={e => setSp(key, e.target.value)}
                      placeholder="Skriv spillernavn (f.eks. Mbappé)" />
                  ) : (
                    <>
                      <select style={C.sel} value={spec[key]||''} onChange={e => setSp(key, e.target.value)}>
                        <option value=''>– Velg –</option>
                        {ALL_TEAMS.map(t => { const code = COUNTRY_CODES[t]; return <option key={t} value={t}>{code ? String.fromCodePoint(...[...code.toUpperCase()].map(c=>c.charCodeAt(0)+127397)) : (FLAGS[t]||'')} {t}</option>; })}
                      </select>
                      {spec[key] && <Flag team={spec[key]} />}
                    </>
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

        {/* Tabs */}
        <div style={C.tabs}>
          {['group','knockout'].map(t => (
            <button key={t} style={{ ...C.tab, ...(tab===t ? C.tabOn : {}) }} onClick={() => setTab(t)}>
              {t === 'group' ? '📋 Gruppespill' : '🏟️ Sluttspill'}
            </button>
          ))}
        </div>

        {tab === 'group' && <>
          {/* Group buttons */}
          <div style={C.gTabs}>
            {Object.keys(GROUPS).map(g => (
              <button key={g} style={{ ...C.gTab }}
                onClick={e => { e.stopPropagation(); setGrpPopup(g); }}>
                Gr.{g}
              </button>
            ))}
          </div>

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
                <div key={m.id} style={{...C.mRow, gap:4, flexWrap:'nowrap', padding:'6px 8px', alignItems:'center'}}>
                  {/* Date/info box */}
                  <div onClick={e => { e.stopPropagation(); setMatchPopup(m); }}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:48,background:'rgba(255,255,255,.05)',borderRadius:6,padding:'3px 5px',flexShrink:0,cursor:'pointer',transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,215,0,.12)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}>
                    <span style={{fontSize:9,color:'rgba(255,255,255,.7)',fontFamily:"'Kanit',sans-serif",whiteSpace:'nowrap'}}>{fmtDate(m.date)}</span>
                    {m.time && <span style={{fontSize:8,color:'rgba(255,255,255,.4)',fontFamily:"'Kanit',sans-serif"}}>{m.time}</span>}
                    <span style={{fontSize:8,color:'rgba(255,215,0,.5)',fontFamily:"'Kanit',sans-serif"}}>Gruppe {m.group}</span>
                  </div>
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
                return (
                  <div key={m.id} style={{...C.mRow, gap:4, flexWrap:'nowrap', padding:'6px 8px', alignItems:'center'}}>
                    {/* Info box */}
                    <div onClick={e => { e.stopPropagation(); setMatchPopup(m); }}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:48,background:'rgba(255,255,255,.05)',borderRadius:6,padding:'3px 5px',flexShrink:0,cursor:'pointer',transition:'background .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,215,0,.12)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}>
                      <span style={{fontSize:9,color:'rgba(255,255,255,.5)',fontFamily:"'Fira Code',monospace",whiteSpace:'nowrap'}}>Kamp {m.matchNum}</span>
                      {m.date && <span style={{fontSize:9,color:'rgba(255,255,255,.7)',fontFamily:"'Kanit',sans-serif",whiteSpace:'nowrap'}}>{fmtDate(m.date)}</span>}
                      {m.time && <span style={{fontSize:8,color:'rgba(255,255,255,.4)',fontFamily:"'Kanit',sans-serif"}}>{m.time}</span>}
                    </div>
                    {/* Home */}
                    <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-end',minWidth:0}}>
                      <span style={{fontSize:11,color:'rgba(255,255,255,.7)',textAlign:'right',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.home}</span>
                      <Flag team={m.home} size={18}/>
                    </div>
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
                    <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-start',minWidth:0}}>
                      <Flag team={m.away} size={18}/>
                      <span style={{fontSize:11,color:'rgba(255,255,255,.7)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.away}</span>
                    </div>
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
          <button style={{ ...C.btnGold, width:'100%', marginTop:16, opacity:dirty?1:.5 }} onClick={save}>
            {saved ? '✅ Lagret!' : '💾 Lagre mine tips'}
          </button>
          <button style={{ ...C.btnDanger, width:'100%', marginTop:8 }} onClick={resetTips}>
            🗑️ Nullstill tips
          </button>
          {dirty && <p style={{ color:'#f59e0b', fontSize:11, textAlign:'center', marginTop:6, fontFamily:"'Fira Code',monospace" }}>⚠ Ulagrede endringer</p>}
        </>}
      </div>

      {grpPopup && (
        <GroupOrderPopup group={grpPopup} grpO={grpO} setOrd={setOrd} results={results} grpOk={grpOk} onClose={() => setGrpPopup(null)} />
      )}
      {matchPopup && (
        <MatchInfoPopup match={matchPopup} onClose={() => setMatchPopup(null)} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  VIDEO CHAT
// ══════════════════════════════════════════════════════════════════════
function VideoChat({ me }) {
  const locRef = useRef(null), remRef = useRef(null), pcRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [offer, setOffer] = useState('');
  const [answer, setAnswer] = useState('');
  const [inOffer, setInOffer] = useState('');
  const [inAnswer, setInAnswer] = useState('');

  const getMedia = async () => { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); locRef.current.srcObject = s; return s; };
  const mkPC = s => { const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); s.getTracks().forEach(t => pc.addTrack(t, s)); pc.ontrack = e => { remRef.current.srcObject = e.streams[0]; }; pcRef.current = pc; return pc; };
  const startCall = async () => { try { setStatus('calling'); const s = await getMedia(), pc = mkPC(s); pc.onicecandidate = e => { if (!e.candidate) setOffer(JSON.stringify(pc.localDescription)); }; await pc.setLocalDescription(await pc.createOffer()); } catch { setStatus('error'); } };
  const acceptCall = async () => { try { setStatus('answering'); const s = await getMedia(), pc = mkPC(s); await pc.setRemoteDescription(JSON.parse(inOffer)); pc.onicecandidate = e => { if (!e.candidate) setAnswer(JSON.stringify(pc.localDescription)); }; await pc.setLocalDescription(await pc.createAnswer()); } catch { setStatus('error'); } };
  const finishCall = async () => { try { await pcRef.current.setRemoteDescription(JSON.parse(inAnswer)); setStatus('connected'); } catch { setStatus('error'); } };
  const hangUp = () => { pcRef.current?.close(); if (locRef.current?.srcObject) locRef.current.srcObject.getTracks().forEach(t => t.stop()); setStatus('idle'); setOffer(''); setAnswer(''); setInOffer(''); setInAnswer(''); };

  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Videochat</span></div>
      <div style={C.cardBody}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[{ ref: locRef, label: `Du – ${me.displayName}`, muted: true }, { ref: remRef, label: 'Motpart', muted: false }].map(({ ref, label, muted }) => (
            <div key={label} style={{ position: 'relative', background: '#0b0f1a', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a3050', aspectRatio: '4/3' }}>
              <video ref={ref} autoPlay playsInline muted={muted} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 10, background: 'rgba(0,0,0,.8)', color: YEL, padding: '2px 8px', borderRadius: 4, fontFamily: "'Fira Code',monospace" }}>{label}</div>
            </div>
          ))}
        </div>
        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ ...C.btnGold, width: '100%' }} onClick={startCall}>📞 Start samtale</button>
            <div style={{ textAlign: 'center', color: '#4a5a80', fontSize: 12 }}>— eller svar på innkommende —</div>
            <textarea style={C.ta} rows={3} value={inOffer} onChange={e => setInOffer(e.target.value)} placeholder="Lim inn tilbudskode…" />
            <button style={{ ...C.btnSecondary, width: '100%' }} onClick={acceptCall} disabled={!inOffer}>📲 Svar</button>
          </div>
        )}
        {status === 'calling' && offer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={C.mono12}>Del denne koden med motparten:</p>
            <textarea style={C.ta} rows={4} readOnly value={offer} onClick={e => e.target.select()} />
            <textarea style={C.ta} rows={3} value={inAnswer} onChange={e => setInAnswer(e.target.value)} placeholder="Svarkode fra motparten…" />
            <button style={{ ...C.btnGold, width: '100%' }} onClick={finishCall} disabled={!inAnswer}>✅ Koble til</button>
          </div>
        )}
        {status === 'answering' && answer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={C.mono12}>Del svarkoden med den som ringte:</p>
            <textarea style={C.ta} rows={4} readOnly value={answer} onClick={e => e.target.select()} />
          </div>
        )}
        {status !== 'idle' && <button style={{ ...C.btnSecondary, width: '100%', marginTop: 10, color: '#ff7777' }} onClick={hangUp}>📵 Avslutt</button>}
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
      '⚠️ Er du sikker?\n\nDette nullstiller ALLE resultater:\n• Alle kampresultater (gruppe + sluttspill)\n• Grupperangeringer\n• Spesialtips-fasit\n• Kortstatistikk\n\nHandlingen kan ikke angres.'
    );
    if (!confirmed) return;
    try {
      await setDoc(doc(db, 'config', 'results'), {});
      await setDoc(doc(db, 'config', 'cards'), {});
      setResultsState({});
      setCardsState({});
      alert('✅ Alle resultater er nullstilt.');
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
        const tips = await generateExpertTips(expert);
        const newTips = {};
        Object.entries(tips).forEach(([k, v]) => {
          if (force || !existingTips[k]) newTips[k] = v;
        });
        const mergedTips = force ? newTips : { ...existingTips, ...newTips };
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
          const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;

          let specialTips = {};
          if (apiKey) {
            try {
              const res = await fetch('https://api.anthropic.com/v1/messages', {
                method:'POST',
                headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
                body: JSON.stringify({model:'claude-sonnet-4-5',max_tokens:200,messages:[{role:'user',content:specPrompt}]})
              });
              const d = await res.json();
              const t = d.content?.[0]?.text || '{}';
              specialTips = JSON.parse(t.replace(/```json|```/g,'').trim());
            } catch(e) { console.warn('Special tips failed:', e); }
          }
          specialTips.topscorer = topscorerMap[expert.id] || '';
          const mergedSpec = { ...specialTips, ...existingSpec };
          mergedSpec.topscorer = topscorerMap[expert.id] || '';
          await setDoc(doc(db, 'users', 'panel_' + expert.id), { tips: mergedTips, specialTips: mergedSpec, displayName: expert.name, password: 'bot' });
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
        <button style={C.btnDanger} onClick={resetAllResults}>
          🗑️ Nullstill resultater
        </button>
      </div>
      <div style={C.cardBody}>
        <div style={C.tabs}>
          {[['phase', 'Fase'], ['results', 'Gruppe'], ['knockout', 'Sluttspill'], ['special', 'Spesial'], ['cards', 'Kort'], ['msg', 'Melding'], ['matches', 'Kamper']].map(([t, l]) => (
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
              <select style={C.sel} value={results[`grp_${ag}`]?.[pos] || ''} onChange={e => setGrpResult(ag, pos, e.target.value)}>
                <option value=''>– Velg –</option>
                {GROUPS[ag].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
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
              { key: 'third', label: '🥉 Bronsevinner' }, { key: 'most_carded', label: '🟨 Mest kort – lag' }].map(({ key, label }) => (
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
      </div>
    </div>
  );
}


// ── Info Page ────────────────────────────────────────────────────────
function InfoPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ background:'rgba(22,27,44,.75)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:28, marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Kanit',sans-serif", fontSize:22, color:'#FFD700', textTransform:'uppercase', letterSpacing:2, marginBottom:20 }}>ℹ️ Om VM-tipping 2026</h2>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🏆 Poengsystem – Kamper</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>✅ Riktig utfall (H/U/B): <strong style={{color:'#FFD700'}}>2 poeng</strong></div>
          <div>⚽ Riktig antall mål hjemmelag: <strong style={{color:'#FFD700'}}>1 poeng</strong></div>
          <div>⚽ Riktig antall mål bortelag: <strong style={{color:'#FFD700'}}>1 poeng</strong></div>
          <div style={{marginTop:6}}>⚡ Fulltreffer (rett resultat): <strong style={{color:'#FFD700'}}>4 poeng totalt</strong></div>
          <div style={{background:'rgba(255,215,0,.07)',borderRadius:8,padding:'8px 12px',marginTop:8,border:'1px solid rgba(255,215,0,.2)'}}>
            <strong style={{color:'#FFD700'}}>⚡ SUPERBONUS:</strong> <span style={{color:'rgba(255,255,255,.8)'}}>Tipp rett resultat i en kamp med 5 mål eller mer og du får <strong style={{color:'#FFD700'}}>5 poeng</strong> – ett ekstra for å tørre å tippe høyt!</span>
          </div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>📋 Poengsystem – Grupper</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🎯 Riktig grupplassering: <strong style={{color:'#FFD700'}}>5 poeng per lag</strong></div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Maks per gruppe: 20 poeng (4 lag × 5p)</div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🌟 Spesialtips (låses før gruppespillet)</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🥇 Riktig verdensmester: <strong style={{color:'#FFD700'}}>30 poeng</strong></div>
          <div>🥈 Riktig sølvvinner: <strong style={{color:'#FFD700'}}>20 poeng</strong></div>
          <div>🥉 Riktig bronsevinner: <strong style={{color:'#FFD700'}}>10 poeng</strong></div>
          <div>⚽ Riktig toppscorer (spillernavn): <strong style={{color:'#FFD700'}}>20 poeng</strong></div>
          <div>🟨 Riktig lag med mest kort: <strong style={{color:'#FFD700'}}>10 poeng</strong></div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🃏 Daglig Quiz</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>Gjett VM-spilleren fra Panini-kortet! Ny spiller hver dag kl. 06:00.</div>
          <div style={{marginTop:4}}>🏆 Spilleren med flest rette svar ved slutten av finalen (19. juli 2026) tildeles <strong style={{color:'#FFD700'}}>0,5 ekstrapoeng</strong> i sammendraget.</div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Ved likt antall rette svar deles prisen. Bots teller ikke.</div>
        </div>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>• Alle tips leveres <strong style={{color:'#FFD700'}}>før</strong> gruppespillet starter</div>
          <div>• Sluttspill-tips kan endres mellom hver runde</div>
          <div>• Vinduet stenges 2 timer før kampstart i hver ny runde</div>
          <div>• Spesialtips (VM-vinner, toppscorer osv.) kan <strong style={{color:'#f87171'}}>ikke</strong> endres etter at gruppespillet starter</div>
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
            { date:'18. juli 2026', event:'Bronsefinalen' },
            { date:'19. juli 2026', event:'🏆 Gullfinalen' },
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
  const YT_STARTS = ['n5F-4Dd0LwU','OjY6k5aTgik','0J2QdDbelmY','dLB56lFYlBI'];
  const [startId] = useState(() => YT_STARTS[Math.floor(Math.random() * YT_STARTS.length)]);
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: 12, zIndex: 500,
      background: 'rgba(1,23,76,.95)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,215,0,.25)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      overflow: 'hidden',
      width: minimized ? 160 : 240,
      transition: 'width .3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(255,215,0,.08)',
        borderBottom: minimized ? 'none' : '1px solid rgba(255,215,0,.15)',
      }}>
        <span style={{ fontSize: 12, color: '#FFD700', fontFamily: "'Kanit',sans-serif", fontWeight: 700, letterSpacing: 1 }}>
          🎵 VM-musikk
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setMinimized(m => !m)} style={{
            background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
            borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{minimized ? '▲' : '▼'}</button>
          <button onClick={() => setVisible(false)} style={{
            background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
            borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      </div>
      <iframe
        width="240"
        height="135"
        src={`https://www.youtube.com/embed/${startId}?list=PLZ-7xLISie3crAStc-KmPn4Oausod43CV&autoplay=0&rel=0`}
        title="VM-musikk"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ display: minimized ? 'none' : 'block' }}
      />
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
    bio: 'Vokste opp i et strengt kristenkonservativt hjem i Mandal på 70-tallet, men brøt ut og meldte seg inn i rødstrømpebevegelsen i 1978 – noe som skapte bråk i søndagsskolen. Har siden forsont seg med bakgrunnen sin, og er i dag aktiv i både menigheten og i den lokale husflidsforeningen. Gift tre ganger. Hagen hennes er kåret til årets vakreste i Vest-Agder to ganger på rad. Har aldri sett en hel fotballkamp, men husker at hun syntes italienernes drakter var veldig flotte under VM i 1982. Tipper basert på estetikk, musikk og om landet generelt virker "skikkelig".',
    personality: `Du er Ragnhild Kristiansen, 60 år, fra Mandal. Du er en tidligere rødstrømpe oppvokst i et kristenkonservativt sørlandsmiljø på 70-tallet. Du har ingen peiling på fotball og tipper basert på hvilke land du liker – særlig drakter, musikk og om landet virker skikkelig og ordentlig. Du snakker varmt, litt moraliserende, og er alltid hyggelig men naiv om fotball. Du refererer gjerne til Fædrelandsvennen, kirken og sørlanske verdier. Svar alltid på norsk og hold deg i karakter. Svar kort, maks 3-4 setninger.`,
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
    img: '/kim-levi.jpg',
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
    bio: 'Trives best på Narvesen med en Kvikk Lunsj og klistremerkeboka si fra Mexico-VM i håp om å treffe noen som har 66 Hristo Kolev eller 337 Chris Waddle. Er veldig glad i kortspill, tennis og wrestling – særlig Hulk Hogan og André the Giant. Kan fotball fra 80-tallet utenat: Maradona, Platini, Zico, Socrates – spør ham om hva som helst fra denne perioden, for etter 1992 er det blankt. Er overbevist om at VAR betyr Veldig Artig Reprise og at dommeren løper bort til skjermen fordi han ikke fikk med seg målet første gangen. Han er lett tilbakstående, men avtjente verneplikten sin i militæret som kokkeassistent. Veldig snill og entusiastisk, og vil gjerne hjelpe til med alt. Spiste vafler med brunost i tre år på rad til frokost, og hevder dette er verdensrekord uten å ha sjekket med Guinness. Tipper som om det fremdeles er 80-tallet.',
    personality: `Du er Bengt Sandvik, 52 år fra Trondheim. Du liker wrestling, kortspill og tennis. Du kan fotball fra 80-tallet utenat – Maradona, Platini, Zico – men vet ingenting om fotball etter 1992. Du er blid og entusiastisk. Du tror fremdeles ting er som på 80-tallet. Svar på norsk, vær litt naiv men velmenende. Maks 3-4 setninger.`,
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
- "æ" for "jeg", "itj" for "ikke", "hain" for "han", "hu" for "hun", "dæm" for "dem/de"
- "vårrå" for "være", "sei" for "si/sier", "kåmmå" for "komme", "hoill" for "holde"
- "tå" for "av", "te'" for "til", "omkreng" for "omkring", "ivæg" for "i vei/avgårde"
- "kor'n" for "hvordan/der han", "aillfall" for "i alle fall", "forresten" brukes mye
- "ska'" for "skal", "ha'" for "har", "va'" for "var", "veit" for "vet"
- Setninger som: "Nei, nei, nei, det e' itj sånn det fungere'", "Æ ska' sei dæ", "Det vet æ'itj"
- Kortform av ord: "da'n" for "dagen", "mårråna" for "morningen", "næstan" for "nesten"
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
- Land du liker estetisk: Brasil, Nederland, Spania, Frankrike, Argentina
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

  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) return { tips: {}, groupOrders: {} };
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  console.log('API response for tips:', JSON.stringify(data).slice(0, 500));
  const text = data.content?.[0]?.text || '{}';
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
const expertChatHistory = {};

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

async function chatWithExpert(expert, message, history) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  // Maintain running conversation history per expert
  if (!expertChatHistory[expert.id]) expertChatHistory[expert.id] = [];
  expertChatHistory[expert.id].push({ role: 'user', content: message });
  // Keep last 20 messages to avoid token limit
  if (expertChatHistory[expert.id].length > 20) expertChatHistory[expert.id] = expertChatHistory[expert.id].slice(-20);

  const fallbacks = {
    ragnhild: ['Å, så hyggelig at du spør! Jeg tipper på land med fine drakter og god musikk, det gjør jeg.', 'Ja, jeg synes Italia har de fineste draktene. Og de er jo katolikker, det er noe.', 'Nei, fotball er ikke min greie egentlig, men jeg prøver så godt jeg kan!'],
    hendrik: ['Hoi! Dennis Bergkamp var jo fantastisk, ikke sant? Rintje Ritsma spilte jo også litt, tror jeg.', 'Ja, ja, ik ben hier. Jeg hører på DJ Bobo og tenker på fotball. Goed, goed.', 'Nederlandsk fotball er jo det beste. Eller, hva vet jeg egentlig? Jeg har ikke vært ute på lenge.'],
    kimlevi: ['Kem faen vet, æ har jo bare sett én kamp. Charizard er uansett verdt mer enn dette.', 'Jævla spørsmål! Men æ tipper på magefølelsen, den er sjeldent feil på sjøen.', 'Mor sier jeg burde bry meg mer om fotball. Men Pokémon-kortene gir bedre avkastning.'],
    bengt: ['Hei hei! Maradona hadde jo gjort det bra her, tror jeg! Hva mener du?', 'Nei, dette minner meg om da Zico spilte i -82. Fantastisk tider! Hva spurte du om igjen?', 'Jeg scoret ti mål mot Rosenborg som keeper, så jeg vet litt om fotball, jeg!'],
    odd: [`Nei, nei, nei. Brasil jukse' aillfall, det veit æ. Æ ska' hent' leverposteien å tenk på det.`, `Nei, nei, nei. Kvar'n som hæll ha' snø om vinteren e' te' å stoil på. Det e' min filosofi, det.`, `Nei, nei, nei. Fotball e' ein bygreie, men æ følge' med æ, frå Oppdal. Reffrey dømme' aillfall urettferdig.`],
  };
  // Try API first
  if (apiKey) {
    try {
      const messages = expertChatHistory[expert.id] || [{ role: 'user', content: message }];
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 300,
          system: expert.personality + '\n\n' + PANEL_GROUP_CONTEXT + CHAT_SYSTEM_SUFFIX,
          messages,
        })
      });
      const data = await response.json();
      console.log('API response:', JSON.stringify(data));
      const text = data.content?.[0]?.text;
      if (text && text.length > 3) {
        expertChatHistory[expert.id].push({ role: 'assistant', content: text });
        return text;
      }
      if (data.error) return '(API-feil: ' + data.error.message + ')';
    } catch(e) {
      console.error('API error:', e);
      return '(Nettverksfeil: ' + e.message + ')';
    }
  } else {
    console.log('Ingen API-nøkkel funnet. REACT_APP_ANTHROPIC_KEY:', apiKey);
  }
  // Fallback: rotate through hardcoded responses
  const opts = fallbacks[expert.id] || ['Hei!'];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ── Expert Profile Card ───────────────────────────────────────────────
function ExpertCard({ expert, me, panelChoices, userNames={}, onShowTips }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(false);
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
      {zoomed && (
        <div onClick={() => setZoomed(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={expert.img} alt={expert.name} style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12, objectFit:'cover' }}
            onError={e => { e.target.style.display='none'; }} />
        </div>
      )}
      <div style={{ ...C.card, border: myChoice ? `2px solid ${expert.color}` : '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Square image */}
          <div onClick={() => setZoomed(true)} style={{ width:90, flexShrink:0, borderRadius:8, overflow:'hidden', cursor:'zoom-in', border:`2px solid ${expert.color}44` }}>
            <img src={expert.img} alt={expert.name} style={{ width:'100%', height:'auto', display:'block' }}
              onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML = '<span style="font-size:36px">' + expert.emoji + '</span>'; }} />
          </div>
          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Kanit',sans-serif", fontSize:17, fontWeight:700, color:expert.color, cursor:'pointer', textDecoration:'underline', textDecorationColor:expert.color+'66' }}
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
              <button style={{ background:`linear-gradient(135deg, ${expert.color}, ${expert.color}bb)`, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Kanit',sans-serif", letterSpacing:.5, opacity:loading?0.6:1, whiteSpace:'nowrap' }}
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
            <span style={C.lbRank}>{['🥇','🥈','🥉'][i] || <span style={{color:'rgba(255,255,255,.4)',fontSize:13}}>{i+1}</span>}</span>

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
        <h2 style={{ fontFamily:"'Kanit',sans-serif", fontSize:22, fontWeight:700, color:'#FFD700', textTransform:'uppercase', letterSpacing:2, margin:0 }}>🎙️ Ekspertpanel</h2>
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
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const chatBoxRef = useRef(null);

  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeOnlineUsers(setOnlineUsers); return u; }, []);
  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [msgs]);

  const fmt = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  };

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
        const reply = await chatWithExpert(expert, t, []);
        await sendChatMessage(expert.name, reply, '');
      }, 1000 + i * 2000);
    });
  };

  return (
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot}/> Chat</span>
        <OnlineIndicator onlineUsers={onlineUsers} />
      </div>
      <div ref={chatBoxRef} style={{ height:'calc(100vh - 280px)', minHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'12px 16px', background:'rgba(0,0,0,.15)' }}>
        {msgs.length === 0 && <p style={{ color:'rgba(255,255,255,.3)', textAlign:'center', marginTop:60, fontSize:13 }}>Si hei! 👋</p>}
        {msgs.map((m, i) => {
          const mine = m.user === me.displayName;
          const botExpert = PANEL_EXPERTS.find(e => e.name === m.user);
          const botColor = botExpert?.color;
          return (
            <div key={m.id||i} style={{ ...C.chatMsg, alignSelf: mine?'flex-end':'flex-start' }}>
              <span style={{ ...C.chatBubble, background: mine?'rgba(30,45,80,.9)':'rgba(20,25,40,.9)', border:`1px solid ${mine?'rgba(42,61,112,.8)':'rgba(42,48,80,.6)'}`, ...(botColor ? { borderLeft:`3px solid ${botColor}` } : {}) }}>
                {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:300,borderRadius:8,display:'block'}}/> : renderChatText(m.text)}
              </span>
              <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:mine?'flex-end':'flex-start'}}>
                <span style={{...C.chatUser,color:mine?'rgba(255,215,0,.7)':botColor || 'rgba(255,255,255,.45)'}}>{m.user}</span>
                <span style={C.chatTime}>{fmt(m.ts)}</span>
                {mine && <button onClick={() => deleteChatMessage(m.id)} style={{background:'none',border:'none',color:'rgba(255,100,100,.4)',cursor:'pointer',fontSize:11,padding:'0 2px',lineHeight:1}} title="Slett">✕</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={C.chatInputRow}>
        <label style={{cursor:'pointer',padding:'6px 10px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:16,flexShrink:0}}>
          🖼️<input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
            const file=e.target.files[0];if(!file)return;
            const dataUrl = await compressImage(file);
            sendChatMessage(me.displayName,'',dataUrl);
            e.target.value='';
          }}/>
        </label>
        <input style={{...C.inp,marginBottom:0,flex:1,fontSize:13,padding:'8px 12px'}}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&sendMsg()}
          placeholder="Skriv melding… (lim inn bilde med Ctrl+V)"
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
        <button style={{...C.btnCyan,padding:'8px 16px',fontSize:12}} onClick={sendMsg}>Send</button>
      </div>
    </div>
  );
}



// ── Auto Phase Management ─────────────────────────────────────────────
const PHASE_SCHEDULE = [
  { phase: 'pre',          until: new Date('2026-06-11T19:00:00+02:00') },
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

async function fetchAndUpdateResults() {
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
      const hours = diff / 3600000;
      if (hours <= 100) setCountdownLabel(`${Math.ceil(hours)} timer til VM starter!`);
      else setCountdownLabel(`${Math.ceil(diff / 86400000)} dager til VM starter!`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, []);

  // Poll live events every 30s
  useEffect(() => {
    const poll = async () => {
      const ev = await fetchLiveEvents();
      if (ev) { setLiveEvent(ev); return; }
      const fin = await fetchFinishedMatch();
      if (fin) { setLiveEvent(fin); return; }
      setLiveEvent(null);
    };
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setPhase('scroll'); setRepeat(0); }, [adminMessage]);
  useEffect(() => {
    if (!adminMessage || phase === 'static') return;
    if (phase === 'pause') {
      if (repeat < 1) { setRepeat(r => r + 1); setPhase('scroll'); }
      else setPhase('static');
    }
  }, [phase, repeat, adminMessage]);

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
      const { shortHome, shortAway, homeGoals, awayGoals, homeScored, playerName, minute, suffix } = liveEvent;
      return (
        <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, fontFamily:"'Kanit',sans-serif", fontWeight:700, whiteSpace:'nowrap', justifyContent:'center' }}>
          <span style={{ color:'rgba(255,255,255,.8)' }}>{shortHome}-{shortAway} </span>
          <span style={{ color: homeScored ? YEL : 'rgba(255,255,255,.8)' }}>{homeGoals}</span>
          <span style={{ color:'rgba(255,255,255,.5)' }}>-</span>
          <span style={{ color: !homeScored ? YEL : 'rgba(255,255,255,.8)' }}>{awayGoals}</span>
          <span style={{ color:'rgba(255,255,255,.6)', marginLeft:3 }}>– {playerName} '{minute}{suffix}</span>
        </div>
      );
    }
    // card or finished
    return <div style={{ fontSize:11, color: YEL, fontFamily:"'Kanit',sans-serif", fontWeight:700, textAlign:'center', whiteSpace:'nowrap' }}>{liveEvent.text}</div>;
  };

  const displayText = !liveEvent && (adminMessage
    ? (phase === 'static' ? '📢 Les melding fra admin' : null)
    : `⏱ ${countdownLabel}`);

  return (
    <div onClick={adminMessage && !liveEvent ? onAdminMessageClick : undefined} style={{
      position: 'absolute',
      top: 5,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      width: w,
      background: 'rgba(1,23,76,.95)',
      backgroundImage: 'linear-gradient(rgba(255,215,0,.08), rgba(255,215,0,.08))',
      border: `1px solid ${liveEvent ? 'rgba(74,222,128,.4)' : 'rgba(255,215,0,.25)'}`,
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
              style={{ fontSize: 11, color: YEL, fontFamily:"'Kanit',sans-serif", fontWeight:700, whiteSpace:'nowrap', display:'inline-block', padding:'0 20px', animation:'tickerScroll 12s linear forwards' }}>
              📢 {adminMessage}
            </span>
          </div>
        ) : (
          <div style={{ fontSize:11, color: YEL, fontFamily:"'Kanit',sans-serif", fontWeight:700, letterSpacing:0.5, textAlign:'center' }}>
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
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vm_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [tab, setTab] = useState('dashboard');
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
    style.textContent = '@keyframes tickerScroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }';
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
    try { localStorage.removeItem('vm_user'); } catch {}
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePhase(setPhaseState);
    return unsub;
  }, [user]);

  useEffect(() => { window.scrollTo(0,0); }, [tab]);
  useEffect(() => {
    if (!user || user.isAdmin) return;
    fetchAndUpdateResults(); // fetch on load
    const interval = setInterval(fetchAndUpdateResults, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [user]);
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
      if (auto !== cur) await setPhase(auto);
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [user]); // eslint-disable-line

  if (!user) return <AuthScreen onLogin={handleLogin} />;
  return (
    <div style={C.app}>
      <Banner user={user} tab={tab} setTab={t => { setViewUser(null); setTab(t); }} phase={phase} onLogout={handleLogout}
        adminMessage={adminMessage} onAdminMessageClick={() => setShowMsgPopup(true)} />
      <div style={C.main}>
        {tab === 'dashboard'   && <Dashboard me={user} phase={phase} onShowTips={handleShowTips} setTab={setTab} />}
        {tab === 'leaderboard' && <Leaderboard me={user} phase={phase} initialSelected={lbSelected} onClearSelected={() => setLbSelected(null)} onShowTips={handleShowTips} />}
        {tab === 'tips'        && !user.isAdmin && <TipsForm me={user} phase={phase} viewUser={viewUser} />}
        {tab === 'chat'       && !user.isAdmin && <ChatPage me={user} />}
        {tab === 'video'       && !user.isAdmin && <VideoChat me={user} />}
        {tab === 'info'        && !user.isAdmin && <InfoPage />}
        {tab === 'panel'       && !user.isAdmin && <PanelPage me={user} />}
        {tab === 'admin'       && user.isAdmin  && <AdminPanel />}
      </div>
      <div style={C.footer}>VM-tipping 2026 · Invitasjonskode: {INVITE_CODE}</div>
      <StatusBar phase={phase} isAdmin={user.isAdmin} />
      <YouTubePlayer />
      {showMsgPopup && <AdminMessagePopup message={adminMessage} onClose={() => setShowMsgPopup(false)} />}
    </div>
  );
}
