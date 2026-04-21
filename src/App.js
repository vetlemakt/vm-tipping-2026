import { useState, useEffect, useRef } from 'react';
import {
  getUser, getAllUsers, createUser, updateUser,
  getResults, setResults, getPhase, setPhase,
  getCardStats, setCardStats,
  subscribeChatMessages, sendChatMessage,
  subscribePhase, subscribeResults,
  db,
} from './firebase';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { calcScore } from './scoring';
import {
  INVITE_CODE, ADMIN_CODE,
  GROUPS, ALL_TEAMS, GROUP_MATCHES, KNOCKOUT_MATCHES, KNOCKOUT_ROUNDS,
  PHASE_OPTIONS, OPEN_PHASES, FLAGS, WS_MSGS, SPEC_FIELDS,
} from './constants';
import { C } from './styles';

const YEL = '#FFD700';
const GRN = '#2EAA4A';
const Flag = ({ team }) => <span title={team}>{FLAGS[team] || '🏳️'}</span>;
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

// ── Window Toast ────────────────────────────────────────────────────
function WindowToast({ phase, isAdmin }) {
  const [visible, setVisible] = useState(true);
  const ws = winStatus(phase);
  if (isAdmin || !visible) return null;
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
      background: ws.open ? 'rgba(0,180,80,.92)' : 'rgba(200,40,40,.92)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      color: '#fff', borderRadius: 30, padding: '8px 18px 8px 14px',
      boxShadow: ws.open ? '0 4px 24px rgba(0,200,80,.4)' : '0 4px 24px rgba(200,40,40,.4)',
      fontSize: 13, fontWeight: 600, letterSpacing: .5, whiteSpace: 'nowrap',
      animation: 'fadeUp .4s ease both',
      border: `1px solid ${ws.open ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.15)'}`,
    }}>
      <span style={{ fontSize: 16 }}>{ws.open ? '🟢' : '🔴'}</span>
      {ws.label}
      <button onClick={() => setVisible(false)} style={{
        background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
        borderRadius: '50%', width: 18, height: 18, cursor: 'pointer',
        fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginLeft: 4, flexShrink: 0, fontFamily: 'inherit',
      }}>×</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  BANNER (topp-navigasjon)
// ══════════════════════════════════════════════════════════════════════
function Banner({ user, tab, setTab, phase, onLogout }) {
  const isMobile = useIsMobile();

  const NAV_U = [
    { id: 'leaderboard', icon: null, img: '/tabell.png', label: 'Tabell' },
    { id: 'tips',        icon: null, img: '/tips.png',   label: 'Tips' },
    { id: 'myscore',     icon: null, img: '/poeng.png',  label: 'Poeng' },
    { id: 'video',       icon: null, img: '/video.png',  label: 'Video' },
  ];
  const NAV_A = [
    { id: 'admin', icon: '⚙️', img: null, label: 'Admin' },
  ];
  const nav = user.isAdmin ? NAV_A : NAV_U;

  return (
    <div>
      <div style={{ ...C.banner, ...(isMobile ? C.bannerMobile : {}) }}>
        {/* Logo – klikk for dashboard */}
        <div style={{ ...C.bannerLogo, ...(isMobile ? C.bannerLogoMobile : {}), position:'relative', zIndex:20, cursor:'pointer' }}
          onClick={() => setTab('dashboard')}>
          <img src="/vm-logo.png" alt="Gå til dashboard"
            style={{ ...(isMobile ? C.bannerLogoImgMobile : C.bannerLogoImg), mixBlendMode:'multiply' }} />
        </div>

        {/* Nav area */}
        <div style={C.bannerNav}>
          {/* Nav tabs + user on same row */}
          <div style={{ display:'flex', alignItems:'flex-end', width:'100%', gap:4 }}>
            {nav.map(n => (
              <button key={n.id}
                style={{ ...C.navBtn, ...(tab === n.id ? C.navOn : {}) }}
                onClick={() => setTab(n.id)}>
                {n.img
                  ? <img src={n.img} alt={n.label} style={{ width: isMobile?20:22, height: isMobile?20:22, objectFit:'contain', opacity: tab===n.id?1:.7 }} />
                  : <span style={{ fontSize: isMobile ? 14 : 18 }}>{n.icon}</span>
                }
                {!isMobile && <span>{n.label}</span>}
              </button>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, paddingBottom:8 }}>
              {!isMobile && <div style={C.bannerUser}>
                <div style={C.bannerAvatar}>{user.displayName?.[0]?.toUpperCase()}</div>
                <span>{user.displayName}</span>
              </div>}
              <button style={C.btnLogout} onClick={onLogout}>Logg ut</button>
            </div>
          </div>
        </div>
      </div>


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
  const chatBot = useRef(null);

  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => { const u = subscribeChatMessages(setMsgs); return u; }, []);
  useEffect(() => { const u = subscribeMatchSummaries(setSummaries); return u; }, []);
  useEffect(() => { chatBot.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => {
    getAllUsers().then(us => {
      setUsers(us.filter(u => u.id !== 'admin')
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);

  const sendMsg = async () => {
    const t = input.trim(); if (!t) return;
    setInput(''); await sendChatMessage(me.displayName, t, '');
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
        <div style={C.cardBody}>
          {users.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', padding: 20, fontSize: 13 }}>Ingen deltakere ennå.</p>}
          {users.slice(0, 8).map((r, i) => (
            <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}) }}>
              <span style={C.lbRank}>{medals[i] || <span style={{ color: '#4a5a80', fontSize: 13 }}>{i + 1}</span>}</span>
              <span style={C.lbName}>{r.displayName}{r.id === me.username && <span style={C.youTag}>deg</span>}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={C.lbPts}>{r.total}</div>
                <div style={C.lbPtsL}>poeng</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div style={C.card}>
        <div style={C.cardHeader}>
          <span style={C.cardTitle}><span style={C.cardTitleDot} /> Chat</span>
          <span style={{ fontSize: 12, color: '#6070a0', fontFamily: "'Fira Code',monospace" }}>{msgs.length} mld</span>
        </div>
        <div style={C.chatBox}>
          {msgs.length === 0 && <p style={{ color: '#4a5a80', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Si hei! 👋</p>}
          {msgs.map((m, i) => {
            const mine = m.user === me.displayName;
            return (
              <div key={m.id || i} style={{ ...C.chatMsg, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                <span style={{ ...C.chatBubble, background: mine ? 'rgba(30,45,80,.9)' : 'rgba(20,25,40,.9)', border: `1px solid ${mine ? 'rgba(42,61,112,.8)' : 'rgba(42,48,80,.6)'}` }}>
                  {m.image ? <img src={m.image} alt="bilde" style={{maxWidth:'100%',maxHeight:200,borderRadius:8,display:'block'}} /> : m.text}
                </span>
                <div style={{display:'flex',gap:8,alignItems:'center',justifyContent: mine?'flex-end':'flex-start'}}>
                  <span style={{...C.chatUser,color: mine?'rgba(255,215,0,.7)':'rgba(255,255,255,.45)'}}>{m.user}</span>
                  <span style={C.chatTime}>{fmt(m.ts)}</span>
                </div>
              </div>
            );
          })}
          <div ref={chatBot} />
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
                <div style={C.matchScorers}>Gruppe {m.group} · {m.date?.slice(5)}</div>
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
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════════════════════════════
function Leaderboard({ me }) {
  const [rows, setRows] = useState([]);
  const [results, setResultsState] = useState({});
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => {
    getAllUsers().then(us => {
      setRows(us.filter(u => u.id !== 'admin')
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total));
    });
  }, [results]);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Full poengtabell</span></div>
      <div style={C.cardBody}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ ...C.lbRow, ...(r.id === me.username ? C.lbMe : {}) }}>
            <span style={C.lbRank}>{medals[i] || <span style={{ color: '#4a5a80', fontSize: 13 }}>{i + 1}</span>}</span>
            <span style={C.lbName}>{r.displayName}{r.id === me.username && <span style={C.youTag}>deg</span>}</span>
            <div style={{ textAlign: 'right' }}>
              <div style={C.lbPts}>{r.total}</div>
              <div style={C.lbPtsL}>poeng</div>
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

  useEffect(() => {
    getUser(me.username).then(u => {
      if (u) { setTips(u.tips || {}); setGrpO(u.groupOrders || {}); setSpec(u.specialTips || {}); }
      setLoading(false);
    });
  }, [me.username]);

  const ws = winStatus(phase);
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
        <span style={{ ...C.badge, background: ws.open ? 'rgba(46,170,74,.1)' : 'rgba(230,50,50,.1)', color: ws.open ? GRN : '#ff7777', border: `1px solid ${ws.open ? 'rgba(46,170,74,.2)' : 'rgba(230,50,50,.2)'}` }}>{ws.label}</span>
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
              return (
                <div key={m.id} style={C.mRow}>
                  <span style={C.mDate}>{m.date.slice(5)}</span>
                  <span style={C.mTeam}><Flag team={m.home} /> {m.home}</span>
                  <input style={C.sInp} type="number" min={0} max={20} disabled={!grpOk}
                    value={t.home ?? ''} placeholder='–' onChange={e => setTip(m.id, 'home', e.target.value)} />
                  <span style={C.dash}>–</span>
                  <input style={C.sInp} type="number" min={0} max={20} disabled={!grpOk}
                    value={t.away ?? ''} placeholder='–' onChange={e => setTip(m.id, 'away', e.target.value)} />
                  <span style={{ ...C.mTeam, textAlign: 'right' }}>{m.away} <Flag team={m.away} /></span>
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
              {KNOCKOUT_MATCHES.filter(m => m.phase === kp).map((m, i) => {
                const t = tips[m.id] || {};
                return (
                  <div key={m.id} style={C.mRow}>
                    <span style={C.mDate}>K{i + 1}</span>
                    <span style={{ ...C.mTeam, color: '#6070a0' }}>Hjemme</span>
                    <input style={{ ...C.sInp, opacity: koOk ? 1 : .3 }} type="number" min={0} max={20} disabled={!koOk}
                      value={t.home ?? ''} placeholder='–' onChange={e => setTip(m.id, 'home', e.target.value)} />
                    <span style={C.dash}>–</span>
                    <input style={{ ...C.sInp, opacity: koOk ? 1 : .3 }} type="number" min={0} max={20} disabled={!koOk}
                      value={t.away ?? ''} placeholder='–' onChange={e => setTip(m.id, 'away', e.target.value)} />
                    <span style={{ ...C.mTeam, color: '#6070a0', textAlign: 'right' }}>Borte</span>
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
//  MY SCORE
// ══════════════════════════════════════════════════════════════════════
function MyScore({ me }) {
  const [user, setUser] = useState(null);
  const [results, setResultsState] = useState({});
  const [cards, setCards] = useState({});
  useEffect(() => { getUser(me.username).then(setUser); }, [me.username]);
  useEffect(() => { const u = subscribeResults(setResultsState); return u; }, []);
  useEffect(() => { getCardStats().then(setCards); }, []);

  if (!user) return <div style={C.card}><p style={{ color: '#6070a0', textAlign: 'center', padding: 40 }}>Laster…</p></div>;

  const { total, bd } = calcScore(user, results);
  const mPts = Object.values(bd.matches).reduce((s, v) => s + v, 0);
  const gPts = Object.values(bd.groups).reduce((s, v) => s + v, 0);
  const sPts = Object.values(bd.special).reduce((s, v) => s + v, 0);
  const sp = user.specialTips || {};
  const sortedCards = Object.entries(cards).filter(([k]) => !k.startsWith('_')).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Min poengstatus</span></div>
      <div style={C.cardBody}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
          {[{ v: total, l: 'Totale poeng', c: YEL }, { v: mPts, l: 'Kamppoeng', c: '#60a5fa' },
          { v: gPts, l: 'Gruppepoeng', c: '#a78bfa' }, { v: sPts, l: 'Spesialpoeng', c: GRN }
          ].map(({ v, l, c }) => (
            <div key={l} style={C.scoreBox}>
              <div style={{ ...C.scoreNum, color: c }}>{v}</div>
              <div style={C.scoreL}>{l}</div>
            </div>
          ))}
        </div>
        <span style={C.secH}>Mine spesialtips</span>
        <div style={C.specBox}>
          {SPEC_FIELDS.map(({ key, label, pts }) => {
            const myT = sp[key], correct = results[key], won = correct && myT === correct;
            return (
              <div key={key} style={C.specRow}>
                <span style={C.specLabel}>{label}</span>
                <span style={{ color: won ? GRN : myT ? '#e8eaf0' : '#4a5a80' }}>
                  {myT ? <><Flag team={myT} /> {myT}</> : '–'}
                </span>
                {won && <span style={C.wonBadge}>+{pts}p ✓</span>}
                {correct && myT !== correct && <span style={{ color: '#ff7777', fontSize: 11 }}>Rett: {correct}</span>}
              </div>
            );
          })}
        </div>
        <span style={{ ...C.secH, marginTop: 16 }}>Kortstatistikk</span>
        {sortedCards.length === 0
          ? <p style={{ color: '#4a5a80', fontSize: 13 }}>Ingen kortdata ennå.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sortedCards.map(([team, pts], i) => (
              <div key={team} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#0b0f1a', borderRadius: 6 }}>
                <span style={{ width: 20, color: '#4a5a80', fontFamily: "'Fira Code',monospace", fontSize: 11 }}>{i + 1}</span>
                <Flag team={team} /><span style={{ flex: 1, fontSize: 13, color: '#e8eaf0' }}> {team}</span>
                <span style={{ color: YEL, fontFamily: "'Fira Code',monospace", fontSize: 12 }}>{pts}kp</span>
              </div>
            ))}
          </div>}
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

  return (
    <div style={C.card}>
      <div style={C.cardHeader}><span style={C.cardTitle}><span style={C.cardTitleDot} /> Admin</span></div>
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


// ── Music Player ─────────────────────────────────────────────────────
const TRACKS = [
  { title: "We Are The Champions", artist: "Audionautix", url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/We%20Are%20The%20Champions.mp3" },
  { title: "Stadium Rock", artist: "Free Music Archive", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Kai_Engel/Chapter_One/Kai_Engel_-_01_-_Interlude.mp3" },
  { title: "Victory Fanfare", artist: "Pixabay", url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3" },
  { title: "Football Anthem", artist: "Pixabay", url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946f28f348.mp3" },
  { title: "Stadium Crowd", artist: "Pixabay", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3" },
];

function MusicPlayer() {
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    if (playing) audioRef.current.play().catch(() => setPlaying(false));
    else audioRef.current.pause();
  }, [playing, volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = TRACKS[trackIdx].url;
    if (playing) audioRef.current.play().catch(() => setPlaying(false));
  }, [trackIdx]);

  const next = () => setTrackIdx(i => (i + 1) % TRACKS.length);
  const prev = () => setTrackIdx(i => (i - 1 + TRACKS.length) % TRACKS.length);

  const track = TRACKS[trackIdx];

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 500,
      background: 'rgba(1,23,76,.92)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,215,0,.2)',
      borderRadius: 16, padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 220, maxWidth: 260,
    }}>
      <audio ref={audioRef} onEnded={next} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>🎵</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', fontFamily: "'Fira Code',monospace" }}>{track.artist}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={prev} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'#fff', borderRadius:8, width:28, height:28, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>⏮</button>
        <button onClick={() => setPlaying(p => !p)} style={{ background:'linear-gradient(135deg,#FFD700,#e6b800)', border:'none', color:'#01174C', borderRadius:10, width:36, height:36, cursor:'pointer', fontSize:16, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(255,215,0,.3)' }}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={next} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'#fff', borderRadius:8, width:28, height:28, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>⏭</button>
        <input type="range" min={0} max={1} step={0.05} value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          style={{ flex:1, accentColor:'#FFD700', height:4 }} />
      </div>
      <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
        {TRACKS.map((_, i) => (
          <div key={i} onClick={() => setTrackIdx(i)} style={{ width:6, height:6, borderRadius:'50%', background: i===trackIdx?'#FFD700':'rgba(255,255,255,.2)', cursor:'pointer', transition:'background .2s' }} />
        ))}
      </div>
    </div>
  );
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

  if (!user) return <AuthScreen onLogin={u => { setUser(u); setTab('dashboard'); }} />;

  return (
    <div style={C.app}>
      <Banner user={user} tab={tab} setTab={setTab} phase={phase} onLogout={() => setUser(null)} />
      <WindowToast phase={phase} isAdmin={user.isAdmin} />
      <div style={C.main}>
        {tab === 'dashboard'   && <Dashboard me={user} phase={phase} />}
        {tab === 'leaderboard' && <Leaderboard me={user} />}
        {tab === 'tips'        && !user.isAdmin && <TipsForm me={user} phase={phase} />}
        {tab === 'myscore'     && !user.isAdmin && <MyScore me={user} />}
        {tab === 'video'       && !user.isAdmin && <VideoChat me={user} />}
        {tab === 'admin'       && user.isAdmin  && <AdminPanel />}
      </div>
      <div style={C.footer}>VM-tipping 2026 · Invitasjonskode: {INVITE_CODE}</div>
      <MusicPlayer />
    </div>
  );
}
