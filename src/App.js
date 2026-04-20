import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getUser, getAllUsers, createUser, updateUser,
  getResults, setResults, getPhase, setPhase,
  getCardStats, setCardStats,
  subscribeChatMessages, sendChatMessage,
  subscribePhase, subscribeResults,
} from './firebase';
import { calcScore } from './scoring';
import {
  INVITE_CODE, ADMIN_CODE, FD_API_KEY,
  GROUPS, ALL_TEAMS, GROUP_MATCHES, KNOCKOUT_MATCHES, KNOCKOUT_ROUNDS,
  PHASE_OPTIONS, OPEN_PHASES, FLAGS, WS_MSGS, SPEC_FIELDS,
} from './constants';
import { C } from './styles';

// ── Helpers ──────────────────────────────────────────────────────────
const Flag = ({ team }) => <span title={team}>{FLAGS[team] || '🏳️'}</span>;

const winStatus = p => ({ open: OPEN_PHASES.has(p), ...(WS_MSGS[p] || WS_MSGS.pre) });

async function fetchLive() {
  if (FD_API_KEY === 'YOUR_KEY_HERE') return { demo: true };
  try {
    const r = await fetch('https://api.football-data.org/v4/competitions/2000/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': FD_API_KEY } });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username:'', password:'', inviteCode:'', displayName:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const upd = e => setF(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        if (f.username === 'admin' && f.password === ADMIN_CODE) {
          onLogin({ username:'admin', displayName:'Admin ⚙️', isAdmin:true }); return;
        }
        const u = await getUser(f.username);
        if (!u) { setError('Brukeren finnes ikke.'); setLoading(false); return; }
        if (u.password !== f.password) { setError('Feil passord.'); setLoading(false); return; }
        onLogin({ ...u, username: f.username });
      } else {
        if (f.inviteCode.trim().toUpperCase() !== INVITE_CODE) { setError('Feil invitasjonskode.'); setLoading(false); return; }
        if (!f.username || !f.displayName || !f.password) { setError('Fyll ut alle felt.'); setLoading(false); return; }
        const existing = await getUser(f.username);
        if (existing) { setError('Brukernavnet er tatt.'); setLoading(false); return; }
        const nu = { password:f.password, displayName:f.displayName, tips:{}, specialTips:{}, groupOrders:{} };
        await createUser(f.username, nu);
        onLogin({ ...nu, username: f.username });
      }
    } catch (e) {
      setError('Noe gikk galt. Prøv igjen.'); setLoading(false);
    }
  };

  return (
    <div style={C.authWrap}>
      <div style={C.authGlow} />
      <div className="fu" style={C.authBox}>
        <div style={C.authBall}>⚽</div>
        <h1 style={C.authTitle}>VM-TIPPING 2026</h1>
        <p style={C.authSub}>FIFA World Cup · USA · Canada · Mexico</p>
        <div style={C.tabs}>
          {['login','register'].map(m => (
            <button key={m} style={{...C.tab,...(mode===m?C.tabOn:{})}} onClick={() => { setMode(m); setError(''); }}>
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
        <button style={C.btnGold} onClick={submit} disabled={loading}>
          {loading ? <span style={C.spinner}>⟳</span> : mode === 'login' ? 'Logg inn →' : 'Opprett konto →'}
        </button>
        <p style={{color:'#334155',fontSize:12,marginTop:14,textAlign:'center',fontFamily:"'JetBrains Mono',monospace"}}>
          Invitasjonskode fås av turneringsadmin
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════════════════════════════
function Leaderboard({ me }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResultsState] = useState({});

  useEffect(() => {
    const unsub = subscribeResults(r => setResultsState(r));
    return unsub;
  }, []);

  useEffect(() => {
    getAllUsers().then(users => {
      const scored = users
        .filter(u => u.id !== 'admin')
        .map(u => ({ ...u, ...calcScore(u, results) }))
        .sort((a, b) => b.total - a.total);
      setRows(scored);
      setLoading(false);
    });
  }, [results]);

  const medals = ['🥇','🥈','🥉'];

  return (
    <div className="fu" style={C.card}>
      <h2 style={C.cardH}>🏆 Poengtabell</h2>
      {loading && <p className="pulse" style={{color:'#334155',textAlign:'center',padding:32}}>Laster…</p>}
      {!loading && rows.length === 0 && <p style={{color:'#334155',textAlign:'center',padding:40}}>Ingen deltakere ennå.</p>}
      {rows.map((r, i) => (
        <div key={r.id} style={{...C.lbRow,...(r.id===me.username?C.lbMe:{})}}>
          <span style={C.lbRank}>{medals[i] || <span style={{color:'#334155',fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</span>}</span>
          <span style={C.lbName}>{r.displayName}{r.id===me.username&&<span style={C.youTag}> ← deg</span>}</span>
          <div style={{textAlign:'right'}}>
            <div style={C.lbPts}>{r.total}</div>
            <div style={C.lbPtsL}>poeng</div>
          </div>
        </div>
      ))}
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
      if (u) { setTips(u.tips||{}); setGrpO(u.groupOrders||{}); setSpec(u.specialTips||{}); }
      setLoading(false);
    });
  }, [me.username]);

  const ws = winStatus(phase);
  const grpOk = phase === 'pre';
  const koOk = OPEN_PHASES.has(phase);

  const setTip = (id, field, val) => { setTips(p => ({...p,[id]:{...p[id],[field]:val}})); setDirty(true); };
  const setOrd = (g, i, val) => { setGrpO(p => { const a=p[g]?[...p[g]]:['','','','']; a[i]=val; return {...p,[g]:a}; }); setDirty(true); };
  const setSp  = (k, v) => { setSpec(p => ({...p,[k]:v})); setDirty(true); };

  const save = async () => {
    await updateUser(me.username, { tips, groupOrders: grpO, specialTips: spec });
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const gms = GROUP_MATCHES.filter(m => m.group === ag);

  if (loading) return <div className="fu" style={C.card}><p className="pulse" style={{color:'#334155',textAlign:'center',padding:40}}>Laster tips…</p></div>;

  return (
    <div className="fu" style={C.card}>
      <div style={C.row}>
        <h2 style={C.cardH}>✏️ Mine tips</h2>
        <span style={{...C.badge,background:ws.color}}>{ws.label}</span>
      </div>

      {/* Special tips */}
      <div style={C.specBox}>
        <div style={C.row}>
          <span style={C.secH}>🌟 Spesialtips</span>
          <span style={C.mono12}>Låses 2t før gruppespillet starter</span>
        </div>
        {SPEC_FIELDS.map(({key,label,pts}) => (
          <div key={key} style={C.specRow}>
            <span style={C.specLabel}>{label}</span>
            <span style={C.ptsBadge}>{pts}p</span>
            <select style={{...C.sel,opacity:grpOk?1:.45}} disabled={!grpOk}
              value={spec[key]||''} onChange={e=>setSp(key,e.target.value)}>
              <option value=''>– Velg –</option>
              {ALL_TEAMS.map(t=><option key={t} value={t}>{FLAGS[t]||''} {t}</option>)}
            </select>
            {spec[key]&&<Flag team={spec[key]}/>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={C.tabs}>
        {['group','knockout'].map(t=>(
          <button key={t} style={{...C.tab,...(tab===t?C.tabOn:{})}} onClick={()=>setTab(t)}>
            {t==='group'?'📋 Gruppespill':'🏟️ Sluttspill'}
          </button>
        ))}
      </div>

      {tab==='group'&&<>
        <div style={C.gTabs}>
          {Object.keys(GROUPS).map(g=>(
            <button key={g} style={{...C.gTab,...(ag===g?C.gTabOn:{})}} onClick={()=>setAg(g)}>Gr.{g}</button>
          ))}
        </div>
        <div style={C.matchList}>
          {gms.map(m=>{const t=tips[m.id]||{};return(
            <div key={m.id} style={C.mRow}>
              <span style={C.mDate}>{m.date.slice(5)}</span>
              <span style={C.mTeam}><Flag team={m.home}/> {m.home}</span>
              <input style={C.sInp} type="number" min={0} max={20} disabled={!grpOk}
                value={t.home??''} placeholder='–' onChange={e=>setTip(m.id,'home',e.target.value)}/>
              <span style={C.dash}>–</span>
              <input style={C.sInp} type="number" min={0} max={20} disabled={!grpOk}
                value={t.away??''} placeholder='–' onChange={e=>setTip(m.id,'away',e.target.value)}/>
              <span style={{...C.mTeam,textAlign:'right'}}>{m.away} <Flag team={m.away}/></span>
            </div>
          );})}
        </div>
        <p style={{...C.secH,marginTop:20}}>Grupperangering – 5p per riktig plass</p>
        {[0,1,2,3].map(pos=>(
          <div key={pos} style={C.plRow}>
            <span style={C.plPos}>{pos+1}.</span>
            <select style={{...C.sel,opacity:grpOk?1:.45}} disabled={!grpOk}
              value={grpO[ag]?.[pos]||''} onChange={e=>setOrd(ag,pos,e.target.value)}>
              <option value=''>– Velg lag –</option>
              {GROUPS[ag].map(t=><option key={t} value={t}>{FLAGS[t]||''} {t}</option>)}
            </select>
          </div>
        ))}
      </>}

      {tab==='knockout'&&<>
        {!koOk&&<div style={C.lockBanner}>🔒 Sluttspill-vinduet er stengt. Åpner etter gjeldende runde er ferdig.</div>}
        {KNOCKOUT_ROUNDS.map(({phase:kp,label})=>(
          <div key={kp} style={{marginBottom:20}}>
            <p style={C.roundL}>{label}</p>
            {KNOCKOUT_MATCHES.filter(m=>m.phase===kp).map((m,i)=>{const t=tips[m.id]||{};return(
              <div key={m.id} style={C.mRow}>
                <span style={C.mDate}>{m.date.slice(5)} K{i+1}</span>
                <span style={{...C.mTeam,color:'#475569'}}>Hjemmelag</span>
                <input style={{...C.sInp,opacity:koOk?1:.35}} type="number" min={0} max={20} disabled={!koOk}
                  value={t.home??''} placeholder='–' onChange={e=>setTip(m.id,'home',e.target.value)}/>
                <span style={C.dash}>–</span>
                <input style={{...C.sInp,opacity:koOk?1:.35}} type="number" min={0} max={20} disabled={!koOk}
                  value={t.away??''} placeholder='–' onChange={e=>setTip(m.id,'away',e.target.value)}/>
                <span style={{...C.mTeam,color:'#475569',textAlign:'right'}}>Bortelag</span>
              </div>
            );})}
          </div>
        ))}
      </>}

      <button style={{...C.btnGold,marginTop:20,opacity:dirty?1:.55}} onClick={save}>
        {saved?'✅ Lagret!':'💾 Lagre alle tips'}
      </button>
      {dirty&&<p style={{color:'#f59e0b',fontSize:12,textAlign:'center',marginTop:6,fontFamily:"'JetBrains Mono',monospace"}}>⚠ Ulagrede endringer</p>}
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

  if (!user) return <div style={C.card}><p className="pulse" style={{color:'#334155',textAlign:'center',padding:40}}>Laster…</p></div>;

  const {total,bd} = calcScore(user, results);
  const mPts = Object.values(bd.matches).reduce((s,v)=>s+v,0);
  const gPts = Object.values(bd.groups).reduce((s,v)=>s+v,0);
  const sPts = Object.values(bd.special).reduce((s,v)=>s+v,0);
  const sp = user.specialTips||{};

  const sortedCards = Object.entries(cards).filter(([k])=>!k.startsWith('_')).sort((a,b)=>b[1]-a[1]).slice(0,10);

  return (
    <div className="fu" style={C.card}>
      <h2 style={C.cardH}>📊 Min poengstatus</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24}}>
        {[{v:total,l:'Totale poeng',c:'#c9a227'},{v:mPts,l:'Kamppoeng',c:'#60a5fa'},
          {v:gPts,l:'Gruppepoeng',c:'#34d399'},{v:sPts,l:'Spesialpoeng',c:'#f472b6'}
        ].map(({v,l,c})=>(
          <div key={l} style={C.scoreBox}>
            <div style={{...C.scoreNum,color:c}}>{v}</div>
            <div style={C.scoreL}>{l}</div>
          </div>
        ))}
      </div>

      <p style={C.secH}>Mine spesialtips</p>
      <div style={C.specBox}>
        {SPEC_FIELDS.map(({key,label,pts})=>{
          const myT=sp[key], correct=results[key], won=correct&&myT===correct;
          return(
            <div key={key} style={C.specRow}>
              <span style={C.specLabel}>{label}</span>
              <span style={{color:won?'#34d399':myT?'#e2e8f0':'#334155'}}>
                {myT?<><Flag team={myT}/> {myT}</>:'–'}
              </span>
              {won&&<span style={C.wonBadge}>+{pts}p ✓</span>}
              {correct&&myT!==correct&&<span style={{color:'#f87171',fontSize:12}}>Rett: {correct}</span>}
            </div>
          );
        })}
      </div>

      <p style={{...C.secH,marginTop:20}}>Kortstatistikk (topp 10)</p>
      {sortedCards.length===0
        ? <p style={{color:'#334155',fontSize:13}}>Ingen kortdata ennå.</p>
        : <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {sortedCards.map(([team,pts],i)=>(
              <div key={team} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'#040911',borderRadius:6}}>
                <span style={{width:22,color:'#c9a227',fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{i+1}</span>
                <Flag team={team}/><span style={{flex:1,fontSize:14}}> {team}</span>
                <span style={{color:'#fbbf24',fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{pts} kp</span>
              </div>
            ))}
            <p style={{color:'#334155',fontSize:11,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>🟨 gult=1kp · 🟥 rødt=3kp</p>
          </div>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  LIVE RESULTS
// ══════════════════════════════════════════════════════════════════════
function LiveResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpd, setLastUpd] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchLive();
    if (!res) { setError('neterr'); setLoading(false); return; }
    if (res.demo) { setError('demo'); setLoading(false); return; }
    setData(res); setLastUpd(new Date()); setError(''); setLoading(false);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 120000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="fu" style={C.card}>
      <div style={C.row}>
        <h2 style={C.cardH}>📡 Live-resultater</h2>
        {lastUpd&&<span style={C.mono12}>{lastUpd.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}</span>}
        <button style={C.btnSm} onClick={load}>↻ Oppdater</button>
      </div>
      {loading&&<p className="pulse" style={{color:'#334155',textAlign:'center',padding:32}}>Henter resultater…</p>}
      {error==='demo'&&(
        <div style={C.infoBox}>
          <p style={{fontWeight:700,color:'#c9a227',marginBottom:8}}>API-nøkkel ikke konfigurert</p>
          <p style={{fontSize:14,color:'#94a3b8',lineHeight:1.7}}>
            For live-resultater under VM 2026:<br/>
            1. Registrer deg gratis på <a href="https://www.football-data.org" target="_blank" rel="noreferrer" style={{color:'#c9a227'}}>football-data.org</a><br/>
            2. Kopier din API-nøkkel<br/>
            3. Bytt ut <code style={{background:'#040911',padding:'1px 6px',borderRadius:4,color:'#60a5fa'}}>YOUR_KEY_HERE</code> i <code style={{color:'#60a5fa'}}>src/constants.js</code><br/>
            4. Push til GitHub – Vercel oppdaterer automatisk
          </p>
        </div>
      )}
      {error==='neterr'&&<div style={{...C.infoBox,borderColor:'#450a0a'}}><p style={{color:'#f87171'}}>Kunne ikke hente data fra API.</p></div>}
      {!loading&&!error&&data&&(
        <div>
          <p style={{color:'#334155',fontSize:13,marginBottom:12,fontFamily:"'JetBrains Mono',monospace"}}>{data.matches?.length||0} avspilte kamper</p>
          {(data.matches||[]).slice(0,30).map(m=>(
            <div key={m.id} style={C.mRow}>
              <span style={C.mDate}>{m.utcDate?.slice(5,10)}</span>
              <span style={{...C.mTeam,fontSize:13}}>{m.homeTeam?.name}</span>
              <span style={{background:'#040911',border:'1px solid #1e3a6e',borderRadius:6,padding:'4px 12px',color:'#c9a227',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                {m.score?.fullTime?.home??'–'} – {m.score?.fullTime?.away??'–'}
              </span>
              <span style={{...C.mTeam,textAlign:'right',fontSize:13}}>{m.awayTeam?.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  CHAT  (Firebase Realtime)
// ══════════════════════════════════════════════════════════════════════
function Chat({ me }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const bot = useRef(null);

  useEffect(() => {
    const unsub = subscribeChatMessages(setMsgs);
    return unsub;
  }, []);

  useEffect(() => { bot.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  const send = async () => {
    const t = input.trim(); if (!t) return;
    setInput('');
    await sendChatMessage(me.displayName, t);
  };

  const fmt = ts => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  };

  return (
    <div className="fu" style={C.card}>
      <h2 style={C.cardH}>💬 Chat</h2>
      <div style={C.chatBox}>
        {msgs.length===0&&<p style={{color:'#334155',textAlign:'center',marginTop:60}}>Ingen meldinger ennå – si hei! 👋</p>}
        {msgs.map(m=>{
          const mine = m.user===me.displayName;
          return(
            <div key={m.id} style={{display:'flex',flexDirection:'column',gap:3,alignSelf:mine?'flex-end':'flex-start',maxWidth:'74%'}}>
              {!mine&&<span style={{fontSize:11,color:'#c9a227',fontFamily:"'JetBrains Mono',monospace"}}>{m.user}</span>}
              <span style={{background:mine?'#162f5e':'#0a1628',border:`1px solid ${mine?'#2d5a9e':'#162035'}`,borderRadius:12,padding:'9px 14px',fontSize:15,lineHeight:1.4}}>
                {m.text}
              </span>
              <span style={{fontSize:10,color:'#334155',fontFamily:"'JetBrains Mono',monospace",textAlign:mine?'right':'left'}}>{fmt(m.ts)}</span>
            </div>
          );
        })}
        <div ref={bot}/>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input style={{...C.inp,marginBottom:0,flex:1}} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Skriv en melding…"/>
        <button style={{...C.btnGold,width:'auto',padding:'11px 22px'}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  VIDEO CHAT (WebRTC)
// ══════════════════════════════════════════════════════════════════════
function VideoChat({ me }) {
  const locRef=useRef(null), remRef=useRef(null), pcRef=useRef(null);
  const [status,setStatus]=useState('idle');
  const [offer,setOffer]=useState('');
  const [answer,setAnswer]=useState('');
  const [inOffer,setInOffer]=useState('');
  const [inAnswer,setInAnswer]=useState('');

  const getMedia=async()=>{const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true});locRef.current.srcObject=s;return s;};
  const mkPC=s=>{
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    s.getTracks().forEach(t=>pc.addTrack(t,s));
    pc.ontrack=e=>{remRef.current.srcObject=e.streams[0];};
    pcRef.current=pc;return pc;
  };
  const startCall=async()=>{try{setStatus('calling');const s=await getMedia(),pc=mkPC(s);pc.onicecandidate=e=>{if(!e.candidate)setOffer(JSON.stringify(pc.localDescription));};await pc.setLocalDescription(await pc.createOffer());}catch{setStatus('error');}};
  const acceptCall=async()=>{try{setStatus('answering');const s=await getMedia(),pc=mkPC(s);await pc.setRemoteDescription(JSON.parse(inOffer));pc.onicecandidate=e=>{if(!e.candidate)setAnswer(JSON.stringify(pc.localDescription));};await pc.setLocalDescription(await pc.createAnswer());}catch{setStatus('error');}};
  const finishCall=async()=>{try{await pcRef.current.setRemoteDescription(JSON.parse(inAnswer));setStatus('connected');}catch{setStatus('error');}};
  const hangUp=()=>{pcRef.current?.close();if(locRef.current?.srcObject)locRef.current.srcObject.getTracks().forEach(t=>t.stop());setStatus('idle');setOffer('');setAnswer('');setInOffer('');setInAnswer('');};

  return (
    <div className="fu" style={C.card}>
      <h2 style={C.cardH}>📹 Videochat</h2>
      <p style={{color:'#475569',fontSize:13,marginBottom:16,fontFamily:"'JetBrains Mono',monospace"}}>Peer-to-peer via WebRTC · Ingen server nødvendig</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
        {[{ref:locRef,label:`Du – ${me.displayName}`,muted:true},{ref:remRef,label:'Motpart',muted:false}].map(({ref,label,muted})=>(
          <div key={label} style={{position:'relative',background:'#040911',borderRadius:10,overflow:'hidden',border:'1px solid #14254a',aspectRatio:'4/3'}}>
            <video ref={ref} autoPlay playsInline muted={muted} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            <div style={{position:'absolute',bottom:8,left:8,fontSize:11,background:'rgba(0,0,0,.75)',color:'#c9a227',padding:'2px 8px',borderRadius:4,fontFamily:"'JetBrains Mono',monospace"}}>{label}</div>
          </div>
        ))}
      </div>
      {status==='connected'&&<div style={{...C.badge,background:'#052e16',marginBottom:12}}>🟢 Tilkoblet!</div>}
      {status==='error'&&<div style={{...C.badge,background:'#450a0a',color:'#fca5a5',marginBottom:12}}>❌ Sjekk kamerarettigheter</div>}
      {status==='idle'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <button style={C.btnGold} onClick={startCall}>📞 Start samtale</button>
          <div style={{textAlign:'center',color:'#334155',fontSize:13}}>— eller svar på innkommende —</div>
          <textarea style={C.ta} rows={3} value={inOffer} onChange={e=>setInOffer(e.target.value)} placeholder="Lim inn tilbudskode fra den som ringer…"/>
          <button style={{...C.btnGold,background:'linear-gradient(135deg,#1e3a6e,#0f2040)',color:'#c9a227'}} onClick={acceptCall} disabled={!inOffer}>📲 Svar</button>
        </div>
      )}
      {status==='calling'&&offer&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <p style={{color:'#94a3b8',fontSize:13}}>Del tilbudskode med motparten:</p>
          <textarea style={C.ta} rows={4} readOnly value={offer} onClick={e=>e.target.select()}/>
          <p style={{color:'#94a3b8',fontSize:13}}>Lim inn svarkoden:</p>
          <textarea style={C.ta} rows={3} value={inAnswer} onChange={e=>setInAnswer(e.target.value)} placeholder="Svarkode…"/>
          <button style={C.btnGold} onClick={finishCall} disabled={!inAnswer}>✅ Koble til</button>
        </div>
      )}
      {status==='answering'&&answer&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <p style={{color:'#94a3b8',fontSize:13}}>Del svarkoden med den som ringte:</p>
          <textarea style={C.ta} rows={4} readOnly value={answer} onClick={e=>e.target.select()}/>
        </div>
      )}
      {status!=='idle'&&<button style={{...C.btnGold,background:'#450a0a',color:'#fca5a5',marginTop:12}} onClick={hangUp}>📵 Avslutt</button>}
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

  const setResult = async (id, field, val) => {
    const upd = { ...results, [id]: { ...(results[id]||{}), [field]: parseInt(val)||0 } };
    setResultsState(upd); await setResults(upd);
  };
  const setGrpResult = async (g, i, val) => {
    const key = `grp_${g}`;
    const arr = results[key] ? [...results[key]] : ['','','',''];
    arr[i] = val;
    const upd = { ...results, [key]: arr };
    setResultsState(upd); await setResults(upd);
  };
  const setSpec = async (key, val) => {
    const upd = { ...results, [key]: val };
    setResultsState(upd); await setResults(upd);
  };
  const updCard = async (team, type, val) => {
    const y = type==='y' ? parseInt(val)||0 : (cards[`_y_${team}`]||0);
    const r = type==='r' ? parseInt(val)||0 : (cards[`_r_${team}`]||0);
    const upd = { ...cards, [`_y_${team}`]:y, [`_r_${team}`]:r, [team]: y+r*3 };
    setCardsState(upd); await setCardStats(upd);
  };

  const gms = GROUP_MATCHES.filter(m => m.group === ag);

  return (
    <div className="fu" style={C.card}>
      <h2 style={C.cardH}>⚙️ Adminpanel</h2>
      <div style={C.tabs}>
        {[['phase','Fase'],['results','Gruppe'],['knockout','Sluttspill'],['special','Spesial'],['cards','Kort']].map(([t,l])=>(
          <button key={t} style={{...C.tab,...(aTab===t?C.tabOn:{})}} onClick={()=>setATab(t)}>{l}</button>
        ))}
      </div>

      {aTab==='phase'&&(
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          <p style={{...C.mono12,marginBottom:8}}>Gjeldende: <strong style={{color:'#c9a227'}}>{phase}</strong></p>
          {PHASE_OPTIONS.map(p=>(
            <button key={p.value} onClick={()=>updPhase(p.value)} style={{...C.phBtn,...(phase===p.value?C.phBtnOn:{})}}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {aTab==='results'&&<>
        <div style={C.gTabs}>{Object.keys(GROUPS).map(g=><button key={g} style={{...C.gTab,...(ag===g?C.gTabOn:{})}} onClick={()=>setAg(g)}>Gr.{g}</button>)}</div>
        <p style={{...C.secH,marginBottom:10}}>Kampresultater – Gruppe {ag}</p>
        {gms.map(m=>(
          <div key={m.id} style={C.mRow}>
            <span style={C.mTeam}><Flag team={m.home}/> {m.home}</span>
            <input style={C.sInp} type="number" min={0} value={results[m.id]?.home??''} placeholder='–' onChange={e=>setResult(m.id,'home',e.target.value)}/>
            <span style={C.dash}>–</span>
            <input style={C.sInp} type="number" min={0} value={results[m.id]?.away??''} placeholder='–' onChange={e=>setResult(m.id,'away',e.target.value)}/>
            <span style={{...C.mTeam,textAlign:'right'}}>{m.away} <Flag team={m.away}/></span>
          </div>
        ))}
        <p style={{...C.secH,marginTop:16}}>Grupperangering</p>
        {[0,1,2,3].map(pos=>(
          <div key={pos} style={C.plRow}>
            <span style={C.plPos}>{pos+1}.</span>
            <select style={C.sel} value={results[`grp_${ag}`]?.[pos]||''} onChange={e=>setGrpResult(ag,pos,e.target.value)}>
              <option value=''>– Velg –</option>
              {GROUPS[ag].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
      </>}

      {aTab==='knockout'&&<>
        {KNOCKOUT_ROUNDS.map(({phase:kp,label})=>(
          <div key={kp} style={{marginBottom:20}}>
            <p style={C.roundL}>{label}</p>
            {KNOCKOUT_MATCHES.filter(m=>m.phase===kp).map((m,i)=>(
              <div key={m.id} style={C.mRow}>
                <span style={{...C.mDate,minWidth:48}}>K{i+1}</span>
                <input style={C.sInp} type="number" min={0} value={results[m.id]?.home??''} placeholder='–' onChange={e=>setResult(m.id,'home',e.target.value)}/>
                <span style={C.dash}>–</span>
                <input style={C.sInp} type="number" min={0} value={results[m.id]?.away??''} placeholder='–' onChange={e=>setResult(m.id,'away',e.target.value)}/>
              </div>
            ))}
          </div>
        ))}
      </>}

      {aTab==='special'&&(
        <div style={C.specBox}>
          {[{key:'champion',label:'🥇 Verdensmester'},{key:'runner_up',label:'🥈 Sølvvinner'},
            {key:'third',label:'🥉 Bronsevinner'},{key:'topscorer',label:'⚽ Toppscorer – lag'},
            {key:'most_carded',label:'🟨 Mest kort – lag'}
          ].map(({key,label})=>(
            <div key={key} style={C.specRow}>
              <span style={C.specLabel}>{label}</span>
              <select style={C.sel} value={results[key]||''} onChange={e=>setSpec(key,e.target.value)}>
                <option value=''>– Ikke satt –</option>
                {ALL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              {results[key]&&<Flag team={results[key]}/>}
            </div>
          ))}
        </div>
      )}

      {aTab==='cards'&&<>
        <p style={{...C.mono12,marginBottom:12}}>🟨 Gult = 1 kortpoeng · 🟥 Rødt = 3 kortpoeng</p>
        <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:500,overflowY:'auto'}}>
          {ALL_TEAMS.map(team=>(
            <div key={team} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'#040911',borderRadius:6}}>
              <Flag team={team}/>
              <span style={{flex:1,fontSize:13}}> {team}</span>
              <label style={{color:'#fbbf24',fontSize:11}}>🟨</label>
              <input style={{...C.sInp,width:44}} type="number" min={0} value={cards[`_y_${team}`]||''} placeholder='0' onChange={e=>updCard(team,'y',e.target.value)}/>
              <label style={{color:'#f87171',fontSize:11}}>🟥</label>
              <input style={{...C.sInp,width:44}} type="number" min={0} value={cards[`_r_${team}`]||''} placeholder='0' onChange={e=>updCard(team,'r',e.target.value)}/>
              <span style={{color:'#c9a227',fontSize:12,minWidth:44,textAlign:'right',fontFamily:"'JetBrains Mono',monospace"}}>{cards[team]||0}kp</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('leaderboard');
  const [phase, setPhaseState] = useState('pre');

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePhase(setPhaseState);
    return unsub;
  }, [user]);

  if (!user) return <AuthScreen onLogin={u => { setUser(u); setTab('leaderboard'); }} />;

  const ws = winStatus(phase);

  const NAV_U = [
    {id:'leaderboard',icon:'🏆',label:'Tabell'},
    {id:'tips',       icon:'✏️',label:'Tips'},
    {id:'myscore',    icon:'📊',label:'Poeng'},
    {id:'live',       icon:'📡',label:'Live'},
    {id:'chat',       icon:'💬',label:'Chat'},
    {id:'video',      icon:'📹',label:'Video'},
  ];
  const NAV_A = [
    {id:'leaderboard',icon:'🏆',label:'Tabell'},
    {id:'admin',      icon:'⚙️',label:'Admin'},
    {id:'live',       icon:'📡',label:'Live'},
    {id:'chat',       icon:'💬',label:'Chat'},
  ];
  const nav = user.isAdmin ? NAV_A : NAV_U;

  return (
    <div style={C.app}>
      <header style={C.hdr}>
        <div style={C.hdrInner}>
          <div style={C.logo}>
            <span style={C.ball}>⚽</span>
            <div>
              <div style={C.ltitle}>VM-TIPPING 2026</div>
              <div style={C.lsub}>FIFA World Cup · USA · Canada · Mexico</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={C.userChip}>👤 {user.displayName}</span>
            <button style={C.btnOut} onClick={()=>setUser(null)}>Logg ut</button>
          </div>
        </div>
        {!user.isAdmin&&(
          <div style={{...C.winBanner,background:ws.color}}>{ws.label}</div>
        )}
        <nav style={C.nav}>
          {nav.map(n=>(
            <button key={n.id} style={{...C.navBtn,...(tab===n.id?C.navOn:{})}} onClick={()=>setTab(n.id)}>
              <span style={{fontSize:18}}>{n.icon}</span>
              <span style={{fontSize:11}}>{n.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main style={C.main}>
        {tab==='leaderboard'&&<Leaderboard me={user}/>}
        {tab==='tips'       &&!user.isAdmin&&<TipsForm me={user} phase={phase}/>}
        {tab==='myscore'    &&!user.isAdmin&&<MyScore me={user}/>}
        {tab==='live'       &&<LiveResults/>}
        {tab==='chat'       &&<Chat me={user}/>}
        {tab==='video'      &&!user.isAdmin&&<VideoChat me={user}/>}
        {tab==='admin'      &&user.isAdmin&&<AdminPanel/>}
      </main>

      <footer style={C.footer}>
        VM-tipping 2026 &nbsp;·&nbsp; Invitasjonskode: <code style={{color:'#c9a227'}}>{INVITE_CODE}</code> &nbsp;·&nbsp; Lykke til alle! 🌍
      </footer>
    </div>
  );
}
