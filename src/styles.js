// VM-TIPPING 2026 – Design System v4
// Banner-top layout · Logo øverst venstre · Meny i banner
// Palette fra logoen: #01174C (navy), #FFD700 (gul), #E63232 (rød), #2EAA4A (grønn), #fff

const NAV = '#01174C';
const YEL = '#FFD700';
const RED = '#E63232';
const GRN = '#2EAA4A';
const W   = '#ffffff';

export const C = {
  // ── App shell ──────────────────────────────────────────────
  app: {
    minHeight: '100vh',
    background: '#f2f5fc',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#1a2040',
    display: 'flex',
    flexDirection: 'column',
  },

  // ── TOP BANNER ─────────────────────────────────────────────
  banner: {
    background: NAV,
    height: 100,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerMobile: {
    height: 'auto',
    flexDirection: 'column',
    minHeight: 80,
  },

  // Logo section (left side of banner)
  bannerLogo: {
    width: 100,
    minWidth: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 0 6px 12px',
    flexShrink: 0,
  },
  bannerLogoImg: {
    height: 88,
    width: 88,
    objectFit: 'contain',
  },
  bannerLogoMobile: {
    width: '100%',
    padding: '16px',
    justifyContent: 'center',
  },
  bannerLogoImgMobile: {
    height: 120,
    width: 120,
  },

  // Nav section (right side of banner)
  bannerNav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '8px 16px 0 16px',
  },

  // Top row in banner: user info + logout
  bannerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginLeft: 'auto',
    paddingBottom: 0,
  },
  bannerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'rgba(255,255,255,.8)',
    fontSize: 13,
    fontWeight: 500,
  },
  bannerAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: YEL,
    color: NAV,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },
  btnLogout: {
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.2)',
    color: 'rgba(255,255,255,.7)',
    borderRadius: 6,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  },

  // Nav tabs inside banner
  bannerNavTabs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    flexWrap: 'wrap',
    width: '100%',
  },
  navBtn: {
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: 'rgba(255,255,255,.55)',
    padding: '10px 18px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    transition: 'all .2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    whiteSpace: 'nowrap',
    borderRadius: '6px 6px 0 0',
  },
  navOn: {
    color: W,
    background: 'rgba(255,255,255,.1)',
    borderBottomColor: YEL,
  },

  // Window status banner
  windowBanner: {
    textAlign: 'center',
    padding: '8px 16px',
    fontSize: 12,
    fontFamily: "'Fira Code', monospace",
    letterSpacing: .5,
    transition: 'background .5s',
    flexShrink: 0,
  },

  // ── Main content ───────────────────────────────────────────
  main: {
    flex: 1,
    padding: '20px',
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  // ── Cards ──────────────────────────────────────────────────
  card: {
    background: '#ffffff',
    border: '1px solid #b8cce8',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #2a3050',
    background: '#eef2fb',
  },
  cardTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    color: '#01174C',
    textTransform: 'uppercase',
    letterSpacing: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: YEL,
    display: 'inline-block',
    flexShrink: 0,
  },
  cardBody: { padding: '16px 18px' },

  // ── Text colors (HIGH CONTRAST) ────────────────────────────
  secH: {
    fontFamily: "'Fira Code', monospace",
    fontSize: 11,
    color: '#5a7aaa',
    textTransform: 'uppercase',
    letterSpacing: 2,
    display: 'block',
    marginBottom: 10,
  },
  mono12: {
    fontSize: 12,
    color: '#5a7aaa',
    fontFamily: "'Fira Code', monospace",
  },

  // ── Dashboard grid ─────────────────────────────────────────
  dashGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  dashGrid1: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 16,
  },

  // ── Leaderboard ────────────────────────────────────────────
  lbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderRadius: 10,
    marginBottom: 5,
    background: '#f4f8ff',
    border: '1px solid transparent',
  },
  lbMe: {
    background: `rgba(255,215,0,.06)`,
    border: `1px solid rgba(255,215,0,.2)`,
  },
  lbRank: { width: 30, textAlign: 'center', fontSize: 18, flexShrink: 0 },
  lbName: { flex: 1, fontWeight: 600, fontSize: 15, color: '#1a2040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lbPts: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 26,
    fontWeight: 700,
    color: YEL,
    lineHeight: 1,
  },
  lbPtsL: {
    fontSize: 9,
    color: '#6070a0',
    fontFamily: "'Fira Code', monospace",
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'right',
  },
  youTag: {
    fontSize: 10,
    color: YEL,
    fontFamily: "'Fira Code', monospace",
    background: 'rgba(255,215,0,.1)',
    borderRadius: 3,
    padding: '1px 5px',
    marginLeft: 4,
  },

  // ── Chat ───────────────────────────────────────────────────
  chatBox: {
    height: 220,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    background: '#f8faff',
  },
  chatMsg: { display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%' },
  chatBubble: {
    borderRadius: 10,
    padding: '7px 12px',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#1a2040',
  },
  chatUser: { fontSize: 11, color: YEL, fontFamily: "'Fira Code', monospace", marginBottom: 1 },
  chatTime: { fontSize: 10, color: '#6070a0', fontFamily: "'Fira Code', monospace" },
  chatInputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid #2a3050',
    alignItems: 'center',
    background: '#eef2fb',
  },

  // ── Match cards ────────────────────────────────────────────
  matchCard: {
    padding: '11px 16px',
    borderBottom: '1px solid #dde8f8',
    background: '#fafcff',
  },
  matchTeams: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  matchTeam: { flex: 1, fontSize: 14, fontWeight: 600, color: '#e8eaf0' },
  matchScore: {
    fontFamily: "'Fira Code', monospace",
    fontSize: 18,
    fontWeight: 700,
    color: '#01174C',
    padding: '3px 12px',
    background: 'rgba(1,23,76,.08)',
    border: '1px solid rgba(1,23,76,.15)',
    borderRadius: 6,
  },
  matchScorers: { fontSize: 12, color: '#8090b0', marginTop: 2 },
  matchSummaryBtn: {
    marginTop: 7,
    fontSize: 12,
    color: YEL,
    background: 'transparent',
    border: `1px solid rgba(255,215,0,.25)`,
    borderRadius: 5,
    padding: '4px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  matchSummaryText: {
    marginTop: 7,
    fontSize: 13,
    color: '#c0c8e0',
    lineHeight: 1.6,
    padding: '8px 12px',
    background: '#eef2fb',
    borderRadius: 7,
    border: '1px solid #b8cce8',
  },
  matchSummaryAuthor: {
    fontSize: 11,
    color: GRN,
    fontFamily: "'Fira Code', monospace",
    marginTop: 4,
  },

  // ── Forms ──────────────────────────────────────────────────
  inp: {
    width: '100%',
    background: '#0b0f1a',
    border: '1px solid #2a3050',
    borderRadius: 9,
    color: '#1a2040',
    padding: '11px 14px',
    fontSize: 15,
    marginBottom: 10,
    fontFamily: 'inherit',
    outline: 'none',
  },
  sel: {
    background: '#0b0f1a',
    border: '1px solid #2a3050',
    borderRadius: 8,
    color: '#1a2040',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  ta: {
    width: '100%',
    background: '#0b0f1a',
    border: '1px solid #2a3050',
    borderRadius: 9,
    color: '#1a2040',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: "'Fira Code', monospace",
    resize: 'vertical',
    outline: 'none',
  },
  btnGold: {
    background: `linear-gradient(135deg, ${YEL}, #e6b800)`,
    color: NAV,
    border: 'none',
    borderRadius: 9,
    padding: '11px 20px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: 1,
    textTransform: 'uppercase',
    transition: 'opacity .2s',
    boxShadow: `0 4px 20px rgba(255,215,0,.2)`,
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid #b8cce8',
    color: '#5a7aaa',
    borderRadius: 8,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  err: {
    color: RED,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: "'Fira Code', monospace",
  },

  // ── Auth ───────────────────────────────────────────────────
  authWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f2f5fc',
    padding: 16,
  },
  authGlow: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(1,23,76,.4) 0%, transparent 70%)`,
  },
  authBox: {
    position: 'relative', zIndex: 1,
    background: '#ffffff',
    border: '1px solid #b8cce8',
    borderRadius: 20,
    padding: '44px 36px',
    width: '100%', maxWidth: 420,
    boxShadow: `0 0 60px rgba(1,23,76,.5)`,
  },
  authLogoWrap: {
    display: 'flex', justifyContent: 'center', marginBottom: 16,
  },
  authLogoImg: { height: 120, width: 120, objectFit: 'contain' },
  authSub: {
    color: '#6070a0',
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 28,
    fontFamily: "'Fira Code', monospace",
  },
  tabs: { display: 'flex', borderBottom: '1px solid #b8cce8', marginBottom: 20 },
  tab: {
    flex: 1, background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent', color: '#6070a0',
    padding: '10px', cursor: 'pointer', fontSize: 13,
    fontFamily: 'inherit', fontWeight: 600, transition: 'all .2s',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  tabOn: { color: YEL, borderBottomColor: YEL },

  // ── Tips ───────────────────────────────────────────────────
  gTabs: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 },
  gTab: {
    background: 'transparent', border: '1px solid #b8cce8',
    color: '#5a7aaa', borderRadius: 7, padding: '4px 11px',
    cursor: 'pointer', fontSize: 12, fontFamily: "'Fira Code', monospace",
    transition: 'all .15s',
  },
  gTabOn: {
    background: 'rgba(255,215,0,.1)', color: YEL,
    borderColor: 'rgba(255,215,0,.3)', fontWeight: 700,
  },
  matchList: { display: 'flex', flexDirection: 'column', gap: 3 },
  mRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '7px 10px', borderRadius: 7, background: '#f0f4fc', flexWrap: 'wrap',
  },
  mDate: { fontSize: 10, color: '#4a5a80', fontFamily: "'Fira Code', monospace", minWidth: 40 },
  mTeam: { fontSize: 13, flex: 1, minWidth: 80, fontWeight: 500, color: '#1a2040' },
  sInp: {
    width: 46, background: '#f0f4fc', border: '1px solid #b8cce8',
    borderRadius: 7, color: '#01174C', padding: '6px 3px',
    fontSize: 17, textAlign: 'center', fontWeight: 700,
    fontFamily: "'Fira Code', monospace", outline: 'none',
  },
  dash: { color: '#2a3050', fontWeight: 700, fontSize: 16 },
  plRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 },
  plPos: { color: YEL, fontWeight: 700, width: 20, fontFamily: "'Fira Code', monospace", fontSize: 13 },

  // ── Special ────────────────────────────────────────────────
  specBox: {
    background: '#0b0f1a', borderRadius: 10, padding: 14,
    marginBottom: 16, border: '1px solid #2a3050',
  },
  specRow: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 0', borderBottom: '1px solid #1a2038', flexWrap: 'wrap',
  },
  specLabel: { fontSize: 13, color: '#c0c8e0', minWidth: 190, fontWeight: 500 },
  ptsBadge: {
    fontFamily: "'Fira Code', monospace", fontSize: 10,
    color: GRN, background: 'rgba(46,170,74,.1)',
    border: '1px solid rgba(46,170,74,.2)',
    borderRadius: 4, padding: '2px 6px',
  },

  // ── Badges ─────────────────────────────────────────────────
  badge: {
    fontSize: 10, borderRadius: 20, padding: '3px 10px',
    letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
    fontFamily: "'Fira Code', monospace", display: 'inline-block',
  },
  wonBadge: {
    fontSize: 11, background: 'rgba(46,170,74,.1)', color: GRN,
    border: '1px solid rgba(46,170,74,.2)', borderRadius: 4,
    padding: '2px 7px', fontFamily: "'Fira Code', monospace",
  },
  lockBanner: {
    background: 'rgba(230,50,50,.05)', border: '1px solid rgba(230,50,50,.2)',
    borderRadius: 9, padding: '11px 14px', marginBottom: 14,
    color: '#ff8888', fontSize: 13,
  },
  infoBox: {
    background: '#0b0f1a', border: '1px solid #2a3050',
    borderRadius: 11, padding: 20, marginTop: 8,
  },

  // ── Score boxes ────────────────────────────────────────────
  scoreBox: {
    background: '#0b0f1a', borderRadius: 12, padding: 18,
    textAlign: 'center', border: '1px solid #2a3050',
  },
  scoreNum: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 44, fontWeight: 700, letterSpacing: .5, lineHeight: 1,
  },
  scoreL: {
    fontSize: 10, color: '#7a9ac0', marginTop: 6,
    fontFamily: "'Fira Code', monospace",
    textTransform: 'uppercase', letterSpacing: 2,
  },

  // ── Admin ──────────────────────────────────────────────────
  phBtn: {
    display: 'block', width: '100%', background: 'transparent',
    border: '1px solid #b8cce8', color: '#5a7aaa', borderRadius: 8,
    padding: '9px 14px', marginBottom: 4, cursor: 'pointer',
    textAlign: 'left', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
  },
  phBtnOn: {
    background: 'rgba(255,215,0,.08)', color: YEL,
    borderColor: 'rgba(255,215,0,.3)', fontWeight: 700,
  },
  roundL: {
    fontFamily: "'Fira Code', monospace", fontSize: 10, color: YEL,
    textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, display: 'block',
  },

  // ── Video ──────────────────────────────────────────────────
  spinner: { display: 'inline-block', animation: 'spin 1s linear infinite' },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    textAlign: 'center', padding: '16px',
    color: '#8aabcc', fontSize: 11,
    borderTop: '1px solid #dde8f8',
    fontFamily: "'Fira Code', monospace",
    letterSpacing: 1,
  },
};
