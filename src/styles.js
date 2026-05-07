// VM-TIPPING 2026 – Design System v5
// Glassmorphism · Dark Stadium · Neon accents · Kanit font

export const C = {
  // ── App shell ──────────────────────────────────────────────
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1230 50%, #0a0e1a 100%)',
    fontFamily: "'Kanit', sans-serif",
    color: '#e8edf8',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  },

  // ── BANNER ─────────────────────────────────────────────────
  banner: {
    background: '#01174C',
    height: 90,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
    zIndex: 10,
    clipPath: 'none',
  },
  bannerMobile: {
    height: 80,
  },

  // Logo: overflows below banner
  bannerLogo: {
    width: 110,
    minWidth: 110,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 0,
    flexShrink: 0,
    position: 'relative',
    zIndex: 20,
    overflow: 'visible',
  },
  bannerLogoImg: {
    height: 133,
    width: 133,
    objectFit: 'contain',
    marginTop: 0,
    marginLeft: 0,
    display: 'block',
    filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.5))',
  },
  bannerLogoMobile: {
    width: 70,
    minWidth: 70,
  },
  bannerLogoImgMobile: {
    height: 110,
    width: 110,
    marginTop: 0,
    marginLeft: 0,
  },

  // Nav area
  bannerNav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '8px 16px 0 32px',
  },

  bannerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'rgba(255,255,255,.85)',
    fontSize: 14,
    fontWeight: 500,
  },
  bannerAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#FFD700',
    color: '#01174C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },
  btnLogout: {
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.18)',
    color: 'rgba(255,255,255,.7)',
    borderRadius: 8,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    letterSpacing: .5,
  },

  navBtn: {
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: 'rgba(255,255,255,.8)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: "'Kanit', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    transition: 'all .2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    borderRadius: '6px 6px 0 0',
  },
  navOn: {
    color: '#FFD700',
    background: 'rgba(255,215,0,.08)',
    borderBottomColor: '#FFD700',
  },

  windowBanner: {
    textAlign: 'center',
    padding: '7px 16px',
    fontSize: 12,
    fontFamily: "'Kanit', monospace",
    letterSpacing: 1,
    transition: 'background .5s',
    flexShrink: 0,
    fontWeight: 500,
  },

  // ── Main ───────────────────────────────────────────────────
  main: {
    flex: 1,
    padding: '24px 20px 120px 20px',
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  // ── GLASSMORPHISM CARDS ────────────────────────────────────
  card: {
    background: 'rgba(22, 27, 44, 0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,.3)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,.06)',
    background: 'rgba(255,255,255,.03)',
  },
  cardTitle: {
    fontFamily: "'Kanit', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#FFD700',
    display: 'inline-block',
    flexShrink: 0,
    boxShadow: '0 0 8px rgba(255,215,0,.6)',
  },
  cardBody: { padding: '16px 18px' },

  // ── Text ───────────────────────────────────────────────────
  secH: {
    fontFamily: "'Kanit', sans-serif",
    fontSize: 11,
    color: 'rgba(255,255,255,.65)',
    textTransform: 'uppercase',
    letterSpacing: 3,
    display: 'block',
    marginBottom: 10,
    fontWeight: 500,
  },
  mono12: {
    fontSize: 12,
    color: 'rgba(255,255,255,.65)',
    fontFamily: "'Fira Code', monospace",
  },

  // ── Dashboard grid ─────────────────────────────────────────
  dashGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  dashGrid1: { display: 'grid', gridTemplateColumns: '1fr', gap: 16 },

  // ── Stats widgets ──────────────────────────────────────────
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  statWidget: {
    background: 'rgba(22,27,44,.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16,
    padding: '14px 12px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontFamily: "'Kanit', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1,
    color: '#FFD700',
    textShadow: '0 0 20px rgba(255,215,0,.4)',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,.75)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 5,
    fontWeight: 600,
  },

  // ── Leaderboard ────────────────────────────────────────────
  lbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    marginBottom: 5,
    background: 'rgba(255,255,255,.04)',
    border: '1px solid transparent',
    transition: 'all .2s',
  },
  lbMe: {
    background: 'rgba(255,215,0,.07)',
    border: '1px solid rgba(255,215,0,.2)',
    boxShadow: '0 0 16px rgba(255,215,0,.06)',
  },
  lbRank: { width: 30, textAlign: 'center', fontSize: 18, flexShrink: 0 },
  lbName: { flex: 1, fontWeight: 600, fontSize: 15, color: '#e8edf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lbPts: {
    fontFamily: "'Kanit', sans-serif",
    fontSize: 26,
    fontWeight: 800,
    color: '#FFD700',
    lineHeight: 1,
    textShadow: '0 0 12px rgba(255,215,0,.3)',
  },
  lbPtsL: { fontSize: 9, color: 'rgba(255,255,255,.6)', fontFamily: "'Fira Code',monospace", textTransform: 'uppercase', letterSpacing: 2, textAlign: 'right' },
  youTag: { fontSize: 9, color: '#FFD700', fontFamily: "'Fira Code',monospace", background: 'rgba(255,215,0,.12)', borderRadius: 3, padding: '1px 5px', marginLeft: 4 },

  // ── Chat ───────────────────────────────────────────────────
  chatBox: {
    height: 220,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    background: 'rgba(0,0,0,.15)',
  },
  chatMsg: { display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%' },
  chatBubble: {
    borderRadius: 12,
    padding: '7px 12px',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#e8edf8',
  },
  chatUser: { fontSize: 11, color: '#FFD700', fontFamily: "'Fira Code',monospace", marginBottom: 1 },
  chatTime: { fontSize: 9, color: 'rgba(255,255,255,.55)', fontFamily: "'Fira Code',monospace" },
  chatInputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid rgba(255,255,255,.06)',
    alignItems: 'center',
    background: 'rgba(0,0,0,.1)',
  },

  // ── Match cards ────────────────────────────────────────────
  matchCard: {
    padding: '11px 16px',
    borderBottom: '1px solid rgba(255,255,255,.05)',
    background: 'rgba(255,255,255,.02)',
    transition: 'background .15s',
  },
  matchTeams: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  matchTeam: { flex: 1, fontSize: 14, fontWeight: 600, color: '#e8edf8' },
  matchScore: {
    fontFamily: "'Fira Code',monospace",
    fontSize: 18,
    fontWeight: 700,
    color: '#00e5ff',
    padding: '3px 12px',
    background: 'rgba(0,229,255,.08)',
    border: '1px solid rgba(0,229,255,.2)',
    borderRadius: 8,
    textShadow: '0 0 10px rgba(0,229,255,.4)',
  },
  matchScorers: { fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 },
  matchSummaryBtn: {
    marginTop: 7, fontSize: 12, color: '#FFD700',
    background: 'transparent', border: '1px solid rgba(255,215,0,.2)',
    borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },
  matchSummaryText: {
    marginTop: 7, fontSize: 13, color: 'rgba(255,255,255,.8)',
    lineHeight: 1.6, padding: '8px 12px',
    background: 'rgba(255,255,255,.04)', borderRadius: 8,
    border: '1px solid rgba(255,255,255,.08)',
  },
  matchSummaryAuthor: { fontSize: 11, color: '#4ade80', fontFamily: "'Fira Code',monospace", marginTop: 4 },

  // ── Forms ──────────────────────────────────────────────────
  inp: {
    width: '100%',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 10,
    color: '#e8edf8',
    padding: '11px 14px',
    fontSize: 15,
    marginBottom: 10,
    fontFamily: 'inherit',
    outline: 'none',
  },
  sel: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    color: '#e8edf8',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  ta: {
    width: '100%',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 10,
    color: '#e8edf8',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: "'Fira Code',monospace",
    resize: 'vertical',
    outline: 'none',
  },

  // ── Buttons ────────────────────────────────────────────────
  btnGold: {
    background: 'linear-gradient(135deg, #FFD700, #e6b800)',
    color: '#01174C',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Kanit',sans-serif",
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    transition: 'all .2s',
    boxShadow: '0 4px 20px rgba(255,215,0,.3)',
  },
  btnCyan: {
    background: 'linear-gradient(135deg, #00e5ff, #0099cc)',
    color: '#01174C',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Kanit',sans-serif",
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    transition: 'all .2s',
    boxShadow: '0 4px 20px rgba(0,229,255,.25)',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    color: 'rgba(255,255,255,.6)',
    borderRadius: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'all .15s',
  },
  err: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 8, fontFamily: "'Fira Code',monospace" },

  // ── Auth ───────────────────────────────────────────────────
  authWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1230 50%, #0a0e1a 100%)',
    padding: 16,
  },
  authGlow: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(1,23,76,.6) 0%, transparent 70%)',
  },
  authBox: {
    position: 'relative', zIndex: 1,
    background: 'rgba(22,27,44,.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 24,
    padding: '44px 36px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 24px 80px rgba(0,0,0,.5)',
  },
  authLogoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  authLogoImg: { height: 120, width: 120, objectFit: 'contain' },
  authSub: {
    color: 'rgba(255,255,255,.35)',
    textAlign: 'center', fontSize: 10, letterSpacing: 3,
    textTransform: 'uppercase', marginBottom: 28,
    fontFamily: "'Fira Code',monospace",
  },
  tabs: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 },
  tab: {
    flex: 1, background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent', color: 'rgba(255,255,255,.4)',
    padding: '10px', cursor: 'pointer', fontSize: 13,
    fontFamily: 'inherit', fontWeight: 600, transition: 'all .2s',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  tabOn: { color: '#FFD700', borderBottomColor: '#FFD700' },

  // ── Tips ───────────────────────────────────────────────────
  gTabs: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 },
  gTab: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    color: 'rgba(255,255,255,.5)', borderRadius: 8, padding: '4px 11px',
    cursor: 'pointer', fontSize: 12, fontFamily: "'Fira Code',monospace", transition: 'all .15s',
  },
  gTabOn: { background: 'rgba(255,215,0,.12)', color: '#FFD700', borderColor: 'rgba(255,215,0,.3)', fontWeight: 700 },
  matchList: { display: 'flex', flexDirection: 'column', gap: 3 },
  mRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '7px 10px', borderRadius: 10,
    background: 'rgba(255,255,255,.04)', flexWrap: 'wrap',
    border: '1px solid rgba(255,255,255,.05)',
  },
  mDate: { fontSize: 10, color: 'rgba(255,255,255,.55)', fontFamily: "'Fira Code',monospace", minWidth: 40 },
  mTeam: { fontSize: 13, flex: 1, minWidth: 80, fontWeight: 500, color: '#e8edf8' },
  sInp: {
    width: 46, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
    borderRadius: 8, color: '#FFD700', padding: '6px 3px',
    fontSize: 17, textAlign: 'center', fontWeight: 700,
    fontFamily: "'Fira Code',monospace", outline: 'none',
  },
  dash: { color: 'rgba(255,255,255,.2)', fontWeight: 700, fontSize: 16 },
  plRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 },
  plPos: { color: '#FFD700', fontWeight: 700, width: 20, fontFamily: "'Fira Code',monospace", fontSize: 13 },

  // ── Special ────────────────────────────────────────────────
  specBox: {
    background: 'rgba(0,0,0,.2)', borderRadius: 12, padding: 14,
    marginBottom: 16, border: '1px solid rgba(255,255,255,.07)',
  },
  specRow: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap',
  },
  specLabel: { fontSize: 13, color: 'rgba(255,255,255,.7)', minWidth: 190, fontWeight: 500 },
  ptsBadge: {
    fontFamily: "'Fira Code',monospace", fontSize: 10, color: '#4ade80',
    background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)',
    borderRadius: 4, padding: '2px 6px',
  },

  // ── Badges ─────────────────────────────────────────────────
  badge: {
    fontSize: 10, borderRadius: 20, padding: '3px 10px',
    letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
    fontFamily: "'Fira Code',monospace", display: 'inline-block',
  },
  wonBadge: {
    fontSize: 11, background: 'rgba(74,222,128,.1)', color: '#4ade80',
    border: '1px solid rgba(74,222,128,.2)', borderRadius: 4,
    padding: '2px 7px', fontFamily: "'Fira Code',monospace",
  },
  lockBanner: {
    background: 'rgba(255,100,100,.07)', border: '1px solid rgba(255,100,100,.15)',
    borderRadius: 10, padding: '11px 14px', marginBottom: 14, color: '#ff9999', fontSize: 13,
  },
  infoBox: {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: 20, marginTop: 8,
  },

  // ── Score boxes ────────────────────────────────────────────
  scoreBox: {
    background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 18,
    textAlign: 'center', border: '1px solid rgba(255,255,255,.08)',
  },
  scoreNum: { fontFamily: "'Kanit',sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: .5, lineHeight: 1 },
  scoreL: {
    fontSize: 10, color: 'rgba(255,255,255,.65)', marginTop: 6,
    fontFamily: "'Fira Code',monospace", textTransform: 'uppercase', letterSpacing: 2,
  },

  // ── Admin ──────────────────────────────────────────────────
  phBtn: {
    display: 'block', width: '100%', background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.75)', borderRadius: 8,
    padding: '9px 14px', marginBottom: 4, cursor: 'pointer',
    textAlign: 'left', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
  },
  phBtnOn: { background: 'rgba(255,215,0,.1)', color: '#FFD700', borderColor: 'rgba(255,215,0,.3)', fontWeight: 700 },
  roundL: {
    fontFamily: "'Fira Code',monospace", fontSize: 10, color: '#FFD700',
    textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, display: 'block',
  },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    textAlign: 'center', padding: '16px',
    color: 'rgba(255,255,255,.4)', fontSize: 11,
    borderTop: '1px solid rgba(255,255,255,.05)',
    fontFamily: "'Fira Code',monospace", letterSpacing: 1,
  },
  // ── Stats row ──────────────────────────────────────────────
  statsRowDesktop: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  statsRowMobile: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statWidgetMobile: {
    flex: 1,
    minWidth: 0,
    padding: '10px 6px',
  },

  // ── Dashboard fixed-height cards ──────────────────────────
  dashCardFixed: {
    display: 'flex',
    flexDirection: 'column',
    height: 476,
  },
  dashCardFixedBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 18px',
    minHeight: 0,
  },
  dashCardFixedMatchList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  dashCardFixedChat: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    minHeight: 0,
  },

  // ── Dashboard 3-column grid ────────────────────────────────
  dashGrid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
    alignItems: 'start',
  },
  dashGrid3Mobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  cardStretch: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardBodyScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 18px',
  },
  cardMatchList: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
  },

  // ── Bot summary ────────────────────────────────────────────
  botSummaryBox: {
    marginTop: 6,
    padding: '7px 11px',
    background: 'rgba(255,255,255,.03)',
    borderRadius: 6,
    borderLeft: '2px solid rgba(255,215,0,.3)',
  },
  botSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,.75)',
    lineHeight: 1.5,
  },
  botSummaryAuthor: {
    fontSize: 11,
    color: 'rgba(255,215,0,.6)',
    marginTop: 4,
    fontFamily: "'Fira Code',monospace",
  },
  botSummaryBtn: {
    marginTop: 7, fontSize: 12, color: 'rgba(255,215,0,.5)',
    background: 'transparent', border: '1px solid rgba(255,215,0,.15)',
    borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── Leaderboard extras ─────────────────────────────────────
  lbLockIcon: {
    marginLeft: 6,
    fontSize: 11,
    color: 'rgba(255,255,255,.25)',
  },

  // ── Bot banner (TipsForm / Leaderboard) ───────────────────
  botBanner: {
    marginBottom: 12,
    padding: '8px 14px',
    background: 'rgba(255,215,0,.07)',
    border: '1px solid rgba(255,215,0,.2)',
    borderRadius: 8,
    fontSize: 12,
    color: 'rgba(255,215,0,.8)',
  },

  // ── Admin reset button ─────────────────────────────────────
  btnDanger: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(248,113,113,.3)',
    color: '#f87171',
    borderRadius: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    transition: 'all .15s',
  },

  spinner: { display: 'inline-block', animation: 'spin 1s linear infinite' },
};
