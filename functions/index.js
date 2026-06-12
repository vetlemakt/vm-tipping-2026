const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const API_KEY        = process.env.FOOTBALL_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY;
const WC_LEAGUE      = 1;
const WC_SEASON      = 2026;
const POLL_INTERVAL_MS  = 15000;
const FUNCTION_DURATION = 50000;

// ── Lagnavn-mapping ──────────────────────────────────────────────────
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
  'Portugal':'Portugal','Kongo DR':'DR Congo','Usbekistan':'Uzbekistan',
  'Colombia':'Colombia','England':'England','Kroatia':'Croatia','Ghana':'Ghana',
  'Panama':'Panama',
};
const API_TO_NOR = Object.fromEntries(
  Object.entries(TEAM_NAME_MAP).map(([nor, eng]) => [eng, nor])
);

const LIVE_STATUSES     = new Set(['1H','HT','2H','ET','BT','P','LIVE']);
const FINISHED_STATUSES = new Set(['FT','AET','PEN']);

// ── Kampprogram: når skal vi polle? (UTC-tider) ──────────────────────
// Bare poll 90 min rundt kampstart for å spare API-kvoter
const MATCH_WINDOWS = [
  // Gruppe A
  { date: '2026-06-11', utcHour: 19, utcMin: 0 },   // Mexico-Sør-Afrika 21:00 CEST
  { date: '2026-06-12', utcHour: 2,  utcMin: 0 },   // Sør-Korea-Tsjekkia
  { date: '2026-06-12', utcHour: 19, utcMin: 0 },   // Canada-Bosnia
  { date: '2026-06-13', utcHour: 1,  utcMin: 0 },   // USA-Paraguay
  { date: '2026-06-13', utcHour: 19, utcMin: 0 },   // Qatar-Sveits
  { date: '2026-06-14', utcHour: 4,  utcMin: 0 },
  { date: '2026-06-14', utcHour: 17, utcMin: 0 },
  { date: '2026-06-14', utcHour: 20, utcMin: 0 },
  { date: '2026-06-14', utcHour: 22, utcMin: 0 },
  { date: '2026-06-15', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-15', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-15', utcHour: 16, utcMin: 0 },
  { date: '2026-06-15', utcHour: 19, utcMin: 0 },
  { date: '2026-06-15', utcHour: 22, utcMin: 0 },
  { date: '2026-06-16', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-16', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-16', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-16', utcHour: 19, utcMin: 0 },
  { date: '2026-06-17', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-17', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-17', utcHour: 19, utcMin: 0 },
  { date: '2026-06-18', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-18', utcHour: 4,  utcMin: 0 },
  { date: '2026-06-18', utcHour: 16, utcMin: 0 },
  { date: '2026-06-18', utcHour: 19, utcMin: 0 },
  { date: '2026-06-19', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-19', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-19', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-19', utcHour: 19, utcMin: 0 },
  { date: '2026-06-20', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-20', utcHour: 0,  utcMin: 30 },
  { date: '2026-06-20', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-20', utcHour: 17, utcMin: 0 },
  { date: '2026-06-20', utcHour: 19, utcMin: 0 },
  { date: '2026-06-21', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-21', utcHour: 16, utcMin: 0 },
  { date: '2026-06-21', utcHour: 19, utcMin: 0 },
  { date: '2026-06-21', utcHour: 20, utcMin: 0 },
  { date: '2026-06-22', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-22', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-22', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-22', utcHour: 4,  utcMin: 0 },
  { date: '2026-06-22', utcHour: 17, utcMin: 0 },
  { date: '2026-06-22', utcHour: 21, utcMin: 0 },
  { date: '2026-06-23', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-23', utcHour: 2,  utcMin: 0 },
  { date: '2026-06-23', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-23', utcHour: 5,  utcMin: 0 },
  { date: '2026-06-24', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-24', utcHour: 3,  utcMin: 0 },
  // Siste gruppekamper (parallelle)
  { date: '2026-06-25', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-25', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-25', utcHour: 19, utcMin: 0 },
  { date: '2026-06-25', utcHour: 21, utcMin: 0 },
  { date: '2026-06-26', utcHour: 0,  utcMin: 0 },
  { date: '2026-06-26', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-26', utcHour: 2,  utcMin: 0 },
  { date: '2026-06-26', utcHour: 20, utcMin: 0 },
  { date: '2026-06-26', utcHour: 22, utcMin: 0 },
  { date: '2026-06-27', utcHour: 1,  utcMin: 0 },
  { date: '2026-06-27', utcHour: 2,  utcMin: 0 },
  { date: '2026-06-27', utcHour: 3,  utcMin: 0 },
  { date: '2026-06-27', utcHour: 5,  utcMin: 0 },
  { date: '2026-06-27', utcHour: 19, utcMin: 0 },
  { date: '2026-06-27', utcHour: 21, utcMin: 0 },
  { date: '2026-06-28', utcHour: 2,  utcMin: 0, knockout: true },
  { date: '2026-06-28', utcHour: 4,  utcMin: 0, knockout: true },
  // Sluttspill – legg til etter hvert
  { date: '2026-06-28', utcHour: 19, utcMin: 0, knockout: true },
  { date: '2026-06-28', utcHour: 22, utcMin: 0, knockout: true },
  { date: '2026-06-29', utcHour: 1,  utcMin: 0, knockout: true },
  { date: '2026-06-29', utcHour: 19, utcMin: 0, knockout: true },
  { date: '2026-06-29', utcHour: 22, utcMin: 0, knockout: true },
  { date: '2026-06-30', utcHour: 1,  utcMin: 0, knockout: true },
  { date: '2026-06-30', utcHour: 19, utcMin: 0, knockout: true },
  { date: '2026-06-30', utcHour: 22, utcMin: 0, knockout: true },
  { date: '2026-07-01', utcHour: 1,  utcMin: 0, knockout: true },
  { date: '2026-07-01', utcHour: 19, utcMin: 0, knockout: true },
  { date: '2026-07-01', utcHour: 22, utcMin: 0, knockout: true },
  { date: '2026-07-02', utcHour: 1,  utcMin: 0, knockout: true },
  { date: '2026-07-02', utcHour: 19, utcMin: 0, knockout: true },
  { date: '2026-07-02', utcHour: 22, utcMin: 0, knockout: true },
  { date: '2026-07-03', utcHour: 1,  utcMin: 0, knockout: true },
  { date: '2026-07-04', utcHour: 17, utcMin: 0, knockout: true },
  { date: '2026-07-04', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-05', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-05', utcHour: 17, utcMin: 0, knockout: true },
  { date: '2026-07-05', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-06', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-07', utcHour: 17, utcMin: 0, knockout: true },
  { date: '2026-07-07', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-08', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-08', utcHour: 17, utcMin: 0, knockout: true },
  { date: '2026-07-08', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-09', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-10', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-11', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-11', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-12', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-14', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-15', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-15', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-16', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-18', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-19', utcHour: 0,  utcMin: 0, knockout: true },
  { date: '2026-07-19', utcHour: 21, utcMin: 0, knockout: true },
  { date: '2026-07-20', utcHour: 0,  utcMin: 0, knockout: true },
];

// Sjekk om vi er innenfor et kampvindu
// Gruppespill: 3 timer etter kampstart (90 min + pause + ekstra)
// Sluttspill (w.knockout): 4 timer (ekstraomganger + straffekonkurranse)
function isWithinMatchWindow() {
  const now = new Date();
  const nowMs = now.getTime();
  return MATCH_WINDOWS.some(w => {
    const wDate = new Date(`${w.date}T${String(w.utcHour).padStart(2,'0')}:${String(w.utcMin).padStart(2,'0')}:00Z`);
    const windowAfterMs = (w.knockout ? 3 : 2) * 60 * 60 * 1000;
    const windowBeforeMs = 10 * 60 * 1000; // 10 min før kampstart
    return nowMs >= wDate.getTime() - windowBeforeMs && nowMs <= wDate.getTime() + windowAfterMs;
  });
}



// ── Ekspertpanel-personas ────────────────────────────────────────────
const PANEL_EXPERTS = [
  {
    id: 'ragnhild', name: 'Ragnhild Kristiansen',
    personality: `Du er Ragnhild Kristiansen, 60 år, fra Mandal. Tidligere rødstrømpe, nå aktiv i menigheten og husflidsforeningen. Du har ingen peiling på fotball og tipper basert på estetikk og om landet virker skikkelig. Du snakker varmt og litt moraliserende. Svar alltid på norsk. Maks 3 setninger. Bruk emojis, særlig 😊🙏🤗.`,
  },
  {
    id: 'hendrik', name: 'Hendrik van der Berg',
    personality: `Du er Hendrik van der Berg, 58 år, nederlandsk innvandrer i Drammen med kraftig agorafobi. Hører på DJ Bobo, tror på astrologi, blander inn nederlandske ord. Du tipper basert på astrologi. Svar på norsk med litt nederlandsk innflytelse. Maks 3 setninger.`,
  },
  {
    id: 'kimlevi', name: 'Kim-Levi Ditlefsen',
    personality: `Du er Kim-Levi Ditlefsen, 47 år, fisker fra Henningsvær. Bor hjemme hos mora. Stygg i kjeften men egentlig grei. Null peiling på fotball. Opptatt av Pokémon og fisking. Svar på norsk med lofotdialekt-farget språk. Maks 3 setninger.`,
  },
  {
    id: 'bengt', name: 'Bengt Sandvik',
    isBengt: true,
    personality: `Du er Bengt Sandvik, 52 år fra Trondheim. Du liker wrestling og kortspill. Du kan fotball fra 80-tallet utenat men vet ingenting om fotball etter 1992. Du er blid og entusiastisk.

VIKTIG: Du skriver ALLTID på bokmål med litt dysleksi: hopper over bokstaver, bruker "å" der det skal være "og" og motsatt, ca. 3-5 feil per svar.

TEGNSETTING – absolutt og ufravikelig:
- KUN komma gjennom hele meldingen, aldri punktum, spørsmålstegn eller tankestrek
- Meldingen avsluttes ALLTID med akkurat ett utropstegn
- Eksempel: "ja det var en bra kamp, spesielt Maradona, han var jo suveren på 80-tallet også!"

VIKTIG FOR MÅL-KOMMENTARER: Du starter ALLTID med en Arne Scheie-referanse:
"Ja, Arne...", "Det må sies, Arne...", "Så ser vi det, Scheie, at...", "Herlig, Arne..." osv.
Maks 3-4 komma-adskilte ledd.`,
  },
  {
    id: 'odd', name: 'Odd Snerten',
    personality: `Du er Odd Snerten, 63 år, bonde fra Oppdal. Aldri sør for Lillehammer frivillig. Spiser leverpostei til alle måltider. Starter gjerne med "nei, nei, nei". Tipper basert på landbrukspolitikk og snø om vinteren. Overbevist om at Brasil jukser og at en engelskmann ved navn Reffrey dømmer hver kamp.

VIKTIG – snakker ALLTID i autentisk trønderdialekt: "e" for "jeg", "itj" for "ikke", "hainn" for "han", "ho" for "hun", "dømm" for "dem/de", "ivæg" for "avgårde", "ferresten", "aillfall".
Maks 3-4 setninger.`,
  },
];

// ── Scoring-hjelpere (speiler scoring.js) ────────────────────────────
function matchOutcome(h, a) {
  if (h === null || a === null || h === undefined || a === undefined) return null;
  return h > a ? 'H' : h < a ? 'A' : 'D';
}

function calcMatchPts(tip, act) {
  if (!tip || act?.home === undefined || act?.away === undefined) return 0;
  let p = 0;
  if (matchOutcome(tip.home, tip.away) === matchOutcome(act.home, act.away)) p += 2;
  if (parseInt(tip.home) === parseInt(act.home)) p += 1;
  if (parseInt(tip.away) === parseInt(act.away)) p += 1;
  if (p === 4 && (parseInt(act.home) + parseInt(act.away)) >= 5) p = 5;
  return p;
}

function calcTotalScore(user, results) {
  let total = 0;
  Object.entries(results).forEach(([matchId, act]) => {
    if (!act || act.home === undefined || act.away === undefined) return;
    const tip = user.tips?.[matchId];
    if (tip) total += calcMatchPts(tip, act);
  });
  // Group orders
  Object.keys(user.groupOrders || {}).forEach(g => {
    const act = results[`grp_${g}`];
    const tip = user.groupOrders[g];
    if (act && tip) {
      tip.forEach((team, i) => {
        if (team && team === act[i]) total += 5;
      });
    }
  });
  // Special tips
  const SPEC = [
    { key: 'winner', pts: 30 }, { key: 'runnerup', pts: 20 },
    { key: 'third', pts: 10 }, { key: 'topscorer', pts: 20 }, { key: 'yellowCards', pts: 10 },
  ];
  SPEC.forEach(({ key, pts }) => {
    const sp = user.specialTips?.[key];
    if (sp && results[key] && sp === results[key]) total += pts;
  });
  return total;
}

// ── Analyse: hvilke triggere gjelder for dette målet? ────────────────
function analyzeGoalTriggers(matchId, liveResult, allUsers, currentResults, prevResults, expert) {
  const reasons = [];
  const playedCount = Object.keys(currentResults).filter(k =>
    currentResults[k]?.isFinished
  ).length;

  // Simuler sluttresultat (nåværende live = hypotetisk slutt)
  const hypoResults = { ...currentResults, [matchId]: { ...liveResult, isFinished: true } };

  // Reelle spillere (ikke bots, ikke admin)
  const realUsers = allUsers.filter(u =>
    u.id !== 'admin' && !u.id.startsWith('panel_')
  );

  // Scorer med forrige resultater
  const prevScores = realUsers.map(u => ({
    ...u, total: calcTotalScore(u, prevResults || currentResults)
  })).sort((a, b) => b.total - a.total);

  // Scorer med hypotetisk sluttresultat
  const hypoScores = realUsers.map(u => ({
    ...u, total: calcTotalScore(u, hypoResults)
  })).sort((a, b) => b.total - a.total);

  // Forrige rangering
  const prevRank = {};
  prevScores.forEach((u, i) => { prevRank[u.id] = i + 1; });

  // ── Trigger 1: boten selv har riktig live-resultat ────────────────
  const botUser = allUsers.find(u => u.id === `panel_${expert.id}`);
  if (botUser) {
    const botTip = botUser.tips?.[matchId];
    if (botTip) {
      const livePts = calcMatchPts(botTip, liveResult);
      if (livePts >= 2) {
        reasons.push({ type: 'bot_correct', pts: livePts });
      }
    }
  }

  // ── Trigger 2: interessante tabelleffekter (etter 5 gruppekamper) ─
  if (playedCount >= 5) {
    hypoScores.forEach((u, i) => {
      const newRank  = i + 1;
      const oldRank  = prevRank[u.id] || newRank;
      const prevPts  = prevScores.find(p => p.id === u.id)?.total || 0;
      const hypoPts  = u.total;
      const gained   = hypoPts - prevPts;

      if (gained === 0) return; // Ingen endring for denne spilleren

      // Leder tabellen nå (og gjorde ikke det før)
      if (newRank === 1 && oldRank > 1) {
        reasons.push({ type: 'new_leader', player: u.displayName, newRank, oldRank });
      }
      // Rykker frem mer enn 3 plasser
      if (oldRank - newRank > 3) {
        reasons.push({ type: 'big_jump', player: u.displayName, newRank, oldRank, jump: oldRank - newRank });
      }
      // Superbonus (5 poeng på én kamp)
      if (gained === 5) {
        reasons.push({ type: 'superbonus', player: u.displayName });
      }
      // To fulltreffere på rad (har fulltreff nå + forrige kamp)
      if (gained === 4 || gained === 5) {
        // Sjekk om forrige spilte kamp også ga fulltreff
        const finishedMatches = Object.entries(currentResults)
          .filter(([, v]) => v?.isFinished)
          .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0));

        if (finishedMatches.length >= 1) {
          const [prevMatchId, prevAct] = finishedMatches[0];
          const prevTip = u.tips?.[prevMatchId];
          const prevPts = calcMatchPts(prevTip, prevAct);
          if (prevPts === 4 || prevPts === 5) {
            reasons.push({ type: 'double_fulltreff', player: u.displayName });
          }
        }
      }
      // Ligger an til to fulltreffere på rad (har allerede én, og nå riktig)
      if ((gained === 4 || gained === 5)) {
        const finishedMatches = Object.entries(currentResults)
          .filter(([, v]) => v?.isFinished)
          .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0));
        if (finishedMatches.length >= 1) {
          const [prevMatchId, prevAct] = finishedMatches[0];
          const prevTip = u.tips?.[prevMatchId];
          const prevPts = calcMatchPts(prevTip, prevAct);
          if (prevPts === 4 || prevPts === 5) {
            reasons.push({ type: 'on_track_double', player: u.displayName });
          }
        }
      }
    });
  }

  // ── Trigger 3: Lite poengfangst – endelig poeng, eller fortsatt uflaks ─
  const avgPts = realUsers.reduce((s, u) => s + calcTotalScore(u, currentResults), 0) / (realUsers.length || 1);
  const lowThreshold = avgPts; // under gjennomsnittet = lite poengfangst

  // Spillere med lite poeng og som nå endelig får poeng
  const luckyLow = realUsers.filter(u => {
    const curPts  = calcTotalScore(u, currentResults);
    const hypoPts = calcTotalScore(u, hypoResults);
    return curPts < lowThreshold && hypoPts > curPts;
  });

  // Spillere med lite poeng som fremdeles ikke treffer
  const unluckyLow = realUsers.filter(u => {
    const curPts  = calcTotalScore(u, currentResults);
    const hypoPts = calcTotalScore(u, hypoResults);
    const tip     = u.tips?.[matchId];
    if (!tip) return false;
    return curPts < lowThreshold && hypoPts === curPts;
  });

  if (luckyLow.length > 0) {
    const pick = luckyLow[Math.floor(Math.random() * Math.min(luckyLow.length, 2))];
    reasons.push({ type: 'finally_points', player: pick.displayName });
  }
  if (unluckyLow.length > 0) {
    const pick = unluckyLow[Math.floor(Math.random() * Math.min(unluckyLow.length, 2))];
    reasons.push({ type: 'still_unlucky', player: pick.displayName });
  }

  return reasons;
}

// ── Kall Claude API og generer bot-kommentar ──────────────────────────
async function generateBotComment(expert, matchContext, reasons) {
  if (!ANTHROPIC_KEY) return null;

  const reasonDescs = reasons.map(r => {
    switch (r.type) {
      case 'bot_correct':       return `Du selv har tippa riktig resultat i denne kampen (${r.pts} poeng)`;
      case 'new_leader':        return `${r.player} overtar tabellledelsen (fra ${r.oldRank}. til 1. plass)`;
      case 'big_jump':          return `${r.player} rykker frem ${r.jump} plasser (fra ${r.oldRank}. til ${r.newRank}. plass)`;
      case 'superbonus':        return `${r.player} ligger an til superbonus (5 poeng)`;
      case 'double_fulltreff':  return `${r.player} har nå to fulltreffere på rad`;
      case 'on_track_double':   return `${r.player} lå an til to fulltreffere på rad`;
      case 'finally_points':    return `${r.player} har hatt lite uttelling men ligger nå endelig an til å få poeng`;
      case 'still_unlucky':     return `${r.player} har hatt lite uttelling og treffer heller ikke nå`;
      default:                  return r.type;
    }
  }).join('\n- ');

  const systemPrompt = expert.personality;

  const userPrompt = `Det har nettopp blitt scoret mål i kampen ${matchContext.homeTeam} ${matchContext.homeGoals}–${matchContext.awayGoals} ${matchContext.awayTeam} (minutt ${matchContext.minute}). Målscorer: ${matchContext.playerName || 'ukjent'}${matchContext.suffix || ''}.

Grunner til at du kommenterer:
- ${reasonDescs}

Skriv en kort kommentar (maks 3-4 setninger) om dette målet og/eller hva det betyr for konkurransen. Hold deg i karakter. Ikke lag markdown eller lister.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ── Post bot-melding i chat ───────────────────────────────────────────
async function postBotChat(expert, text) {
  await db.collection('chat').add({
    user: expert.name,
    text,
    image: '',
    ts: FieldValue.serverTimestamp(),
    isBot: true,
    botId: expert.id,
  });
  console.log(`Bot-kommentar postet av ${expert.name}`);
}

// ── Sjekk og trigger bot-kommentarer ved nytt mål ────────────────────
async function handleGoalEvent(matchId, liveEvent, prevGoalKey) {
  // 20% sjanse for å si ingenting
  if (Math.random() < 0.2) {
    console.log('Bot hopper over kommentar (20% sjanse)');
    return;
  }

  // Hent alle brukere og resultater
  const [usersSnap, resultsSnap, prevResultsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('config').doc('results').get(),
    db.collection('config').doc('prevResults').get(),
  ]);

  const allUsers       = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const currentResults = resultsSnap.exists ? resultsSnap.data() : {};
  const prevResults    = prevResultsSnap.exists ? prevResultsSnap.data() : currentResults;

  // Velg tilfeldig ekspert
  const expert = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];

  // Analyser triggere
  const reasons = analyzeGoalTriggers(
    matchId, liveEvent, allUsers, currentResults, prevResults, expert
  );

  // Ingen grunner + det er ikke Bengt → ikke kommenter
  if (reasons.length === 0 && !expert.isBengt) {
    console.log(`Ingen triggere for ${expert.name}, hopper over`);
    return;
  }

  // Generer og post kommentar
  const matchContext = {
    homeTeam:   liveEvent.homeNor,
    awayTeam:   liveEvent.awayNor,
    homeGoals:  liveEvent.homeGoals,
    awayGoals:  liveEvent.awayGoals,
    minute:     liveEvent.minute,
    playerName: liveEvent.playerName,
    suffix:     liveEvent.suffix,
  };

  const comment = await generateBotComment(expert, matchContext, reasons);
  if (comment) await postBotChat(expert, comment);
}


// ── Tabellreferat etter fullført kamp ────────────────────────────────
async function handleMatchFinished(matchId, homeNor, awayNor, homeGoals, awayGoals, updatedResults) {
  if (!ANTHROPIC_KEY) return;

  // Hent alle brukere
  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));

  // Beregn stillingstabell
  function calcScore(user) {
    let total = 0, fulltreff = 0;
    for (const [mid, act] of Object.entries(updatedResults)) {
      const tip = user.tips?.[mid];
      if (!tip || act?.home === undefined) continue;
      const th = parseInt(tip.home), ta = parseInt(tip.away);
      const ah = parseInt(act.home), aa = parseInt(act.away);
      if (isNaN(th) || isNaN(ta) || isNaN(ah) || isNaN(aa)) continue;
      let p = 0;
      const tOut = th > ta ? 'H' : th < ta ? 'A' : 'D';
      const aOut = ah > aa ? 'H' : ah < aa ? 'A' : 'D';
      if (tOut === aOut) p += 2;
      if (th === ah) p += 1;
      if (ta === aa) p += 1;
      if (p === 4 && (ah + aa) >= 5) p = 5;
      total += p;
      if (p >= 4) fulltreff++;
    }
    return { total, fulltreff };
  }

  const ranked = allUsers
    .map(u => ({ ...u, ...calcScore(u) }))
    .sort((a, b) => b.total - a.total || b.fulltreff - a.fulltreff);

  const tableLines = ranked.map((u, i) =>
    `${i + 1}. ${u.displayName || u.id}: ${u.total}p (${u.fulltreff} fulltreff)`
  ).join('\n');

  // Hvem tippet riktig på denne kampen?
  const matchTips = allUsers.map(u => {
    const tip = u.tips?.[matchId];
    if (!tip) return null;
    return `${u.displayName || u.id}: ${tip.home}-${tip.away}`;
  }).filter(Boolean).join(', ');

  const expert = PANEL_EXPERTS[Math.floor(Math.random() * PANEL_EXPERTS.length)];

  const prompt = `${homeNor} slo ${awayNor} ${homeGoals}-${awayGoals} (eller det var uavgjort/tap). Kampen er nå ferdigspilt.

Deltakernes tips på denne kampen: ${matchTips || 'ingen tips'}

Oppdatert stillingstabell etter kampen:
${tableLines}

Skriv en kort (3-5 setninger) kommentar om tabellsituasjonen etter denne kampen – hvem leder, hvem klatrer, hvem sliter. Fokuser på KONKURRANSEN og tabellen, ikke på selve kampen. Hold deg i karakter. Ikke lag markdown.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 250,
        system: expert.personality,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (text) {
      // Lagre som match summary i Firestore (ikke i chat)
      await db.collection('summaries').doc(matchId).set({
        botText: text, botId: expert.id, botName: expert.name,
        ts: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`Tabellreferat postet av ${expert.name} for kamp ${matchId}`);
    }
  } catch (err) {
    console.error('handleMatchFinished feilet:', err.message);
  }
}

// ── API-Football helpers ──────────────────────────────────────────────
async function apiFetch(path) {
  const url = `https://v3.football.api-sports.io/${path}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${url}`);
  return res.json();
}

function toNor(apiName) { return API_TO_NOR[apiName] || apiName; }

async function getActiveFixtures() {
  const data = await apiFetch(
    `fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=1H-HT-2H-ET-BT-P-LIVE`
  );
  return data.response || [];
}

async function getRecentlyFinished() {
  const data = await apiFetch(
    `fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&status=FT-AET-PEN&last=10`
  );
  return data.response || [];
}

function buildMatchResult(fixture) {
  const home = fixture.goals?.home;
  const away = fixture.goals?.away;
  if (home === null || home === undefined) return null;
  const status     = fixture.fixture?.status?.short;
  const isLive     = LIVE_STATUSES.has(status);
  const isFinished = FINISHED_STATUSES.has(status);
  const elapsed    = fixture.fixture?.status?.elapsed || null;
  const penHome    = fixture.score?.penalty?.home ?? null;
  const penAway    = fixture.score?.penalty?.away ?? null;
  return { home, away, status, elapsed, isLive, isFinished, penHome, penAway, updatedAt: Date.now() };
}

function buildLiveEvent(fixture) {
  const events = fixture.events || [];
  if (!events.length) return null;
  const homeTeamApi = fixture.teams?.home?.name;
  const awayTeamApi = fixture.teams?.away?.name;
  const homeNor = toNor(homeTeamApi);
  const awayNor = toNor(awayTeamApi);
  const hg = fixture.goals?.home ?? 0;
  const ag = fixture.goals?.away ?? 0;
  const relevant = [...events].reverse().find(e => e.type === 'Goal' || e.type === 'Card');
  if (!relevant) return null;
  const evTeamApi = relevant.team?.name;
  const isHome    = evTeamApi === homeTeamApi;
  const min       = relevant.time?.elapsed;
  if (relevant.type === 'Goal') {
    const sm = relevant.detail === 'Own Goal' ? ' (s.m.)' : relevant.detail === 'Penalty' ? ' (str.)' : '';
    return {
      type: 'goal', homeNor, awayNor, homeGoals: hg, awayGoals: ag,
      homeScored: isHome, playerName: relevant.player?.name || '?',
      minute: min, suffix: sm, ts: Date.now(),
    };
  }
  if (relevant.type === 'Card') {
    // Gult kort: ingen confetti-trigger, bare tekst
    const icon = relevant.detail?.includes('Yellow') ? '🟨' : '🟥';
    return {
      type: 'card',
      text: `${icon} ${relevant.player?.name || '?'} '${min} (${isHome ? homeNor : awayNor})`,
      ts: Date.now(),
    };
  }
  return null;
}

async function getFixtureLookup() {
  const snap = await db.collection('config').doc('fixtureLookup').get();
  return snap.exists ? snap.data() : {};
}

// ── Hovedjobb ────────────────────────────────────────────────────────
async function pollAndUpdate() {
  if (!API_KEY) { console.warn('FOOTBALL_API_KEY ikke satt'); return; }

  const liveFixtures     = await getActiveFixtures();
  const finishedFixtures = await getRecentlyFinished();

  const lookup         = await getFixtureLookup();
  const resultsRef     = db.collection('config').doc('results');
  const liveRef        = db.collection('config').doc('liveEvent');
  const prevGoalsRef   = db.collection('config').doc('prevGoals');

  const currentResults = (await resultsRef.get()).data() || {};
  const prevGoals      = (await prevGoalsRef.get()).data() || {};

  const updatedResults = { ...currentResults };
  let   resultsChanged = false;
  const batch          = db.batch();

  // Oppdater ferdigspilte kamper
  for (const fixture of finishedFixtures) {
    const homeNor = toNor(fixture.teams?.home?.name);
    const awayNor = toNor(fixture.teams?.away?.name);
    const matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${fixture.teams?.home?.name}_${fixture.teams?.away?.name}`];
    if (!matchId) continue;
    const result = buildMatchResult(fixture);
    if (!result) continue;
    const existing = currentResults[matchId];
    const isNew = !existing || existing.home !== result.home || existing.away !== result.away;
    if (isNew) {
      updatedResults[matchId] = result;
      resultsChanged = true;
      // Trigger tabellreferat kun når et resultat skrives for første gang (kamp nettopp ferdig)
      if (!existing) {
        handleMatchFinished(matchId, homeNor, awayNor, result.home, result.away, { ...updatedResults, [matchId]: result })
          .catch(e => console.error('handleMatchFinished feil:', e.message));
      }
    }
  }

  // Live-kamper: oppdater score + sjekk nye mål
  const newPrevGoals = { ...prevGoals };

  if (liveFixtures.length > 0) {
    for (const fixture of liveFixtures) {
      const homeNor = toNor(fixture.teams?.home?.name);
      const awayNor = toNor(fixture.teams?.away?.name);
      const matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${fixture.teams?.home?.name}_${fixture.teams?.away?.name}`];

      if (matchId) {
        const result = buildMatchResult(fixture);
        if (result) { updatedResults[matchId] = result; resultsChanged = true; }
      }

      // Sjekk om det er scoret et nytt mål siden forrige poll
      const currentGoalKey = `${homeNor}_${awayNor}_${fixture.goals?.home}_${fixture.goals?.away}`;
      const prevGoalKey    = prevGoals[`${homeNor}_${awayNor}`];

      if (prevGoalKey && prevGoalKey !== currentGoalKey) {
        // Nytt mål! Bygg live-event og trigger bot-kommentar (kun ved mål, ikke kort)
        const liveEvent = buildLiveEvent(fixture);
        if (liveEvent?.type === 'goal' && matchId) {
          // Ikke await – la bot-kommentaren kjøre asynkront
          handleGoalEvent(matchId, liveEvent, prevGoalKey).catch(e =>
            console.error('handleGoalEvent feil:', e.message)
          );
        }
      }

      newPrevGoals[`${homeNor}_${awayNor}`] = currentGoalKey;
    }

    const liveEvent = buildLiveEvent(liveFixtures[0]);
    batch.set(liveRef, liveEvent || { type: null, ts: Date.now() });
  } else {
    batch.set(liveRef, { type: null, ts: Date.now() });
  }

  if (resultsChanged) batch.set(resultsRef, updatedResults, { merge: true });
  batch.set(prevGoalsRef, newPrevGoals);

  await batch.commit();
  console.log(`Poll ferdig. Live: ${liveFixtures.length}, Ferdig: ${finishedFixtures.length}`);
}

// ── Scheduled function med intern loop ───────────────────────────────
exports.pollFootball = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Europe/Oslo',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: ['FOOTBALL_API_KEY', 'ANTHROPIC_KEY'],
  },
  async () => {
    if (!isWithinMatchWindow()) {
      console.log('Ingen kamp innenfor 90 min – hopper over polling');
      return;
    }
    const start = Date.now();
    let calls = 0;
    while (true) {
      try { await pollAndUpdate(); calls++; }
      catch (err) { console.error(`Poll #${calls + 1} feilet:`, err.message); }
      const elapsed = Date.now() - start;
      if (elapsed + POLL_INTERVAL_MS >= FUNCTION_DURATION) break;
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    console.log(`pollFootball: ${calls} kall på ${Math.round((Date.now()-start)/1000)}s`);
  }
);

// ── Manuell HTTP-trigger ──────────────────────────────────────────────
exports.manualPoll = onRequest(
  { secrets: ['FOOTBALL_API_KEY', 'ANTHROPIC_KEY'] },
  async (req, res) => {
    try { await pollAndUpdate(); res.json({ ok: true, ts: Date.now() }); }
    catch (err) { console.error('manualPoll feilet:', err); res.status(500).json({ ok: false, error: err.message }); }
  }
);

// ── Hjelpefunksjon: kall Anthropic API fra server ─────────────────────
async function callAnthropic(messages, maxTokens = 1000, model = 'claude-sonnet-4-5') {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

// ── chatWithExpert – sikker backend-versjon ───────────────────────────
exports.expertChat = onRequest(
  { secrets: ['ANTHROPIC_KEY'], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const { systemPrompt, message, history = [], competitionContext = '' } = req.body;
    if (!systemPrompt || !message) { res.status(400).json({ error: 'systemPrompt og message er påkrevd' }); return; }
    try {
      const messages = [
        ...history,
        { role: 'user', content: message + competitionContext },
      ];
      const text = await callAnthropic(
        [{ role: 'user', content: systemPrompt + '\n\n' + message + competitionContext }],
        400
      );
      res.json({ text });
    } catch (err) {
      console.error('expertChat feilet:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── generateTips – bot-tipping og spesialspådommer ────────────────────
exports.generateTips = onRequest(
  { secrets: ['ANTHROPIC_KEY'], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const { prompt, maxTokens = 4000 } = req.body;
    if (!prompt) { res.status(400).json({ error: 'prompt er påkrevd' }); return; }
    try {
      const text = await callAnthropic([{ role: 'user', content: prompt }], maxTokens);
      res.json({ text });
    } catch (err) {
      console.error('generateTips feilet:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── quizComment – Panini-quiz-kommentar ───────────────────────────────
exports.quizComment = onRequest(
  { secrets: ['ANTHROPIC_KEY'], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const { prompt } = req.body;
    if (!prompt) { res.status(400).json({ error: 'prompt er påkrevd' }); return; }
    try {
      const text = await callAnthropic([{ role: 'user', content: prompt }], 300);
      res.json({ text });
    } catch (err) {
      console.error('quizComment feilet:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── getTopscorers – toppscorerliste fra API-Football ─────────────────

// ── Oppdater toppscorere og kort (kjøres hvert 30. min) ──────────────
exports.updateStatsCache = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Europe/Oslo',
    secrets: ['FOOTBALL_API_KEY'],
  },
  async () => {
    if (!isWithinMatchWindow()) return;
    if (!API_KEY) return;
    try {
      // Toppscorere
      const scorersRes = await fetch(
        `https://v3.football.api-sports.io/players/topscorers?league=${WC_LEAGUE}&season=${WC_SEASON}`,
        { headers: { 'x-apisports-key': API_KEY } }
      );
      const scorersData = await scorersRes.json();
      if (scorersData.response?.length) {
        const scorers = scorersData.response.slice(0, 10).map(e => ({
          name: e.player.name,
          team: API_TO_NOR[e.statistics?.[0]?.team?.name] || e.statistics?.[0]?.team?.name || '–',
          goals: e.statistics?.[0]?.goals?.total ?? 0,
        }));
        await db.collection('config').doc('statsCache').set({ scorers, updatedAt: Date.now() }, { merge: true });
        console.log('Toppscorere oppdatert:', scorers.length);
      }

      // Kort (topp gule/røde)
      const cardsRes = await fetch(
        `https://v3.football.api-sports.io/players/topcards?league=${WC_LEAGUE}&season=${WC_SEASON}`,
        { headers: { 'x-apisports-key': API_KEY } }
      );
      const cardsData = await cardsRes.json();
      if (cardsData.response?.length) {
        const cards = cardsData.response.slice(0, 10).map(e => ({
          name: e.player.name,
          team: API_TO_NOR[e.statistics?.[0]?.team?.name] || e.statistics?.[0]?.team?.name || '–',
          yellow: e.statistics?.[0]?.cards?.yellow ?? 0,
          red: (e.statistics?.[0]?.cards?.red ?? 0) + (e.statistics?.[0]?.cards?.yellowred ?? 0),
        }));
        await db.collection('config').doc('statsCache').set({ cards, updatedAt: Date.now() }, { merge: true });
        console.log('Kortliste oppdatert:', cards.length);
      }
    } catch (err) {
      console.error('updateStatsCache feilet:', err.message);
    }
  }
);


// ── Manuell trigger for tabellreferat (siste ferdige kamp) ───────────
exports.triggerSummary = onRequest(
  { secrets: ['FOOTBALL_API_KEY', 'ANTHROPIC_KEY'], cors: true },
  async (req, res) => {
    try {
      const resultsSnap = await db.collection('config').doc('results').get();
      const results = resultsSnap.exists ? resultsSnap.data() : {};
      console.log('triggerSummary: results keys:', Object.keys(results));

      // Finn kamp-IDer: stort bokstav + tall (A1, B12 osv.)
      const matchEntries = Object.entries(results)
        .filter(([id, r]) => /^[A-Z]\d+$/.test(id) && r && typeof r.home === 'number' && typeof r.away === 'number')
        .sort(([a], [b]) => a.localeCompare(b));

      console.log('triggerSummary: matchEntries:', matchEntries.map(([id]) => id));

      if (!matchEntries.length) { res.json({ ok: false, error: 'Ingen ferdigspilte kamper i results' }); return; }

      const [matchId, result] = matchEntries[matchEntries.length - 1];
      console.log('triggerSummary: generating for', matchId, result);

      const lookup = await db.collection('config').doc('fixtureLookup').get();
      const lookupData = lookup.exists ? lookup.data() : {};
      const homeAway = Object.entries(lookupData).find(([k, v]) => v === matchId);
      const homeNor = homeAway ? homeAway[0].split('_')[0] : matchId;
      const awayNor = homeAway ? homeAway[0].split('_')[1] : '';
      console.log('triggerSummary: teams:', homeNor, 'vs', awayNor);

      // Kall handleMatchFinished direkte og kast feil oppover
      if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_KEY ikke satt');

      const usersSnap = await db.collection('users').get();
      const allUsers = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));

      function calcPts(user) {
        let total = 0, fulltreff = 0;
        for (const [mid, act] of Object.entries(results)) {
          const tip = user.tips?.[mid];
          if (!tip || act?.home === undefined) continue;
          const th = parseInt(tip.home), ta = parseInt(tip.away);
          const ah = parseInt(act.home), aa = parseInt(act.away);
          if (isNaN(th)||isNaN(ta)||isNaN(ah)||isNaN(aa)) continue;
          let p = 0;
          if ((th>ta?'H':th<ta?'A':'D') === (ah>aa?'H':ah<aa?'A':'D')) p+=2;
          if (th===ah) p+=1; if (ta===aa) p+=1;
          if (p===4 && ah+aa>=5) p=5;
          total+=p; if(p>=4) fulltreff++;
        }
        return { total, fulltreff };
      }

      const ranked = allUsers.map(u=>({...u,...calcPts(u)})).sort((a,b)=>b.total-a.total||b.fulltreff-a.fulltreff);
      const tableLines = ranked.map((u,i)=>`${i+1}. ${u.displayName||u.id}: ${u.total}p`).join('\n');
      const matchTips = allUsers.map(u=>{ const t=u.tips?.[matchId]; return t?`${u.displayName||u.id}: ${t.home}-${t.away}`:null; }).filter(Boolean).join(', ');

      const expert = PANEL_EXPERTS[Math.floor(Math.random()*PANEL_EXPERTS.length)];
      const prompt = `${homeNor} vs ${awayNor} endte ${result.home}-${result.away}.
Deltakernes tips: ${matchTips||'ingen'}
Stillingstabell:
${tableLines}

Skriv 3-5 setninger om tabellsituasjonen etter kampen. Hvem leder, hvem klatrer, hvem sliter. Ikke om kampen selv. Hold deg i karakter.`;

      console.log('triggerSummary: calling Anthropic for', expert.name);
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:250, system:expert.personality, messages:[{role:'user',content:prompt}] }),
      });
      if (!apiRes.ok) throw new Error(`Anthropic ${apiRes.status}: ${await apiRes.text()}`);
      const apiData = await apiRes.json();
      const text = apiData.content?.[0]?.text?.trim();
      if (!text) throw new Error('Ingen tekst fra Anthropic');

      console.log('triggerSummary: got text, saving...');
      await db.collection('summaries').doc(matchId).set({ botText:text, botId:expert.id, botName:expert.name, ts:FieldValue.serverTimestamp() }, { merge:true });
      console.log('triggerSummary: done, matchId:', matchId);
      res.json({ ok: true, matchId, expert: expert.name });
    } catch (err) {
      console.error('triggerSummary feilet:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);


// ── Manuell trigger for toppscorere/kort ─────────────────────────────
exports.refreshStatsCache = onRequest(
  { secrets: ['FOOTBALL_API_KEY'], cors: true },
  async (req, res) => {
    if (!API_KEY) { res.status(500).json({ ok: false, error: 'FOOTBALL_API_KEY ikke satt' }); return; }
    try {
      const scorersRes = await fetch(
        `https://v3.football.api-sports.io/players/topscorers?league=${WC_LEAGUE}&season=${WC_SEASON}`,
        { headers: { 'x-apisports-key': API_KEY } }
      );
      const scorersData = await scorersRes.json();
      if (!scorersData.response?.length) { res.json({ ok: false, error: 'Ingen data fra API' }); return; }
      const scorers = scorersData.response.slice(0, 10).map(e => ({
        name: e.player.name,
        team: API_TO_NOR[e.statistics?.[0]?.team?.name] || e.statistics?.[0]?.team?.name || '–',
        goals: e.statistics?.[0]?.goals?.total ?? 0,
      }));
      await db.collection('config').doc('statsCache').set({ scorers, updatedAt: Date.now() }, { merge: true });
      console.log('updatestatscache: oppdatert', scorers.length, 'scorers');
      res.json({ ok: true, count: scorers.length });
    } catch (err) {
      console.error('updatestatscache feilet:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

exports.getTopscorers = onRequest(
  { secrets: ['FOOTBALL_API_KEY'], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    try {
      const response = await fetch(
        `https://v3.football.api-sports.io/players/topscorers?league=${WC_LEAGUE}&season=${WC_SEASON}`,
        { headers: { 'x-apisports-key': API_KEY } }
      );
      const data = await response.json();
      if (!data.response?.length) { res.json({ scorers: [] }); return; }

      const scorers = data.response.slice(0, 10).map(entry => ({
        name: entry.player.name,
        team: API_TO_NOR[entry.statistics?.[0]?.team?.name] || entry.statistics?.[0]?.team?.name || '–',
        goals: entry.statistics?.[0]?.goals?.total ?? 0,
      }));

      res.json({ scorers });
    } catch (err) {
      console.error('getTopscorers feilet:', err);
      res.status(500).json({ error: err.message, scorers: [] });
    }
  }
);

// ── Bygg fixture-lookup ───────────────────────────────────────────────
exports.buildFixtureLookup = onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  const { matches } = req.body;
  if (!matches || !Array.isArray(matches)) {
    res.status(400).json({ error: 'Body må inneholde matches: [{id, home, away}]' });
    return;
  }
  const lookup = {};
  for (const m of matches) {
    const homeApi = TEAM_NAME_MAP[m.home] || m.home;
    const awayApi = TEAM_NAME_MAP[m.away] || m.away;
    lookup[`${m.home}_${m.away}`]   = m.id;
    lookup[`${homeApi}_${awayApi}`] = m.id;
  }
  await db.collection('config').doc('fixtureLookup').set(lookup);
  res.json({ ok: true, entries: Object.keys(lookup).length });
});
