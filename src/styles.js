// VM-TIPPING 2026 – REDESIGN v2
// Aesthetic: Retro Stadium + Neon Nights
// Palette: Electric Lime · Deep Purple · Hot Pink · Pitch Black
// Fonts: Black Han Sans (display) · Outfit (body) · JetBrains Mono (mono)

export const C = {
  app: { minHeight:'100vh', background:'#080810', fontFamily:"'Outfit',sans-serif", color:'#e8e8f0', fontSize:16, overflowX:'hidden' },

  hdr: { background:'linear-gradient(180deg,#0d0d1a 0%,#080810 100%)', borderBottom:'1px solid rgba(180,255,0,.15)', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 30px rgba(180,255,0,.08)' },
  hdrInner: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', flexWrap:'wrap', gap:8 },
  logo: { display:'flex', alignItems:'center', gap:14 },
  ball: { fontSize:36, lineHeight:1, filter:'drop-shadow(0 0 14px rgba(180,255,0,.9))' },
  ltitle: { fontFamily:"'Black Han Sans',sans-serif", fontSize:28, background:'linear-gradient(90deg,#b4ff00,#00ffaa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:2, lineHeight:1, textTransform:'uppercase' },
  lsub: { fontSize:9, color:'#333', letterSpacing:3, textTransform:'uppercase', marginTop:3, fontFamily:"'JetBrains Mono',monospace" },
  userChip: { fontSize:12, color:'#b4ff00', background:'rgba(180,255,0,.06)', border:'1px solid rgba(180,255,0,.2)', borderRadius:20, padding:'5px 14px', fontFamily:"'JetBrains Mono',monospace" },
  btnOut: { background:'transparent', border:'1px solid #1e1e2e', color:'#444', borderRadius:6, padding:'5px 14px', cursor:'pointer', fontSize:13, fontFamily:'inherit' },
  winBanner: { textAlign:'center', padding:'7px 16px', fontSize:12, fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, transition:'background .5s', borderTop:'1px solid #0d0d1a' },
  nav: { display:'flex', overflowX:'auto', padding:'0 12px', gap:0 },
  navBtn: { background:'transparent', border:'none', color:'#333', padding:'10px 18px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", borderBottom:'2px solid transparent', transition:'all .2s', display:'flex', flexDirection:'column', alignItems:'center', gap:2, whiteSpace:'nowrap', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5 },
  navOn: { color:'#b4ff00', borderBottomColor:'#b4ff00' },

  main: { maxWidth:920, margin:'0 auto', padding:'28px 16px' },
  footer: { textAlign:'center', padding:'28px', color:'#1a1a2e', fontSize:11, borderTop:'1px solid #0d0d1a', fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 },

  card: { background:'#0d0d1a', border:'1px solid #1a1a2e', borderRadius:16, padding:24, marginBottom:20, position:'relative', overflow:'hidden' },
  cardH: { fontFamily:"'Black Han Sans',sans-serif", fontSize:22, color:'#fff', letterSpacing:1, marginBottom:20, textTransform:'uppercase' },
  secH: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#333', textTransform:'uppercase', letterSpacing:3, display:'block', marginBottom:10 },
  mono12: { fontSize:11, color:'#333', fontFamily:"'JetBrains Mono',monospace" },
  row: { display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' },

  authWrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080810', padding:16, position:'relative' },
  authBg: { position:'fixed', inset:0, zIndex:0, pointerEvents:'none', background:'radial-gradient(ellipse 70% 50% at 30% 30%,rgba(180,255,0,.06) 0%,transparent 60%), radial-gradient(ellipse 60% 50% at 70% 70%,rgba(255,0,128,.05) 0%,transparent 60%)' },
  authBox: { position:'relative', zIndex:1, background:'#0d0d1a', border:'1px solid #1a1a2e', borderRadius:24, padding:'48px 40px', width:'100%', maxWidth:440, boxShadow:'0 0 80px rgba(180,255,0,.06), 0 0 0 1px rgba(180,255,0,.04)' },
  authBall: { fontSize:80, textAlign:'center', marginBottom:8, display:'block', filter:'drop-shadow(0 0 24px rgba(180,255,0,.7))' },
  authTitle: { fontFamily:"'Black Han Sans',sans-serif", fontSize:34, textAlign:'center', background:'linear-gradient(90deg,#b4ff00,#00ffaa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:3, marginBottom:4, textTransform:'uppercase' },
  authSub: { color:'#252535', textAlign:'center', fontSize:10, letterSpacing:3, textTransform:'uppercase', marginBottom:32, fontFamily:"'JetBrains Mono',monospace" },

  inp: { width:'100%', background:'#080810', border:'1px solid #1a1a2e', borderRadius:10, color:'#e8e8f0', padding:'12px 16px', fontSize:15, marginBottom:12, fontFamily:"'Outfit',sans-serif", outline:'none' },
  sel: { background:'#080810', border:'1px solid #1a1a2e', borderRadius:8, color:'#e8e8f0', padding:'8px 12px', fontSize:14, fontFamily:"'Outfit',sans-serif", cursor:'pointer' },
  ta: { width:'100%', background:'#080810', border:'1px solid #1a1a2e', borderRadius:10, color:'#e8e8f0', padding:'12px 14px', fontSize:12, fontFamily:"'JetBrains Mono',monospace", resize:'vertical', outline:'none' },
  btnGold: { width:'100%', background:'linear-gradient(135deg,#b4ff00,#00e87a)', color:'#080810', border:'none', borderRadius:10, padding:'13px 24px', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:"'Black Han Sans',sans-serif", letterSpacing:3, display:'block', transition:'all .2s', textTransform:'uppercase', boxShadow:'0 4px 24px rgba(180,255,0,.2)' },
  btnSm: { background:'transparent', border:'1px solid #1a1a2e', color:'#444', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontFamily:'inherit' },
  err: { color:'#ff4488', fontSize:13, textAlign:'center', marginBottom:10, fontFamily:"'JetBrains Mono',monospace" },

  tabs: { display:'flex', borderBottom:'1px solid #1a1a2e', marginBottom:20 },
  tab: { flex:1, background:'transparent', border:'none', borderBottom:'2px solid transparent', color:'#333', padding:'10px', cursor:'pointer', fontSize:12, fontFamily:"'Outfit',sans-serif", fontWeight:700, transition:'all .2s', textTransform:'uppercase', letterSpacing:1 },
  tabOn: { color:'#b4ff00', borderBottomColor:'#b4ff00' },

  gTabs: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 },
  gTab: { background:'transparent', border:'1px solid #1a1a2e', color:'#333', borderRadius:8, padding:'5px 13px', cursor:'pointer', fontSize:12, fontFamily:"'JetBrains Mono',monospace", transition:'all .2s' },
  gTabOn: { background:'rgba(180,255,0,.08)', color:'#b4ff00', borderColor:'rgba(180,255,0,.3)', fontWeight:700 },

  matchList: { display:'flex', flexDirection:'column', gap:4 },
  mRow: { display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'#080810', flexWrap:'wrap' },
  mDate: { fontSize:10, color:'#1e1e2e', fontFamily:"'JetBrains Mono',monospace", minWidth:44 },
  mTeam: { fontSize:14, flex:1, minWidth:90, fontWeight:500 },
  sInp: { width:50, background:'#0d0d1a', border:'1px solid #252535', borderRadius:8, color:'#b4ff00', padding:'7px 4px', fontSize:18, textAlign:'center', fontWeight:700, fontFamily:"'JetBrains Mono',monospace", outline:'none' },
  dash: { color:'#1a1a2e', fontWeight:700, fontSize:18 },

  plRow: { display:'flex', alignItems:'center', gap:10, marginBottom:8 },
  plPos: { color:'#b4ff00', fontWeight:700, width:24, fontFamily:"'JetBrains Mono',monospace" },

  specBox: { background:'#080810', borderRadius:12, padding:16, marginBottom:20, border:'1px solid #1a1a2e' },
  specRow: { display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #0d0d1a', flexWrap:'wrap' },
  specLabel: { fontSize:14, color:'#666', minWidth:190, fontWeight:500 },
  ptsBadge: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#b4ff00', background:'rgba(180,255,0,.08)', border:'1px solid rgba(180,255,0,.15)', borderRadius:4, padding:'2px 7px' },

  badge: { fontSize:11, borderRadius:20, padding:'4px 12px', letterSpacing:1, textTransform:'uppercase', fontWeight:700, fontFamily:"'JetBrains Mono',monospace", display:'inline-block' },
  youTag: { fontSize:10, color:'#b4ff00', fontFamily:"'JetBrains Mono',monospace", background:'rgba(180,255,0,.08)', borderRadius:4, padding:'1px 6px', marginLeft:6 },
  wonBadge: { fontSize:11, background:'rgba(180,255,0,.08)', color:'#b4ff00', border:'1px solid rgba(180,255,0,.15)', borderRadius:4, padding:'2px 8px', fontFamily:"'JetBrains Mono',monospace" },

  lbRow: { display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderRadius:12, marginBottom:6, background:'#080810', border:'1px solid transparent', transition:'all .2s' },
  lbMe: { background:'rgba(180,255,0,.04)', border:'1px solid rgba(180,255,0,.15)' },
  lbRank: { fontSize:24, width:36, textAlign:'center' },
  lbName: { flex:1, fontWeight:600, fontSize:16 },
  lbPts: { fontFamily:"'Black Han Sans',sans-serif", fontSize:32, color:'#b4ff00', letterSpacing:1, lineHeight:1 },
  lbPtsL: { fontSize:9, color:'#252535', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:2, textAlign:'right' },

  scoreBox: { background:'#080810', borderRadius:14, padding:22, textAlign:'center', border:'1px solid #1a1a2e' },
  scoreNum: { fontFamily:"'Black Han Sans',sans-serif", fontSize:52, letterSpacing:1, lineHeight:1 },
  scoreL: { fontSize:10, color:'#333', marginTop:8, fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:2 },

  chatBox: { height:340, overflowY:'auto', background:'#080810', borderRadius:14, padding:16, marginBottom:12, border:'1px solid #1a1a2e', display:'flex', flexDirection:'column', gap:10 },

  phBtn: { display:'block', width:'100%', background:'transparent', border:'1px solid #1a1a2e', color:'#333', borderRadius:8, padding:'10px 16px', marginBottom:5, cursor:'pointer', textAlign:'left', fontSize:13, fontFamily:'inherit', transition:'all .2s' },
  phBtnOn: { background:'rgba(180,255,0,.08)', color:'#b4ff00', borderColor:'rgba(180,255,0,.3)', fontWeight:700 },
  roundL: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#b4ff00', textTransform:'uppercase', letterSpacing:3, marginBottom:10, display:'block' },

  lockBanner: { background:'rgba(255,68,136,.05)', border:'1px solid rgba(255,68,136,.15)', borderRadius:10, padding:'12px 16px', marginBottom:16, color:'#ff4488', fontSize:14 },
  infoBox: { background:'#080810', border:'1px solid #1a1a2e', borderRadius:12, padding:22, marginTop:8 },
  spinner: { display:'inline-block', animation:'spin 1s linear infinite' },
};
