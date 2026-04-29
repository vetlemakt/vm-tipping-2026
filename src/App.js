import { useState, useEffect, useRef } from 'react';
import {
  getUser, getAllUsers, createUser, updateUser,
  getResults, setResults, getPhase, setPhase,
  getCardStats, setCardStats,
  subscribeChatMessages, sendChatMessage,
  subscribePhase, subscribeResults,
  updatePresence, subscribeOnlineUsers,
  db,
} from './firebase';
import { doc, setDoc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { calcScore, calcMatchPts } from './scoring';
import {
  INVITE_CODE, ADMIN_CODE,
  GROUPS, ALL_TEAMS, GROUP_MATCHES, KNOCKOUT_MATCHES, KNOCKOUT_ROUNDS,
  PHASE_OPTIONS, OPEN_PHASES, FLAGS, WS_MSGS, SPEC_FIELDS,
} from './constants';
import { C } from './styles';

const YEL = '#FFD700';

const COUNTRY_CODES = {
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

async function setMatchSummary(matchId, text, author) {
  await setDoc(doc(db, 'summaries', matchId), { text, author, ts: Date.now() });
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
function Banner({ user, tab, setTab, phase, onLogout }) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

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
    { id: 'chat',        icon: null, img: '/chat.png',          label: 'Chat' },
    { id: 'panel',       icon: null, img: '/ekspertpanel.png',   label: 'Ekspertpanel' },
    { id: 'info',        icon: null, img: '/info.png',    label: 'Info' },
  ];
  const NAV_A = [
    { id: 'admin', icon: '⚙️', img: null, label: 'Admin' },
  ];
  const nav = user.isAdmin ? NAV_A : NAV_U;

  return (
    <div>
      <div style={{ ...C.banner, overflow: isMobile ? 'visible' : 'visible' }}>
        {/* Logo */}
        <div style={{ width: isMobile?90:110, minWidth: isMobile?90:110, position:'relative', zIndex:20, cursor:'pointer', flexShrink:0 }}
          onClick={() => { setTab('dashboard'); setMenuOpen(false); }}>
          <img src="/vm-logo.png" alt="Gå til dashboard"
            style={{ position:'absolute', top:0, left:0, height: isMobile?120:133, width: isMobile?120:133, objectFit:'contain', filter:'drop-shadow(0 8px 24px rgba(0,0,0,.5))', mixBlendMode:'multiply' }} />
        </div>

        {/* Nav area */}
        <div style={{ ...C.bannerNav }}>
          {isMobile ? (
            /* Mobile: hamburger */
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', height:'100%', paddingBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={C.bannerAvatar}>{user.displayName?.[0]?.toUpperCase()}</div>
                <button onClick={() => setMenuOpen(m => !m)} style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', borderRadius:8, padding:'7px 12px', cursor:'pointer', fontSize:18, lineHeight:1, fontFamily:'inherit' }}>
                  {menuOpen ? '✕' : '☰'}
                </button>
              </div>
            </div>
          ) : (
            /* Desktop: inline nav with colors */
            <div style={{ display:'flex', alignItems:'flex-end', width:'100%', gap:4 }}>
              {nav.map(n => {
                const color = NAV_COLORS[n.id] || '#FFD700';
                const isOn = tab === n.id;
                return (
                  <button key={n.id}
                    style={{ ...C.navBtn, color: isOn ? color : 'rgba(255,255,255,.7)',
                      borderBottomColor: isOn ? color : 'transparent',
                      background: isOn ? `${color}15` : 'transparent',
                      WebkitTextStroke: isOn ? '0px' : '0px',
                      textShadow: 'none',
                    }}
                    onClick={() => setTab(n.id)}>
                    {n.img
                      ? <img src={n.img} alt={n.label} style={{ width:20, height:20, objectFit:'contain', opacity: isOn?1:.7, filter: isOn ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
                      : <span style={{ fontSize:16, filter: isOn ? `drop-shadow(0 0 4px ${color})` : 'none' }}>{n.icon}</span>
                    }
                    <span style={{ color: isOn ? color : 'rgba(255,255,255,.8)', fontWeight: isOn?800:600 }}>{n.label}</span>
                  </button>
                );
              })}
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, paddingBottom:8 }}>
                <div style={C.bannerUser}>
                  <div style={C.bannerAvatar}>{user.displayName?.[0]?.toUpperCase()}</div>
                  <span>{user.displayName}</span>
                </div>
                <button style={C.btnLogout} onClick={onLogout}>Logg ut</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMobile && menuOpen && (
        <div style={{ position:'absolute', top: 80, right:0, left:0, background:'#01174C', zIndex:100, borderBottom:'2px solid rgba(255,215,0,.3)', boxShadow:'0 8px 24px rgba(0,0,0,.5)' }}>
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
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}. ${months[parseInt(m)-1]}`;
}

// Render chat text with clickable links
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


// Format fulltreff lightning bolts - red for groups of 10
function renderFulltreff(count) {
  if (!count || count === 0) return null;
  const trophies = Math.floor(count / 10);
  const balls = count % 10;
  return (
    <span style={{display:'flex',alignItems:'center',gap:1,flexWrap:'nowrap',lineHeight:1}}>
      {Array.from({length:trophies}).map((_,i) => <span key={'t'+i} style={{fontSize:14}}>🏆</span>)}
      {Array.from({length:balls}).map((_,i) => <span key={'b'+i} style={{fontSize:12}}>⚽</span>)}
    </span>
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

// ══════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function Dashboard({ me }) {
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
  const chatBot = useRef(null);

  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeOnlineUsers(setOnlineUsers); return u; }, []);
  useEffect(() => { const u = subscribeMatchSummaries(setSummaries); return u; }, []);
  const chatBoxRef = useRef(null);
  useEffect(() => { if(chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, [msgs]);
  useEffect(() => {
    getAllUsers().then(us => {
      setUsers(us.filter(u => u.id !== 'admin')
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);

  const sendMsg = async () => {
    const t = input.trim(); if (!t) return;
    setInput('');
    await sendChatMessage(me.displayName, t, '');
    // Check for @mentions - find ALL mentioned experts
    const mentionMatches = [...t.matchAll(/@([a-zæøå-]+)/gi)];
    const mentionedExperts = [];
    mentionMatches.forEach(match => {
      const mentioned = match[1].toLowerCase().replace('-','');
      const expert = PANEL_EXPERTS.find(e =>
        e.firstName.toLowerCase() === match[1].toLowerCase() ||
        e.firstName.toLowerCase().replace('-','') === mentioned ||
        e.id === mentioned
      );
      if (expert && !mentionedExperts.find(e => e.id === expert.id)) {
        mentionedExperts.push(expert);
      }
    });
    mentionedExperts.forEach((expert, i) => {
      setTimeout(async () => {
        const reply = await chatWithExpert(expert, t, []);
        await sendChatMessage(expert.name, reply, '');
      }, 1000 + i * 1500); // stagger replies so they don't all come at once
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
  const myPts = users.find(u => u.id === me.username)?.total || 0;
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
        const stats = isMobile ? [
          { num: myRank ? `#${myRank}` : '–', label: 'Plassering' },
          { num: myPts, label: 'Poeng' },
          { num: users.length, label: 'Deltakere' },
        ] : [
          { num: myRank ? `#${myRank}` : '–', label: 'Din plassering' },
          { num: myPts, label: 'Dine poeng' },
          { num: users.length, label: 'Deltakere' },
          { num: finishedCount, label: 'Spilte kamper' },
          { num: totalGoals, label: 'Antall mål' },
        ];
        return (
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap:12, marginBottom:16 }}>
            {stats.map(({ num, label }) => (
              <div key={label} style={C.statWidget}>
                <div style={C.statNum}>{num}</div>
                <div style={C.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={isMobile ? {display:'flex',flexDirection:'column',gap:16} : {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,alignItems:'start'}}>
      {/* Poengtabell */}
      <div style={C.card}>
        <div style={C.cardHeader}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Poengtabell</span>
          <span style={{ ...C.badge, background: 'rgba(255,215,0,.1)', color: YEL, border: '1px solid rgba(255,215,0,.2)' }}>LIVE</span>
        </div>
        <div style={{ ...C.cardBody, maxHeight: 420, overflowY: 'auto' }}>
          {users.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', padding: 20, fontSize: 13 }}>Ingen deltakere ennå.</p>}
          {users.map((r, i) => (
            <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}) }}>
              <span style={C.lbRank}>{medals[i] || <span style={{ color: '#4a5a80', fontSize: 13 }}>{i + 1}</span>}</span>
              <span style={C.lbName}>{r.displayName}{r.id === me.username && <span style={C.youTag}>deg</span>}</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {(r.fulltreff||0) > 0 && renderFulltreff(r.fulltreff)}
                <div style={{ textAlign: 'right' }}>
                  <div style={C.lbPts}>{r.total}</div>
                  <div style={C.lbPtsL}>poeng</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div style={C.card}>
        <div style={C.cardHeader}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Chat</span>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <OnlineIndicator onlineUsers={onlineUsers} />
            <button onClick={() => setChatFullscreen(f => !f)} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'rgba(255,255,255,.6)', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }} title="Fullskjerm">⛶</button>
          </div>
        </div>
        <div style={C.chatBox} ref={chatBoxRef}>
          {msgs.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Si hei! 👋</p>}
          {msgs.map((m, i) => {
            const mine = m.user === me.displayName;
            return (
              <div key={m.id || i} style={{ ...C.chatMsg, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                <span style={{ ...C.chatBubble, background: mine ? 'rgba(30,45,80,.9)' : 'rgba(20,25,40,.9)', border: `1px solid ${mine ? 'rgba(42,61,112,.8)' : 'rgba(42,48,80,.6)'}` }}>
                  {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:200,borderRadius:8,display:'block'}} /> : renderChatText(m.text)}
                </span>
                <div style={{display:'flex',gap:8,alignItems:'center',justifyContent: mine?'flex-end':'flex-start'}}>
                  <span style={{...C.chatUser,color: mine?'rgba(255,215,0,.7)':'rgba(255,255,255,.45)'}}>{m.user}</span>
                  <span style={C.chatTime}>{fmt(m.ts)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={C.chatInputRow}>
          <label style={{cursor:'pointer',padding:'6px 10px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:16,flexShrink:0}} title="Last opp bilde">
            🖼️
            <input type="file" accept="image/*,image/gif" style={{display:'none'}} onChange={e=>{
              const file=e.target.files[0]; if(!file)return;
              const reader=new FileReader();
              reader.onload=ev=>sendChatMessage(me.displayName,'',ev.target.result);
              reader.readAsDataURL(file);
              e.target.value='';
            }}/>
          </label>
          <input style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 13, padding: '8px 12px' }}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()}
            placeholder="Skriv melding… (lim inn bilde med Ctrl+V)" 
            onPaste={e=>{
              const items=e.clipboardData?.items;
              if(!items)return;
              for(let item of items){
                if(item.type.startsWith('image/')){
                  e.preventDefault();
                  const file=item.getAsFile();
                  const reader=new FileReader();
                  reader.onload=ev=>sendChatMessage(me.displayName,'',ev.target.result);
                  reader.readAsDataURL(file);
                  return;
                }
              }
            }}
          />
          <button style={{ ...C.btnCyan, padding: '8px 16px', fontSize: 12 }} onClick={sendMsg}>Send</button>
        </div>
      </div>

      {/* Kamper */}
      <div style={C.card}>
        <div style={C.cardHeader}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Siste kamper</span>
          <span style={{ fontSize: 12, color: '#6070a0', fontFamily: "'Fira Code',monospace" }}>Klikk for å skrive oppsummering</span>
        </div>
        {finishedMatches.length === 0 && (
          <p style={{ color: '#4a5a80', textAlign: 'center', padding: 24, fontSize: 13 }}>
            Ingen kampresultater ennå – admin legger inn etter kampene.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0 }}>
          {finishedMatches.map(m => {
            const r = results[m.id];
            const sum = summaries[m.id];
            const isEditing = editingSummary === m.id;
            return (
              <div key={m.id} style={C.matchCard}>
                <div style={C.matchTeams}>
                  <span style={C.matchTeam}><Flag team={m.home} /> {m.home}</span>
                  <span style={C.matchScore}>{r.home} – {r.away}</span>
                  <span style={{ ...C.matchTeam, textAlign: 'right' }}>{m.away} <Flag team={m.away} /></span>
                </div>
                <div style={C.matchScorers}>Gruppe {m.group} · {fmtDate(m.date)}{m.time ? ' · ' + m.time : ''}</div>
                {sum ? (
                  <div>
                    <div style={C.matchSummaryText}>{sum.text}</div>
                    <div style={C.matchSummaryAuthor}>✍️ {sum.author}</div>
                  </div>
                ) : isEditing ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea style={{ ...C.ta, fontSize: 12, marginBottom: 6 }} rows={3}
                      value={summaryText} onChange={e => setSummaryText(e.target.value)}
                      placeholder="Skriv en kort oppsummering…" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...C.btnGold, padding: '6px 14px', fontSize: 11 }} onClick={() => saveSummary(m.id)}>Lagre</button>
                      <button style={{ ...C.btnSecondary, padding: '6px 14px', fontSize: 11 }} onClick={() => setEditingSummary(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <button style={C.matchSummaryBtn} onClick={() => { setEditingSummary(m.id); setSummaryText(''); }}>
                    ✍️ Skriv oppsummering
                  </button>
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
                return (
                  <div key={m.id||i} style={{ ...C.chatMsg, alignSelf: mine?'flex-end':'flex-start' }}>
                    <span style={{ ...C.chatBubble, background: mine?'rgba(30,45,80,.9)':'rgba(20,25,40,.9)', border:`1px solid ${mine?'rgba(42,61,112,.8)':'rgba(42,48,80,.6)'}` }}>
                      {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:300,borderRadius:8,display:'block'}}/> : renderChatText(m.text)}
                    </span>
                    <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:mine?'flex-end':'flex-start'}}>
                      <span style={{...C.chatUser,color:mine?'rgba(255,215,0,.7)':'rgba(255,255,255,.45)'}}>{m.user}</span>
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
        )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════════════════════════════
function Leaderboard({ me }) {
  const [rows, setRows] = useState([]);
  const [results, setResultsState] = useState({});
  const [selected, setSelected] = useState(null);
  const isMobile = useIsMobile();
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => {
    getAllUsers().then(us => {
      setRows(us.filter(u => u.id !== 'admin')
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);
  const medals = ['🥇', '🥈', '🥉'];
  if (selected) {
    const allUsers = {};
    rows.forEach(r => { allUsers[r.id] = r; });
    return (
      <div style={C.card}>
        <div style={C.cardHeader}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> {selected.displayName}s tips</span>
          <button onClick={() => setSelected(null)} style={{ ...C.btnSecondary, padding:'5px 14px', fontSize:12 }}>← Tilbake</button>
        </div>
        <div style={C.cardBody}>
          <span style={C.secH}>Spesialtips</span>
          <div style={C.specBox}>
            {SPEC_FIELDS.map(({key,label,pts}) => {
              const myT=(selected.specialTips||{})[key], correct=results[key], won=correct&&myT===correct;
              return (
                <div key={key} style={C.specRow}>
                  <span style={C.specLabel}>{label}</span>
                  <span style={{color:won?'#4ade80':myT?'#e8edf8':'rgba(255,255,255,.3)'}}>{myT||'–'}</span>
                  {won&&<span style={C.wonBadge}>✓ +{pts}p</span>}
                </div>
              );
            })}
          </div>
          <span style={{...C.secH,marginTop:16}}>Kamptips (gruppe {Object.keys(GROUPS)[0]})</span>
          {GROUP_MATCHES.filter(m=>m.group==='A').map(m => {
            const tip=(selected.tips||{})[m.id]; const act=results[m.id];
            const pts=tip&&act?calcMatchPts(tip,act):null;
            return (
              <div key={m.id} style={{...C.mRow,marginBottom:3,justifyContent:'space-between'}}>
                <span style={{fontSize:13,flex:1}}><Flag team={m.home}/> {m.home}</span>
                <span style={{fontFamily:"'Fira Code',monospace",color:'#e8edf8',padding:'2px 10px',background:'rgba(255,255,255,.06)',borderRadius:6}}>
                  {tip?`${tip.home}–${tip.away}`:'?'}
                </span>
                <span style={{fontSize:13,flex:1,textAlign:'right'}}>{m.away} <Flag team={m.away}/></span>
                {pts!==null&&<span style={{fontSize:11,color:pts===4?'#FFD700':'rgba(255,255,255,.5)',minWidth:32,textAlign:'right'}}>{pts===4?'⚡':''}{pts}p</span>}
              </div>
            );
          })}
          <p style={{color:'rgba(255,255,255,.3)',fontSize:12,marginTop:12}}>Trykk tilbake for å se full tabell</p>
        </div>
      </div>
    );
  }
  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Full poengtabell</span></div>
      <div style={C.cardBody}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}), cursor:'pointer' }}
            onClick={() => setSelected && setSelected(r)}>
            <span style={C.lbRank}>{medals[i] || <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>{i + 1}</span>}</span>
            <span style={{ ...C.lbName, textDecoration:'underline', textDecorationColor:'rgba(255,215,0,.3)' }}>
              {r.displayName}{r.id === me.username && <span style={C.youTag}>deg</span>}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {(r.fulltreff||0) > 0 && (
                isMobile
                  ? <span style={{fontSize:12,color:'#FFD700'}}>⚡×{r.fulltreff}</span>
                  : renderFulltreff(r.fulltreff)
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={C.lbPts}>{r.total}</div>
                <div style={C.lbPtsL}>poeng</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  TIPS FORM
// ══════════════════════════════════════════════════════════════════════
function TipsForm({ me, phase }) {
  const [tips, setTips] = useState({});
  const [grpO, setGrpO] = useState({});
  const [spec, setSpec] = useState({});
  const [ag, setAg] = useState('A');
  const [tab, setTab] = useState('group');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResultsState] = useState({});
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);

  useEffect(() => {
    getUser(me.username).then(u => {
      if (u) { setTips(u.tips || {}); setGrpO(u.groupOrders || {}); setSpec(u.specialTips || {}); }
      setLoading(false);
    });
  }, [me.username]);

  const grpOk = phase === 'pre';
  const koOk = OPEN_PHASES.has(phase);

  const setTip = (id, field, val) => { setTips(p => ({ ...p, [id]: { ...p[id], [field]: val } })); setDirty(true); };
  const setOrd = (g, i, val) => {
    setGrpO(p => {
      const a = p[g] ? [...p[g]] : ['', '', '', ''];
      // Remove val from other positions first
      const cleaned = a.map((v, idx) => (idx !== i && v === val) ? '' : v);
      cleaned[i] = val;
      return { ...p, [g]: cleaned };
    });
    setDirty(true);
  };
  const setSp = (k, v) => { setSpec(p => ({ ...p, [k]: v })); setDirty(true); };

  const save = async () => {
    await updateUser(me.username, { tips, groupOrders: grpO, specialTips: spec });
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div style={C.card}><p style={{ color: '#6070a0', textAlign: 'center', padding: 40 }}>Laster…</p></div>;

  return (
    <div style={C.card}>
      <div style={C.cardHeader}>
        <span style={C.cardTitle}><span style={C.cardTitleDot} /> Mine tips</span>

      </div>
      <div style={C.cardBody}>
        <div style={C.specBox}>
          <span style={C.secH}>🌟 Spesialtips – låses før gruppespillet</span>
          {SPEC_FIELDS.map(({ key, label, pts }) => (
            <div key={key} style={C.specRow}>
              <span style={C.specLabel}>{label}</span>
              <span style={C.ptsBadge}>{pts}p</span>
              {key === 'topscorer' ? (
                <input
                  style={{ ...C.inp, marginBottom:0, flex:1, fontSize:13, padding:'6px 10px', opacity: grpOk?1:.5 }}
                  disabled={!grpOk}
                  value={spec[key] || ''}
                  onChange={e => setSp(key, e.target.value)}
                  placeholder="Skriv spillernavn (f.eks. Mbappé)"
                />
              ) : (
                <>
                  <select style={{ ...C.sel, opacity: grpOk ? 1 : .5 }} disabled={!grpOk}
                    value={spec[key] || ''} onChange={e => setSp(key, e.target.value)}>
                    <option value=''>– Velg –</option>
                    {ALL_TEAMS.map(t => <option key={t} value={t}>{FLAGS[t] || ''} {t}</option>)}
                  </select>
                  {spec[key] && <Flag team={spec[key]} />}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={C.tabs}>
          {['group', 'knockout'].map(t => (
            <button key={t} style={{ ...C.tab, ...(tab === t ? C.tabOn : {}) }} onClick={() => setTab(t)}>
              {t === 'group' ? '📋 Gruppespill' : '🏟️ Sluttspill'}
            </button>
          ))}
        </div>
        {tab === 'group' && <>
          <div style={C.gTabs}>
            {Object.keys(GROUPS).map(g => (
              <button key={g} style={{ ...C.gTab, ...(ag === g ? C.gTabOn : {}) }} onClick={() => setAg(g)}>Gr.{g}</button>
            ))}
          </div>
          <div style={C.matchList}>
            {GROUP_MATCHES.filter(m => m.group === ag).map(m => {
              const t = tips[m.id] || {};
              const act = results[m.id];
              const pts = act && t.home !== undefined && t.away !== undefined ? calcMatchPts(t, act) : null;
              return (
                    <div key={m.id} style={{...C.mRow, gap:4, flexWrap:'nowrap', padding:'6px 8px'}}>
                      {/* Date+time – hidden on portrait mobile via CSS class */}
                      <div className="hide-portrait" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:48,background:'rgba(255,255,255,.05)',borderRadius:6,padding:'3px 5px',flexShrink:0}}>
                        <span style={{fontSize:9,color:'rgba(255,255,255,.7)',fontFamily:"'Kanit',sans-serif",whiteSpace:'nowrap'}}>{fmtDate(m.date)}</span>
                        {m.time && <span style={{fontSize:8,color:'rgba(255,255,255,.4)',fontFamily:"'Kanit',sans-serif"}}>{m.time}</span>}
                      </div>
                      {/* Home: flag + name(hidden on portrait) */}
                      <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-end'}}>
                        <span className="hide-portrait" style={{fontSize:12,color:'#e8edf8',textAlign:'right',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:90}}>{m.home}</span>
                        <Flag team={m.home} size={18}/>
                      </div>
                      {/* Score inputs */}
                      <input style={{...C.sInp,width:38,fontSize:15}} type="number" min={0} max={20} disabled={!grpOk}
                        value={t.home ?? ''} placeholder='–' onChange={e => setTip(m.id, 'home', e.target.value)} />
                      <span style={C.dash}>–</span>
                      <input style={{...C.sInp,width:38,fontSize:15}} type="number" min={0} max={20} disabled={!grpOk}
                        value={t.away ?? ''} placeholder='–' onChange={e => setTip(m.id, 'away', e.target.value)} />
                      {/* Away: flag + name(hidden on portrait) */}
                      <div style={{display:'flex',alignItems:'center',gap:3,flex:1,justifyContent:'flex-start'}}>
                        <Flag team={m.away} size={18}/>
                        <span className="hide-portrait" style={{fontSize:12,color:'#e8edf8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:90}}>{m.away}</span>
                      </div>
                      {/* Result + points */}
                      {act && <span style={{fontSize:10,color:'#00e5ff',fontFamily:"'Fira Code',monospace",background:'rgba(0,229,255,.08)',border:'1px solid rgba(0,229,255,.2)',borderRadius:5,padding:'2px 6px',flexShrink:0}}>{act.home}–{act.away}</span>}
                      {pts !== null && <span style={{fontSize:10,fontFamily:"'Fira Code',monospace",background:pts===4?'rgba(255,215,0,.15)':'rgba(255,255,255,.06)',border:`1px solid ${pts===4?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)'}`,borderRadius:5,padding:'2px 6px',color:pts===4?'#FFD700':'rgba(255,255,255,.6)',flexShrink:0}}>{pts===4?'⚡':''}{pts}p</span>}
                    </div>
              );
            })}
          </div>
          <span style={{ ...C.secH, marginTop: 16 }}>Grupperangering – 5p per riktig plass</span>
          {[0, 1, 2, 3].map(pos => (
            <div key={pos} style={C.plRow}>
              <span style={C.plPos}>{pos + 1}.</span>
              <select style={{ ...C.sel, opacity: grpOk ? 1 : .5 }} disabled={!grpOk}
                value={grpO[ag]?.[pos] || ''} onChange={e => setOrd(ag, pos, e.target.value)}>
                <option value=''>– Velg lag –</option>
                {GROUPS[ag].map(t => <option key={t} value={t}>{FLAGS[t] || ''} {t}</option>)}
              </select>
            </div>
          ))}
        </>}
        {tab === 'knockout' && <>
          {!koOk && <div style={C.lockBanner}>🔒 Sluttspill-vinduet er stengt.</div>}
          {KNOCKOUT_ROUNDS.map(({ phase: kp, label }) => (
            <div key={kp} style={{ marginBottom: 18 }}>
              <span style={C.roundL}>{label}</span>
              {KNOCKOUT_MATCHES.filter(m => m.phase === kp).map(m => {
                const t = tips[m.id] || {};
                const act = results[m.id];
                const pts = act && t.home !== undefined && t.away !== undefined ? calcMatchPts(t, act) : null;
                return (
                  <div key={m.id} style={{...C.mRow, gap:6, flexWrap:'nowrap'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:52,background:'rgba(255,255,255,.05)',borderRadius:6,padding:'4px 6px',flexShrink:0}}>
                      <span style={{fontSize:10,color:'rgba(255,255,255,.7)',fontFamily:"'Fira Code',monospace",whiteSpace:'nowrap'}}>Kamp {m.matchNum}</span>
                      {m.date && <span style={{fontSize:9,color:'rgba(255,255,255,.45)',fontFamily:"'Fira Code',monospace"}}>{fmtDate(m.date)}</span>}
                      {m.time && <span style={{fontSize:9,color:'rgba(255,255,255,.35)',fontFamily:"'Fira Code',monospace"}}>{m.time}</span>}
                    </div>
                    <span style={{...C.mTeam,fontSize:11,color:'rgba(255,255,255,.6)'}}>{m.home}</span>
                    <input style={{...C.sInp, opacity: koOk ? 1 : .3}} type="number" min={0} max={20} disabled={!koOk}
                      value={t.home ?? ''} placeholder='–' onChange={e => setTip(m.id, 'home', e.target.value)} />
                    <span style={C.dash}>–</span>
                    <input style={{...C.sInp, opacity: koOk ? 1 : .3}} type="number" min={0} max={20} disabled={!koOk}
                      value={t.away ?? ''} placeholder='–' onChange={e => setTip(m.id, 'away', e.target.value)} />
                    <span style={{...C.mTeam,fontSize:11,color:'rgba(255,255,255,.6)',textAlign:'right'}}>{m.away}</span>
                    {act && <span style={{fontSize:11,color:'#00e5ff',fontFamily:"'Fira Code',monospace",background:'rgba(0,229,255,.08)',border:'1px solid rgba(0,229,255,.2)',borderRadius:6,padding:'3px 8px',flexShrink:0}}>{act.home}–{act.away}</span>}
                    {pts !== null && <span style={{fontSize:11,fontFamily:"'Fira Code',monospace",background:pts===4?'rgba(255,215,0,.15)':'rgba(255,255,255,.06)',border:`1px solid ${pts===4?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)'}`,borderRadius:6,padding:'3px 8px',color:pts===4?'#FFD700':'rgba(255,255,255,.6)',flexShrink:0}}>{pts===4?'⚡':''}{pts}p</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </>}
        <button style={{ ...C.btnGold, width: '100%', marginTop: 16, opacity: dirty ? 1 : .5 }} onClick={save}>
          {saved ? '✅ Lagret!' : '💾 Lagre alle tips'}
        </button>
        {dirty && <p style={{ color: '#f59e0b', fontSize: 11, textAlign: 'center', marginTop: 6, fontFamily: "'Fira Code',monospace" }}>⚠ Ulagrede endringer</p>}
      </div>
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

  useEffect(() => { getPhase().then(setPhaseState); }, []);
  useEffect(() => { getResults().then(setResultsState); }, []);
  useEffect(() => { getCardStats().then(setCardsState); }, []);

  const updPhase = async p => { setPhaseState(p); await setPhase(p); };
  const setResult = async (id, field, val) => { const upd = { ...results, [id]: { ...(results[id] || {}), [field]: parseInt(val) || 0 } }; setResultsState(upd); await setResults(upd); };
  const setGrpResult = async (g, i, val) => { const key = `grp_${g}`; const arr = results[key] ? [...results[key]] : ['', '', '', '']; arr[i] = val; const upd = { ...results, [key]: arr }; setResultsState(upd); await setResults(upd); };
  const setSpec = async (key, val) => { const upd = { ...results, [key]: val }; setResultsState(upd); await setResults(upd); };
  const updCard = async (team, type, val) => { const y = type === 'y' ? parseInt(val) || 0 : (cards[`_y_${team}`] || 0); const r = type === 'r' ? parseInt(val) || 0 : (cards[`_r_${team}`] || 0); const upd = { ...cards, [`_y_${team}`]: y, [`_r_${team}`]: r, [team]: y + r * 3 }; setCardsState(upd); await setCardStats(upd); };

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
        users: users.filter(u => u.id !== 'admin').map(u => ({
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
      </div>
      <div style={C.cardBody}>
        <div style={C.tabs}>
          {[['phase', 'Fase'], ['results', 'Gruppe'], ['knockout', 'Sluttspill'], ['special', 'Spesial'], ['cards', 'Kort']].map(([t, l]) => (
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
        {aTab === 'knockout' && KNOCKOUT_ROUNDS.map(({ phase: kp, label }) => (
          <div key={kp} style={{ marginBottom: 16 }}>
            <span style={C.roundL}>{label}</span>
            {KNOCKOUT_MATCHES.filter(m => m.phase === kp).map((m, i) => (
              <div key={m.id} style={C.mRow}>
                <span style={{ ...C.mDate, minWidth: 40 }}>K{i + 1}</span>
                <input style={C.sInp} type="number" min={0} value={results[m.id]?.home ?? ''} placeholder='–' onChange={e => setResult(m.id, 'home', e.target.value)} />
                <span style={C.dash}>–</span>
                <input style={C.sInp} type="number" min={0} value={results[m.id]?.away ?? ''} placeholder='–' onChange={e => setResult(m.id, 'away', e.target.value)} />
              </div>
            ))}
          </div>
        ))}
        {aTab === 'special' && (
          <div style={C.specBox}>
            {[{ key: 'champion', label: '🥇 Verdensmester' }, { key: 'runner_up', label: '🥈 Sølvvinner' },
            { key: 'third', label: '🥉 Bronsevinner' }, { key: 'topscorer', label: '⚽ Toppscorer – lag' },
            { key: 'most_carded', label: '🟨 Mest kort – lag' }].map(({ key, label }) => (
              <div key={key} style={C.specRow}>
                <span style={C.specLabel}>{label}</span>
                <select style={C.sel} value={results[key] || ''} onChange={e => setSpec(key, e.target.value)}>
                  <option value=''>– Ikke satt –</option>
                  {ALL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {results[key] && <Flag team={results[key]} />}
              </div>
            ))}
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
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Maks per kamp: 4 poeng</div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>📋 Poengsystem – Grupper</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🎯 Riktig grupplassering: <strong style={{color:'#FFD700'}}>5 poeng per lag</strong></div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginTop:4}}>Maks per gruppe: 20 poeng (4 lag × 5p)</div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🌟 Spesialtips (låses før gruppespillet)</h3>
        <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:14, marginBottom:16, lineHeight:1.8, color:'rgba(255,255,255,.8)', fontSize:14 }}>
          <div>🥇 Riktig verdensmester: <strong style={{color:'#FFD700'}}>25 poeng</strong></div>
          <div>🥈 Riktig sølvvinner: <strong style={{color:'#FFD700'}}>15 poeng</strong></div>
          <div>🥉 Riktig bronsevinner: <strong style={{color:'#FFD700'}}>10 poeng</strong></div>
          <div>⚽ Riktig toppscorer: <strong style={{color:'#FFD700'}}>20 poeng</strong></div>
          <div>🟨 Riktig lag med mest kort: <strong style={{color:'#FFD700'}}>10 poeng</strong></div>
        </div>

        <h3 style={{ color:'#fff', fontSize:15, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>🔒 Tidsvindu</h3>
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
      {!minimized && (
        <iframe
          width="240"
          height="135"
          src="https://www.youtube.com/embed/videoseries?list=PL7KLwyJCC7QwT8BNvKF7mokkODa6aNfAH&autoplay=0&rel=0"
          title="VM-musikk"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ display: 'block' }}
        />
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
    personality: `Du er Odd Snerten, 63 år, bonde fra Oppdal. Du har aldri vært sør for Lillehammer frivillig. Du spiser leverpostei til alle måltider. Du starter gjerne med "nei, nei, nei" og er skeptisk til det meste. Du tipper basert på om landet har god landbrukspolitikk og snø om vinteren. Du er overbevist om at Brasil jukser og at en engelskmann ved navn Reffrey dømmer hver eneste kamp. Du snakker i en bondsk trøndersk stil. Maks 3-4 setninger.`,
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
  const styleNote = expert.id === 'ragnhild' ? 'Tipper på land med fine drakter og god musikk.' :
    expert.id === 'leifarne' ? 'Tipper tilfeldig basert på magefølelse.' :
    expert.id === 'bjornar' ? 'Tipper basert på 80-talls fotballkunnskap.' :
    expert.id === 'oddgunnar' ? 'Tipper mot Brasil alltid, favoriserer land med snø.' : '';
  const prompt = 'Du er ' + expert.name + '. ' + expert.personality +
    '\n\nDu skal tippe resultater for VM 2026 kampene. Gi et realistisk resultat for disse kampene basert på din personlighet:\n' +
    matchLines +
    '\n\nSvar KUN med JSON i dette formatet (ingen annen tekst):\n{"tips": {"A1": {"home": 2, "away": 1}, "A2": {"home": 0, "away": 0}, ...}}\n' +
    styleNote;

  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) return {};
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
    console.log('Parsed tips keys:', Object.keys(parsed.tips || {}));
    return parsed.tips || {};
  } catch(e) {
    console.error('Parse error:', e, 'Text was:', text.slice(0, 200));
    return {};
  }
}

// Store per-expert chat history in memory
const expertChatHistory = {};

const PANEL_GROUP_CONTEXT = `
Du er en av fem deltakere i et VM-tippepanel. Her er de andre deltakerne du kjenner:

1. Ragnhild Kristiansen (60, Mandal) – tidligere rødstrømpe, nå aktiv i menigheten. Veldig hyggelig. Tipper på drakter og musikk. Har vært gift tre ganger. Du har hørt at hun lager utrolig god sørlandskake.

2. Hendrik van der Berg (58, Drammen) – nederlandsk innvandrer med agorafobi. Har ikke vært ute siden 2014. DJ Bobo-fan. Tror Rintje Ritsma spilte i Ajax. Bestiller alt på nett. Du vet at han egentlig savner Nederland men vil aldri innrømme det.

3. Kim-Levi Ditlefsen (47, Henningsvær) – fisker, bor hjemme hos mor. Stygg i kjeften. Samler Pokémon-kort, har en Charizard 1. utgave. Så én Tromsø-kamp i 1998. Du vet han egentlig er ganske sårbar, men skjuler det bak kraftuttrykk.

4. Bengt Sandvik (52, Trondheim) – wrestling- og kortspillfan. Kan fotball fra 80-tallet utenat men vet ingenting etter 1992. Veldig snill. Spiste vafler med brunost i militæret i tre år. Du vet han faktisk prøvde å bli proffbryter i 1987 men ga opp etter en skade i kneet.

5. Odd Snerten (63, Oppdal) – bonde i tredje generasjon. Spiser leverpostei til alle måltider. Aldri sør for Lillehammer. Mistenker Brasil for juks. Du vet han faktisk har en hemmelig lidenskap for romantiske filmer men forteller det ikke til noen.

Dere kjenner hverandre fra et lokalt tippekompani som har holdt på siden 2018. Det er ikke alltid like harmonisk, men det er varmt. Du kan referere til de andre med fornavn og kommentere hva du tror DE ville ha tippa eller ment.
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
    odd: ['Nei, nei, nei. Brasil jukser uansett, det vet alle. Leverposteien er klar.', 'Nei, nei, nei. Hvem som helst som har snø om vinteren er å stole på. Det er min filosofi.', 'Fotball er en bygreie. Men jeg følger med, jeg, fra Oppdal.'],
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
          system: expert.personality + '\n\n' + PANEL_GROUP_CONTEXT,
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
function ExpertCard({ expert, me, panelChoices, userNames={} }) {
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
      const tips = await generateExpertTips(expert);
      console.log('Generated tips:', tips, 'Keys:', Object.keys(tips).length);
      if (Object.keys(tips).length === 0) {
        alert('Fikk ingen tips fra ' + expert.firstName + '. Prøv igjen.');
        setLoading(false);
        return;
      }
      await updateUser(me.username, { tips: { ...(u?.tips || {}), ...tips } });
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
            <div style={{ fontFamily:"'Kanit',sans-serif", fontSize:17, fontWeight:700, color:'#fff' }}>{expert.name}</div>
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
                  <p style={{color:'#e8edf8',fontSize:15,lineHeight:1.6,marginBottom:20}}>
                    Oi! Er du sikker på at du vil la <strong style={{color:expert.color}}>{expert.firstName}</strong> velge for deg? Dette vil slette alle dine kommende tips.
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
  const [tips, setTips] = useState(null);
  useEffect(() => {
    getUser('panel_' + expert.id).then(u => setTips(u?.tips || {}));
  }, [expert.id]);

  if (!tips) return <div style={{ padding:'12px 18px', color:'rgba(255,255,255,.4)', fontSize:13 }}>Laster...</div>;
  const played = Object.keys(tips).length;
  if (played === 0) return <div style={{ padding:'12px 18px', color:'rgba(255,255,255,.4)', fontSize:13 }}>Ingen tips levert ennå.</div>;

  return (
    <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'12px 18px' }}>
      <span style={C.secH}>Kamptips – gruppe {Object.keys(GROUPS)[0]}</span>
      {GROUP_MATCHES.filter(m => m.group === 'A' && tips[m.id]).map(m => (
        <div key={m.id} style={{ ...C.mRow, marginBottom:3, justifyContent:'space-between' }}>
          <span style={{ fontSize:13, flex:1 }}><Flag team={m.home}/> {m.home}</span>
          <span style={{ fontFamily:"'Fira Code',monospace", color:'#FFD700', padding:'2px 10px', background:'rgba(255,215,0,.08)', borderRadius:6 }}>
            {tips[m.id] ? tips[m.id].home + '–' + tips[m.id].away : '?'}
          </span>
          <span style={{ fontSize:13, flex:1, textAlign:'right' }}>{m.away} <Flag team={m.away}/></span>
        </div>
      ))}
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
        <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginTop:6 }}>
          Fem eksperter med sine egne tips. Call på dem i chatten med @fornavn. Trykk på bildet for å zoome.
        </p>
      </div>
      <PanelLeaderboard onSelect={setSelectedExpert} />
      {selectedExpert && (
        <div style={C.card}>
          <div style={C.cardHeader}>
            <span style={C.cardTitle}><span style={C.cardTitleDot}/>{selectedExpert.firstName}s tips</span>
            <button onClick={() => setSelectedExpert(null)} style={{...C.btnSecondary,padding:'5px 14px',fontSize:12}}>× Lukk</button>
          </div>
          <div style={C.cardBody}><ExpertTipsView expert={selectedExpert}/></div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:16 }}>
        {PANEL_EXPERTS.map(expert => (
          <ExpertCard key={expert.id} expert={expert} me={me} panelChoices={panelChoices} userNames={userNames} />
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
    setInput('');
    await sendChatMessage(me.displayName, t, '');
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
      }, 1000 + i * 1500);
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
          return (
            <div key={m.id||i} style={{ ...C.chatMsg, alignSelf: mine?'flex-end':'flex-start' }}>
              <span style={{ ...C.chatBubble, background: mine?'rgba(30,45,80,.9)':'rgba(20,25,40,.9)', border:`1px solid ${mine?'rgba(42,61,112,.8)':'rgba(42,48,80,.6)'}` }}>
                {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:300,borderRadius:8,display:'block'}}/> : renderChatText(m.text)}
              </span>
              <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:mine?'flex-end':'flex-start'}}>
                <span style={{...C.chatUser,color:mine?'rgba(255,215,0,.7)':'rgba(255,255,255,.45)'}}>{m.user}</span>
                <span style={C.chatTime}>{fmt(m.ts)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={C.chatInputRow}>
        <label style={{cursor:'pointer',padding:'6px 10px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:16,flexShrink:0}}>
          🖼️<input type="file" accept="image/*,image/gif" style={{display:'none'}} onChange={e=>{
            const file=e.target.files[0];if(!file)return;
            const reader=new FileReader();
            reader.onload=ev=>sendChatMessage(me.displayName,'',ev.target.result);
            reader.readAsDataURL(file);e.target.value='';
          }}/>
        </label>
        <input style={{...C.inp,marginBottom:0,flex:1,fontSize:13,padding:'8px 12px'}}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&sendMsg()}
          placeholder="Skriv melding… (lim inn bilde med Ctrl+V)"
          onPaste={e=>{
            const items=e.clipboardData?.items;if(!items)return;
            for(let item of items){
              if(item.type.startsWith('image/')){
                e.preventDefault();
                const file=item.getAsFile();
                const reader=new FileReader();
                reader.onload=ev=>sendChatMessage(me.displayName,'',ev.target.result);
                reader.readAsDataURL(file);return;
              }
            }
          }}
        />
        <button style={{...C.btnCyan,padding:'8px 16px',fontSize:12}} onClick={sendMsg}>Send</button>
      </div>
    </div>
  );
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
//  ROOT APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [phase, setPhaseState] = useState('pre');

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

  if (!user) return <AuthScreen onLogin={u => { setUser(u); setTab('dashboard'); }} />;
  return (
    <div style={C.app}>
      <Banner user={user} tab={tab} setTab={setTab} phase={phase} onLogout={() => setUser(null)} />
      <div style={C.main}>
        {tab === 'dashboard'   && <Dashboard me={user} phase={phase} />}
        {tab === 'leaderboard' && <Leaderboard me={user} />}
        {tab === 'tips'        && !user.isAdmin && <TipsForm me={user} phase={phase} />}
        {tab === 'chat'       && !user.isAdmin && <ChatPage me={user} />}
        {tab === 'video'       && !user.isAdmin && <VideoChat me={user} />}
        {tab === 'info'        && !user.isAdmin && <InfoPage />}
        {tab === 'panel'       && !user.isAdmin && <PanelPage me={user} />}
        {tab === 'admin'       && user.isAdmin  && <AdminPanel />}
      </div>
      <div style={C.footer}>VM-tipping 2026 · Invitasjonskode: {INVITE_CODE}</div>
      <StatusBar phase={phase} isAdmin={user.isAdmin} />
      <YouTubePlayer />
    </div>
  );
}
