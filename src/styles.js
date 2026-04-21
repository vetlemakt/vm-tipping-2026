// VM-TIPPING 2026 – Design System v3
// Dark + Neon Green · Sidebar layout · Mobile-first

const G = '#39ff7e';   // neon green
const GP = 'rgba(57,255,126,';

export const C = {
  // ── Shell ──────────────────────────────────────────────────
  app: { display:'flex', minHeight:'100vh', background:'#07070f', fontFamily:"'Plus Jakarta Sans',sans-serif", color:'#e2e2f0' },

  // ── Sidebar ────────────────────────────────────────────────
  sidebar: {
    width: 220, minWidth: 220, background:'#0c0c18',
    borderRight:'1px solid #141428', display:'flex',
    flexDirection:'column', position:'sticky', top:0,
    height:'100vh', overflowY:'auto', zIndex:50,
    transition:'transform .3s ease',
  },
  sidebarMobile: {
    position:'fixed', inset:0, zIndex:200,
    width:260, background:'#0c0c18',
    borderRight:'1px solid #141428',
    display:'flex', flexDirection:'column',
    transform:'translateX(-100%)',
    transition:'transform .3s ease',
    overflowY:'auto',
  },
  sidebarOpen: { transform:'translateX(0)' },
  sidebarOverlay: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.6)',
    zIndex:199, display:'none',
  },
  sidebarLogo: {
    padding:'24px 20px 16px', borderBottom:'1px solid #141428',
  },
  logoTitle: {
    fontFamily:"'Space Grotesk',sans-serif", fontSize:22,
    fontWeight:700, color:G, letterSpacing:1,
    textTransform:'uppercase', lineHeight:1,
  },
  logoSub: {
    fontSize:10, color:'#2a2a4a', letterSpacing:2,
    textTransform:'uppercase', marginTop:4,
    fontFamily:"'Fira Code',monospace",
  },
  navSection: { padding:'16px 12px 8px' },
  navLabel: {
    fontSize:9, color:'#252540', letterSpacing:3,
    textTransform:'uppercase', fontFamily:"'Fira Code',monospace",
    padding:'0 8px', marginBottom:6, display:'block',
  },
  navItem: {
    display:'flex', alignItems:'center', gap:10,
    padding:'9px 12px', borderRadius:8, cursor:'pointer',
    fontSize:14, fontWeight:500, color:'#4a4a70',
    border:'none', background:'transparent', width:'100%',
    textAlign:'left', transition:'all .15s', marginBottom:2,
  },
  navItemOn: {
    background:`${GP}.1)`, color:G,
    borderLeft:`2px solid ${G}`, paddingLeft:10,
  },
  navIcon: { fontSize:16, width:20, textAlign:'center' },

  sidebarBottom: {
    marginTop:'auto', padding:'16px 12px',
    borderTop:'1px solid #141428',
  },
  userRow: {
    display:'flex', alignItems:'center', gap:10,
    padding:'8px 12px', borderRadius:8,
    background:'#141428', marginBottom:8,
  },
  userAvatar: {
    width:32, height:32, borderRadius:'50%',
    background:`${GP}.15)`, border:`1px solid ${GP}.3)`,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:12, fontWeight:700, color:G, flexShrink:0,
  },
  userName: { fontSize:13, fontWeight:600, color:'#e2e2f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  btnLogout: {
    width:'100%', background:'transparent', border:'1px solid #1e1e38',
    color:'#333355', borderRadius:6, padding:'7px', cursor:'pointer',
    fontSize:12, fontFamily:'inherit', transition:'all .15s',
  },

  // ── Content area ───────────────────────────────────────────
  content: { flex:1, display:'flex', flexDirection:'column', minWidth:0 },
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 20px', borderBottom:'1px solid #141428',
    background:'#07070f', position:'sticky', top:0, zIndex:40,
  },
  topbarTitle: {
    fontFamily:"'Space Grotesk',sans-serif", fontSize:20,
    fontWeight:700, color:'#fff',
  },
  hamburger: {
    background:'transparent', border:'none', color:'#4a4a70',
    fontSize:22, cursor:'pointer', padding:'4px 8px',
    display:'none',
  },
  windowBanner: {
    textAlign:'center', padding:'7px 16px', fontSize:11,
    fontFamily:"'Fira Code',monospace", letterSpacing:.5,
    transition:'background .5s', borderBottom:'1px solid #141428',
  },
  main: { flex:1, padding:'20px', overflowY:'auto' },

  // ── Dashboard grid ─────────────────────────────────────────
  dashGrid: {
    display:'grid',
    gridTemplateColumns:'1fr 1fr',
    gridTemplateRows:'auto',
    gap:16,
  },
  dashGridMobile: { gridTemplateColumns:'1fr' },
  dashFull: { gridColumn:'1 / -1' },

  // ── Cards ──────────────────────────────────────────────────
  card: {
    background:'#0c0c18', border:'1px solid #141428',
    borderRadius:14, overflow:'hidden',
  },
  cardHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid #0f0f20',
  },
  cardTitle: {
    fontFamily:"'Space Grotesk',sans-serif", fontSize:14,
    fontWeight:700, color:'#fff', textTransform:'uppercase',
    letterSpacing:1, display:'flex', alignItems:'center', gap:8,
  },
  cardBody: { padding:'14px 16px' },
  cardTitleDot: {
    width:6, height:6, borderRadius:'50%', background:G,
    display:'inline-block',
  },

  // ── Leaderboard ────────────────────────────────────────────
  lbRow: {
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 14px', borderRadius:10, marginBottom:4,
    background:'#07070f', transition:'background .15s',
  },
  lbMe: { background:`${GP}.05)`, border:`1px solid ${GP}.15)` },
  lbRank: { width:28, textAlign:'center', fontSize:16, flexShrink:0 },
  lbName: { flex:1, fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  lbPts: {
    fontFamily:"'Space Grotesk',sans-serif", fontSize:22,
    fontWeight:700, color:G, letterSpacing:.5, lineHeight:1,
  },
  lbPtsL: { fontSize:9, color:'#252540', fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2, textAlign:'right' },
  youTag: { fontSize:9, color:G, fontFamily:"'Fira Code',monospace", background:`${GP}.08)`, borderRadius:3, padding:'1px 5px', marginLeft:4 },

  // ── Chat ───────────────────────────────────────────────────
  chatBox: {
    height:220, overflowY:'auto', display:'flex',
    flexDirection:'column', gap:8, padding:'12px 14px',
  },
  chatMsg: { display:'flex', flexDirection:'column', gap:2, maxWidth:'80%' },
  chatBubble: {
    borderRadius:10, padding:'7px 11px', fontSize:13,
    lineHeight:1.5,
  },
  chatUser: { fontSize:10, color:G, fontFamily:"'Fira Code',monospace", marginBottom:1 },
  chatTime: { fontSize:9, color:'#252540', fontFamily:"'Fira Code',monospace" },
  chatInputRow: {
    display:'flex', gap:8, padding:'10px 14px',
    borderTop:'1px solid #0f0f20', alignItems:'center',
  },

  // ── Match results ──────────────────────────────────────────
  matchCard: {
    padding:'10px 14px', borderBottom:'1px solid #0f0f20',
    cursor:'pointer', transition:'background .15s',
  },
  matchTeams: { display:'flex', alignItems:'center', gap:6, marginBottom:4 },
  matchTeam: { flex:1, fontSize:13, fontWeight:600 },
  matchScore: {
    fontFamily:"'Fira Code',monospace", fontSize:16,
    fontWeight:700, color:G, padding:'2px 10px',
    background:`${GP}.08)`, borderRadius:6,
  },
  matchScorers: { fontSize:11, color:'#4a4a70', marginTop:3 },
  matchSummaryBtn: {
    marginTop:6, fontSize:11, color:G, background:'transparent',
    border:`1px solid ${GP}.2)`, borderRadius:5, padding:'3px 10px',
    cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
  },
  matchSummaryText: {
    marginTop:6, fontSize:12, color:'#a0a0c0', lineHeight:1.5,
    padding:'8px', background:'#07070f', borderRadius:6,
    border:'1px solid #141428',
  },
  matchSummaryAuthor: { fontSize:10, color:'#39ff7e', fontFamily:"'Fira Code',monospace", marginTop:3 },

  // ── Forms ──────────────────────────────────────────────────
  inp: {
    width:'100%', background:'#07070f', border:'1px solid #1e1e38',
    borderRadius:9, color:'#e2e2f0', padding:'11px 14px',
    fontSize:14, marginBottom:10, fontFamily:'inherit', outline:'none',
  },
  sel: {
    background:'#07070f', border:'1px solid #1e1e38', borderRadius:8,
    color:'#e2e2f0', padding:'7px 10px', fontSize:13,
    fontFamily:'inherit', cursor:'pointer',
  },
  ta: {
    width:'100%', background:'#07070f', border:'1px solid #1e1e38',
    borderRadius:9, color:'#e2e2f0', padding:'10px 12px',
    fontSize:12, fontFamily:"'Fira Code',monospace",
    resize:'vertical', outline:'none',
  },
  btnGreen: {
    background:`linear-gradient(135deg,${G},#00e064)`, color:'#07070f',
    border:'none', borderRadius:9, padding:'11px 20px',
    fontWeight:800, fontSize:13, cursor:'pointer',
    fontFamily:"'Space Grotesk',sans-serif", letterSpacing:1,
    textTransform:'uppercase', transition:'opacity .2s',
    boxShadow:`0 4px 20px ${GP}.2)`,
  },
  btnSecondary: {
    background:'transparent', border:'1px solid #1e1e38',
    color:'#4a4a70', borderRadius:8, padding:'8px 16px',
    cursor:'pointer', fontSize:13, fontFamily:'inherit',
  },
  err: { color:'#ff4488', fontSize:12, textAlign:'center', marginBottom:8, fontFamily:"'Fira Code',monospace" },

  // ── Auth ───────────────────────────────────────────────────
  authWrap: {
    minHeight:'100vh', display:'flex', alignItems:'center',
    justifyContent:'center', background:'#07070f', padding:16,
  },
  authGlow: {
    position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
    background:`radial-gradient(ellipse 60% 50% at 50% 0%,${GP}.08) 0%,transparent 70%)`,
  },
  authBox: {
    position:'relative', zIndex:1,
    background:'#0c0c18', border:'1px solid #141428',
    borderRadius:20, padding:'44px 36px',
    width:'100%', maxWidth:420,
    boxShadow:`0 0 80px ${GP}.06)`,
  },
  authBall: {
    fontSize:72, textAlign:'center', marginBottom:8,
    display:'block', lineHeight:1,
  },
  authTitle: {
    fontFamily:"'Space Grotesk',sans-serif", fontSize:30,
    fontWeight:700, textAlign:'center', color:'#fff',
    letterSpacing:1, marginBottom:4, textTransform:'uppercase',
  },
  authAccent: { color:G },
  authSub: {
    color:'#252540', textAlign:'center', fontSize:10,
    letterSpacing:3, textTransform:'uppercase',
    marginBottom:28, fontFamily:"'Fira Code',monospace",
  },
  tabs: { display:'flex', borderBottom:'1px solid #141428', marginBottom:20 },
  tab: {
    flex:1, background:'transparent', border:'none',
    borderBottom:'2px solid transparent', color:'#333355',
    padding:'10px', cursor:'pointer', fontSize:13,
    fontFamily:'inherit', fontWeight:600, transition:'all .2s',
    textTransform:'uppercase', letterSpacing:1,
  },
  tabOn: { color:G, borderBottomColor:G },

  // ── Tips ───────────────────────────────────────────────────
  gTabs: { display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 },
  gTab: {
    background:'transparent', border:'1px solid #1e1e38',
    color:'#333355', borderRadius:7, padding:'4px 11px',
    cursor:'pointer', fontSize:11, fontFamily:"'Fira Code',monospace",
    transition:'all .15s',
  },
  gTabOn: { background:`${GP}.1)`, color:G, borderColor:`${GP}.3)`, fontWeight:700 },
  matchList: { display:'flex', flexDirection:'column', gap:3 },
  mRow: {
    display:'flex', alignItems:'center', gap:7,
    padding:'7px 10px', borderRadius:7, background:'#07070f',
    flexWrap:'wrap',
  },
  mDate: { fontSize:10, color:'#1e1e38', fontFamily:"'Fira Code',monospace", minWidth:40 },
  mTeam: { fontSize:13, flex:1, minWidth:80, fontWeight:500 },
  sInp: {
    width:46, background:'#0c0c18', border:'1px solid #1e1e38',
    borderRadius:7, color:G, padding:'6px 3px',
    fontSize:17, textAlign:'center', fontWeight:700,
    fontFamily:"'Fira Code',monospace", outline:'none',
  },
  dash: { color:'#1e1e38', fontWeight:700, fontSize:16 },
  plRow: { display:'flex', alignItems:'center', gap:8, marginBottom:7 },
  plPos: { color:G, fontWeight:700, width:20, fontFamily:"'Fira Code',monospace", fontSize:13 },

  // ── Special ────────────────────────────────────────────────
  specBox: { background:'#07070f', borderRadius:10, padding:14, marginBottom:16, border:'1px solid #141428' },
  specRow: { display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:'1px solid #0c0c18', flexWrap:'wrap' },
  specLabel: { fontSize:13, color:'#666688', minWidth:180, fontWeight:500 },
  ptsBadge: {
    fontFamily:"'Fira Code',monospace", fontSize:10, color:G,
    background:`${GP}.08)`, border:`1px solid ${GP}.15)`,
    borderRadius:4, padding:'2px 6px',
  },

  // ── Score boxes ────────────────────────────────────────────
  scoreBox: { background:'#07070f', borderRadius:12, padding:18, textAlign:'center', border:'1px solid #141428' },
  scoreNum: { fontFamily:"'Space Grotesk',sans-serif", fontSize:44, fontWeight:700, letterSpacing:.5, lineHeight:1 },
  scoreL: { fontSize:10, color:'#252540', marginTop:6, fontFamily:"'Fira Code',monospace", textTransform:'uppercase', letterSpacing:2 },

  // ── Admin ──────────────────────────────────────────────────
  phBtn: {
    display:'block', width:'100%', background:'transparent',
    border:'1px solid #141428', color:'#333355', borderRadius:8,
    padding:'9px 14px', marginBottom:4, cursor:'pointer',
    textAlign:'left', fontSize:13, fontFamily:'inherit', transition:'all .15s',
  },
  phBtnOn: { background:`${GP}.08)`, color:G, borderColor:`${GP}.25)`, fontWeight:700 },
  roundL: {
    fontFamily:"'Fira Code',monospace", fontSize:10, color:G,
    textTransform:'uppercase', letterSpacing:3, marginBottom:8, display:'block',
  },
  secH: {
    fontFamily:"'Fira Code',monospace", fontSize:10, color:'#252540',
    textTransform:'uppercase', letterSpacing:3, display:'block', marginBottom:8,
  },
  mono12: { fontSize:11, color:'#333355', fontFamily:"'Fira Code',monospace" },

  // ── Badges ─────────────────────────────────────────────────
  badge: { fontSize:10, borderRadius:20, padding:'3px 10px', letterSpacing:1, textTransform:'uppercase', fontWeight:700, fontFamily:"'Fira Code',monospace", display:'inline-block' },
  wonBadge: { fontSize:10, background:`${GP}.08)`, color:G, border:`1px solid ${GP}.15)`, borderRadius:4, padding:'2px 7px', fontFamily:"'Fira Code',monospace" },
  lockBanner: { background:'rgba(255,68,136,.05)', border:'1px solid rgba(255,68,136,.12)', borderRadius:9, padding:'11px 14px', marginBottom:14, color:'#ff6699', fontSize:13 },
  infoBox: { background:'#07070f', border:'1px solid #141428', borderRadius:11, padding:20, marginTop:8 },
  spinner: { display:'inline-block', animation:'spin 1s linear infinite' },
};
