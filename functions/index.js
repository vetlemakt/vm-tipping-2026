const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const API_KEY = process.env.FOOTBALL_API_KEY;
const WC_LEAGUE = 1;      // API-Football: FIFA World Cup
const WC_SEASON = 2026;

// Norske lagnavn → API-Football engelsk navn
const TEAM_NAME_MAP = {
  'Mexico':           'Mexico',
  'Sør-Afrika':       'South Africa',
  'Sør-Korea':        'South Korea',
  'Tsjekkia':         'Czech Republic',
  'Canada':           'Canada',
  'Bosnia-Herz':      'Bosnia and Herzegovina',
  'Qatar':            'Qatar',
  'Sveits':           'Switzerland',
  'Brasil':           'Brazil',
  'Marokko':          'Morocco',
  'Haiti':            'Haiti',
  'Skottland':        'Scotland',
  'USA':              'USA',
  'Paraguay':         'Paraguay',
  'Australia':        'Australia',
  'Tyrkia':           'Turkey',
  'Tyskland':         'Germany',
  'Curacao':          'Curacao',
  'Elfenbenskysten':  'Ivory Coast',
  'Ecuador':          'Ecuador',
  'Nederland':        'Netherlands',
  'Japan':            'Japan',
  'Sverige':          'Sweden',
  'Tunisia':          'Tunisia',
  'Belgia':           'Belgium',
  'Egypt':            'Egypt',
  'Iran':             'Iran',
  'New Zealand':      'New Zealand',
  'Spania':           'Spain',
  'Kapp Verde':       'Cape Verde',
  'Saudi-Arabia':     'Saudi Arabia',
  'Uruguay':          'Uruguay',
  'Frankrike':        'France',
  'Senegal':          'Senegal',
  'Irak':             'Iraq',
  'Norge':            'Norway',
  'Argentina':        'Argentina',
  'Algerie':          'Algeria',
  'Østerrike':        'Austria',
  'Jordan':           'Jordan',
  'Portugal':         'Portugal',
  'Kongo DR':         'DR Congo',
  'Usbekistan':       'Uzbekistan',
  'Colombia':         'Colombia',
  'England':          'England',
  'Kroatia':          'Croatia',
  'Ghana':            'Ghana',
  'Panama':           'Panama',
};

// Snudd opp-ned: engelsk → norsk
const API_TO_NOR = Object.fromEntries(
  Object.entries(TEAM_NAME_MAP).map(([nor, eng]) => [eng, nor])
);

// Disse statuskodene betyr at kampen pågår
const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);
// ── TEST: hent spesifikk fixture for testing ─────────────────────────
async function getTestFixture() {
  const data = await apiFetch('fixtures?id=1512366');
  return data.response || [];
}
// Disse betyr at kampen er ferdig
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

// ── Hjelpefunksjon: hent fra API-Football ────────────────────────────
async function apiFetch(path) {
  const url = `https://v3.football.api-sports.io/${path}`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${url}`);
  return res.json();
}

// ── Finn norsk lagnavn fra API-navn ───────────────────────────────────
function toNor(apiName) {
  return API_TO_NOR[apiName] || apiName;
}

// ── Sjekk om det pågår eller snart starter en kamp ───────────────────
async function getActiveFixtures() {
  const data = await apiFetch(
    `fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=1H-HT-2H-ET-BT-P-LIVE`
  );
  return data.response || [];
}

// ── Hent ferdigspilte kamper (siste 24 timer) ─────────────────────────
async function getRecentlyFinished() {
  const data = await apiFetch(
    `fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=FT-AET-PEN&last=10`
  );
  return data.response || [];
}

// ── Bygg results-objekt fra én fixture ───────────────────────────────
function buildMatchResult(fixture) {
  const home = fixture.goals?.home;
  const away = fixture.goals?.away;
  if (home === null || home === undefined) return null;

  const status = fixture.fixture?.status?.short;
  const isLive = LIVE_STATUSES.has(status);
  const isFinished = FINISHED_STATUSES.has(status);
  const elapsed = fixture.fixture?.status?.elapsed || null;

  // Straffespark-info
  const penHome = fixture.score?.penalty?.home ?? null;
  const penAway = fixture.score?.penalty?.away ?? null;

  return {
    home,
    away,
    status,           // 'FT', '2H', 'HT' osv.
    elapsed,          // minutt (under kamp)
    isLive,
    isFinished,
    penHome,          // null hvis ikke straffer
    penAway,
    updatedAt: Date.now(),
  };
}

// ── Bygg live-event (siste hendelse) ─────────────────────────────────
function buildLiveEvent(fixture) {
  const events = fixture.events || [];
  if (!events.length) return null;

  const homeTeamApi = fixture.teams?.home?.name;
  const awayTeamApi = fixture.teams?.away?.name;
  const homeNor = toNor(homeTeamApi);
  const awayNor = toNor(awayTeamApi);
  const hg = fixture.goals?.home ?? 0;
  const ag = fixture.goals?.away ?? 0;

  // Finn siste mål eller kort (hopp over bytter)
  const relevant = [...events].reverse().find(
    e => e.type === 'Goal' || e.type === 'Card'
  );
  if (!relevant) return null;

  const evTeamApi = relevant.team?.name;
  const isHome = evTeamApi === homeTeamApi;
  const min = relevant.time?.elapsed;

  if (relevant.type === 'Goal') {
    const sm =
      relevant.detail === 'Own Goal' ? ' (s.m.)' :
      relevant.detail === 'Penalty'  ? ' (str.)' : '';
    return {
      type: 'goal',
      homeNor, awayNor,
      homeGoals: hg, awayGoals: ag,
      homeScored: isHome,
      playerName: relevant.player?.name || '?',
      minute: min,
      suffix: sm,
      ts: Date.now(),
    };
  }

  if (relevant.type === 'Card') {
    const icon = relevant.detail?.includes('Yellow') ? '🟨' : '🟥';
    return {
      type: 'card',
      text: `${icon} ${relevant.player?.name || '?'} '${min} (${isHome ? homeNor : awayNor})`,
      ts: Date.now(),
    };
  }

  return null;
}

// ── Finn kamp-ID i vår constants.js basert på lagnavn ────────────────
// Vi lagrer en lookup-cache i Firestore for å unngå å laste constants her
async function getFixtureLookup() {
  const snap = await db.collection('config').doc('fixtureLookup').get();
  return snap.exists ? snap.data() : {};
}

// ── Hovedjobb: poll og skriv til Firestore ───────────────────────────
async function pollAndUpdate() {
  if (!API_KEY) {
    console.warn('FOOTBALL_API_KEY ikke satt – hopper over polling');
    return;
  }

  // 1. Sjekk om det er live kamper
  const testFixtures = await getTestFixture();
  const liveFixtures = testFixtures.length ? testFixtures : await getActiveFixtures();

  // 2. Hent nylig ferdigspilte kamper uansett
  const finishedFixtures = await getRecentlyFinished();

  const lookup = await getFixtureLookup();
  const batch = db.batch();
  const resultsRef = db.collection('config').doc('results');
  const liveRef = db.collection('config').doc('liveEvent');

  // 3. Oppdater resultater for ferdigspilte kamper
  const currentResults = (await resultsRef.get()).data() || {};
  const updatedResults = { ...currentResults };
  let resultsChanged = false;

  for (const fixture of finishedFixtures) {
    const homeApi = fixture.teams?.home?.name;
    const awayApi = fixture.teams?.away?.name;
    const homeNor = toNor(homeApi);
    const awayNor = toNor(awayApi);

    // Finn vår interne match-ID fra lookup-tabellen
    const matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${homeApi}_${awayApi}`];
    if (!matchId) {
      console.log(`Ingen match-ID funnet for: ${homeNor} vs ${awayNor}`);
      continue;
    }

    const result = buildMatchResult(fixture);
    if (!result) continue;

    // Bare oppdater hvis resultatet har endret seg
    const existing = currentResults[matchId];
    if (!existing || existing.home !== result.home || existing.away !== result.away) {
      updatedResults[matchId] = result;
      resultsChanged = true;
      console.log(`Oppdatert: ${matchId} → ${result.home}-${result.away}`);
    }
  }

  if (resultsChanged) {
    batch.set(resultsRef, updatedResults, { merge: true });
  }

  // 4. Oppdater live-resultater og hendelser
  if (liveFixtures.length > 0) {
    // Oppdater live-score for pågående kamper også
    for (const fixture of liveFixtures) {
      const homeApi = fixture.teams?.home?.name;
      const awayApi = fixture.teams?.away?.name;
      const homeNor = toNor(homeApi);
      const awayNor = toNor(awayApi);
      const matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${homeApi}_${awayApi}`];

      if (matchId) {
        const result = buildMatchResult(fixture);
        if (result) {
          updatedResults[matchId] = result;
          resultsChanged = true;
        }
      }
    }

    // Siste live-hendelse (fra den første aktive kampen)
    const liveEvent = buildLiveEvent(liveFixtures[0]);
    batch.set(liveRef, liveEvent || { type: null, ts: Date.now() });
  } else {
    // Ingen aktive kamper – nullstill live-event
    batch.set(liveRef, { type: null, ts: Date.now() });
  }

  await batch.commit();
  console.log(`Poll ferdig. Live kamper: ${liveFixtures.length}, Ferdig: ${finishedFixtures.length}`);
}

// ══════════════════════════════════════════════════════════════════════
//  SCHEDULED FUNCTION – kjører hvert minutt
//  Firebase Blaze-plan kreves for Cloud Functions
// ══════════════════════════════════════════════════════════════════════
exports.pollFootball = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Europe/Oslo',
    secrets: ['FOOTBALL_API_KEY'],
  },
  async () => {
    try {
      await pollAndUpdate();
    } catch (err) {
      console.error('pollFootball feilet:', err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════
//  HTTP-TRIGGER – manuell poll (for testing)
//  Kall: curl https://<region>-<project>.cloudfunctions.net/manualPoll
// ══════════════════════════════════════════════════════════════════════
exports.manualPoll = onRequest(
  { secrets: ['FOOTBALL_API_KEY'] },
  async (req, res) => {
    try {
      await pollAndUpdate();
      res.json({ ok: true, ts: Date.now() });
    } catch (err) {
      console.error('manualPoll feilet:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════
//  HTTP-TRIGGER – sett opp fixture-lookup
//  Kjøres én gang for å bygge opp lookup-tabellen
//  Kall: POST med body { matches: [{id, home, away}, ...] }
// ══════════════════════════════════════════════════════════════════════
exports.buildFixtureLookup = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { matches } = req.body;
  if (!matches || !Array.isArray(matches)) {
    res.status(400).json({ error: 'Body må inneholde matches: [{id, home, away}]' });
    return;
  }

  // Bygg lookup: "NorskHjem_NorskBorte" → matchId
  const lookup = {};
  for (const m of matches) {
    const homeApi = TEAM_NAME_MAP[m.home] || m.home;
    const awayApi = TEAM_NAME_MAP[m.away] || m.away;
    lookup[`${m.home}_${m.away}`] = m.id;        // norsk → id
    lookup[`${homeApi}_${awayApi}`] = m.id;       // engelsk → id
  }

  await db.collection('config').doc('fixtureLookup').set(lookup);
  res.json({ ok: true, entries: Object.keys(lookup).length });
  // ══════════════════════════════════════════════════════════════════════
//  SCHEDULED FUNCTION – bytter quiz-kort kl. 06:00 hver dag
// ══════════════════════════════════════════════════════════════════════
exports.rotateQuizPlayer = onSchedule(
  {
    schedule: '0 4 * * *', // 04:00 UTC = 06:00 CEST
    timeZone: 'UTC',
    secrets: ['FOOTBALL_API_KEY'],
  },
  async () => {
    const now = new Date();
    const base = new Date('2026-01-01T06:00:00+02:00');
    let dayIndex = Math.floor((now - base) / (1000 * 60 * 60 * 24));
    const TOTAL_PLAYERS = 105;
    const idx = ((dayIndex % TOTAL_PLAYERS) + TOTAL_PLAYERS) % TOTAL_PLAYERS;
    await db.collection('config').doc('quizPlayer').set({
      idx,
      updatedAt: Date.now(),
    });
    console.log(`Quiz-kort rotert til indeks ${idx}`);
  }
);
});
