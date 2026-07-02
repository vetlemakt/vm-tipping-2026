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


// ── Lagnavn-mapping ──────────────────────────────────────────────────
const TEAM_NAME_MAP = {
  'Mexico':'Mexico','Sør-Afrika':'South Africa','Sør-Korea':'South Korea',
  'Tsjekkia':'Czech Republic','Canada':'Canada','Bosnia-Herz':'Bosnia and Herzegovina','Bosnia-Herz2':'Bosnia & Herzegovina',
  'Qatar':'Qatar','Sveits':'Switzerland','Brasil':'Brazil','Marokko':'Morocco',
  'Haiti':'Haiti','Skottland':'Scotland','USA':'USA','USA2':'United States','Paraguay':'Paraguay',
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
// In-memory dedup for events within the same process lifetime
const firedEvents = new Set();

const NOR_TO_SHORT = {
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



// ── Kampprogram: når skal vi polle? (UTC-tider, generert fra VM-kampoppsettet) ──
// Disse er regnet ut FRA norsk lokal tid (CEST = UTC+2) til UTC automatisk,
// for å unngå manuelle UTC-regnefeil. Hvis kampoppsettet i App.js/constants.js
// (GROUP_MATCHES/KNOCKOUT_MATCHES) endres, må denne listen oppdateres til match.
// Bare poll ca. 90 min rundt kampstart for å spare API-kvoter.
const MATCH_WINDOWS = [
  { date: '2026-06-11', utcHour: 19, utcMin: 0 },  // A1 (2026-06-11 21:00 CEST)
  { date: '2026-06-12', utcHour: 2, utcMin: 0 },  // A2 (2026-06-12 04:00 CEST)
  { date: '2026-06-18', utcHour: 16, utcMin: 0 },  // A3 (2026-06-18 18:00 CEST)
  { date: '2026-06-19', utcHour: 1, utcMin: 0 },  // A4 (2026-06-19 03:00 CEST)
  { date: '2026-06-25', utcHour: 1, utcMin: 0 },  // A5 (2026-06-25 03:00 CEST)
  { date: '2026-06-25', utcHour: 1, utcMin: 0 },  // A6 (2026-06-25 03:00 CEST)
  { date: '2026-06-12', utcHour: 19, utcMin: 0 },  // B1 (2026-06-12 21:00 CEST)
  { date: '2026-06-13', utcHour: 19, utcMin: 0 },  // B2 (2026-06-13 21:00 CEST)
  { date: '2026-06-18', utcHour: 19, utcMin: 0 },  // B3 (2026-06-18 21:00 CEST)
  { date: '2026-06-18', utcHour: 22, utcMin: 0 },  // B4 (2026-06-19 00:00 CEST)
  { date: '2026-06-24', utcHour: 19, utcMin: 0 },  // B5 (2026-06-24 21:00 CEST)
  { date: '2026-06-24', utcHour: 19, utcMin: 0 },  // B6 (2026-06-24 21:00 CEST)
  { date: '2026-06-13', utcHour: 22, utcMin: 0 },  // C1 (2026-06-14 00:00 CEST)
  { date: '2026-06-14', utcHour: 1, utcMin: 0 },  // C2 (2026-06-14 03:00 CEST)
  { date: '2026-06-19', utcHour: 22, utcMin: 0 },  // C3 (2026-06-20 00:00 CEST)
  { date: '2026-06-20', utcHour: 0, utcMin: 30 },  // C4 (2026-06-20 02:30 CEST)
  { date: '2026-06-24', utcHour: 22, utcMin: 0 },  // C5 (2026-06-25 00:00 CEST)
  { date: '2026-06-24', utcHour: 22, utcMin: 0 },  // C6 (2026-06-25 00:00 CEST)
  { date: '2026-06-13', utcHour: 1, utcMin: 0 },  // D1 (2026-06-13 03:00 CEST)
  { date: '2026-06-14', utcHour: 4, utcMin: 0 },  // D2 (2026-06-14 06:00 CEST)
  { date: '2026-06-19', utcHour: 19, utcMin: 0 },  // D3 (2026-06-19 21:00 CEST)
  { date: '2026-06-20', utcHour: 3, utcMin: 0 },  // D4 (2026-06-20 05:00 CEST)
  { date: '2026-06-26', utcHour: 2, utcMin: 0 },  // D5 (2026-06-26 04:00 CEST)
  { date: '2026-06-26', utcHour: 2, utcMin: 0 },  // D6 (2026-06-26 04:00 CEST)
  { date: '2026-06-14', utcHour: 17, utcMin: 0 },  // E1 (2026-06-14 19:00 CEST)
  { date: '2026-06-14', utcHour: 23, utcMin: 0 },  // E2 (2026-06-15 01:00 CEST)
  { date: '2026-06-21', utcHour: 20, utcMin: 0 },  // E3 (2026-06-21 22:00 CEST)
  { date: '2026-06-21', utcHour: 0, utcMin: 0 },  // E4 (2026-06-21 02:00 CEST)
  { date: '2026-06-25', utcHour: 20, utcMin: 0 },  // E5 (2026-06-25 22:00 CEST)
  { date: '2026-06-25', utcHour: 20, utcMin: 0 },  // E6 (2026-06-25 22:00 CEST)
  { date: '2026-06-14', utcHour: 20, utcMin: 0 },  // F1 (2026-06-14 22:00 CEST)
  { date: '2026-06-15', utcHour: 2, utcMin: 0 },  // F2 (2026-06-15 04:00 CEST)
  { date: '2026-06-20', utcHour: 17, utcMin: 0 },  // F3 (2026-06-20 19:00 CEST)
  { date: '2026-06-22', utcHour: 4, utcMin: 0 },  // F4 (2026-06-22 06:00 CEST)
  { date: '2026-06-25', utcHour: 23, utcMin: 0 },  // F5 (2026-06-26 01:00 CEST)
  { date: '2026-06-25', utcHour: 23, utcMin: 0 },  // F6 (2026-06-26 01:00 CEST)
  { date: '2026-06-15', utcHour: 19, utcMin: 0 },  // G1 (2026-06-15 21:00 CEST)
  { date: '2026-06-16', utcHour: 1, utcMin: 0 },  // G2 (2026-06-16 03:00 CEST)
  { date: '2026-06-21', utcHour: 19, utcMin: 0 },  // G3 (2026-06-21 21:00 CEST)
  { date: '2026-06-22', utcHour: 1, utcMin: 0 },  // G4 (2026-06-22 03:00 CEST)
  { date: '2026-06-27', utcHour: 3, utcMin: 0 },  // G5 (2026-06-27 05:00 CEST)
  { date: '2026-06-27', utcHour: 3, utcMin: 0 },  // G6 (2026-06-27 05:00 CEST)
  { date: '2026-06-15', utcHour: 16, utcMin: 0 },  // H1 (2026-06-15 18:00 CEST)
  { date: '2026-06-15', utcHour: 22, utcMin: 0 },  // H2 (2026-06-16 00:00 CEST)
  { date: '2026-06-21', utcHour: 16, utcMin: 0 },  // H3 (2026-06-21 18:00 CEST)
  { date: '2026-06-21', utcHour: 22, utcMin: 0 },  // H4 (2026-06-22 00:00 CEST)
  { date: '2026-06-27', utcHour: 0, utcMin: 0 },  // H5 (2026-06-27 02:00 CEST)
  { date: '2026-06-27', utcHour: 0, utcMin: 0 },  // H6 (2026-06-27 02:00 CEST)
  { date: '2026-06-16', utcHour: 19, utcMin: 0 },  // I1 (2026-06-16 21:00 CEST)
  { date: '2026-06-16', utcHour: 22, utcMin: 0 },  // I2 (2026-06-17 00:00 CEST)
  { date: '2026-06-22', utcHour: 21, utcMin: 0 },  // I3 (2026-06-22 23:00 CEST)
  { date: '2026-06-23', utcHour: 0, utcMin: 0 },  // I4 (2026-06-23 02:00 CEST)
  { date: '2026-06-26', utcHour: 19, utcMin: 0 },  // I5 (2026-06-26 21:00 CEST)
  { date: '2026-06-26', utcHour: 19, utcMin: 0 },  // I6 (2026-06-26 21:00 CEST)
  { date: '2026-06-17', utcHour: 1, utcMin: 0 },  // J1 (2026-06-17 03:00 CEST)
  { date: '2026-06-17', utcHour: 4, utcMin: 0 },  // J2 (2026-06-17 06:00 CEST)
  { date: '2026-06-22', utcHour: 17, utcMin: 0 },  // J3 (2026-06-22 19:00 CEST)
  { date: '2026-06-23', utcHour: 3, utcMin: 0 },  // J4 (2026-06-23 05:00 CEST)
  { date: '2026-06-28', utcHour: 2, utcMin: 0 },  // J5 (2026-06-28 04:00 CEST)
  { date: '2026-06-28', utcHour: 2, utcMin: 0 },  // J6 (2026-06-28 04:00 CEST)
  { date: '2026-06-17', utcHour: 17, utcMin: 0 },  // K1 (2026-06-17 19:00 CEST)
  { date: '2026-06-18', utcHour: 2, utcMin: 0 },  // K2 (2026-06-18 04:00 CEST)
  { date: '2026-06-23', utcHour: 17, utcMin: 0 },  // K3 (2026-06-23 19:00 CEST)
  { date: '2026-06-24', utcHour: 2, utcMin: 0 },  // K4 (2026-06-24 04:00 CEST)
  { date: '2026-06-27', utcHour: 23, utcMin: 30 },  // K5 (2026-06-28 01:30 CEST)
  { date: '2026-06-27', utcHour: 23, utcMin: 30 },  // K6 (2026-06-28 01:30 CEST)
  { date: '2026-06-17', utcHour: 20, utcMin: 0 },  // L1 (2026-06-17 22:00 CEST)
  { date: '2026-06-17', utcHour: 23, utcMin: 0 },  // L2 (2026-06-18 01:00 CEST)
  { date: '2026-06-23', utcHour: 20, utcMin: 0 },  // L3 (2026-06-23 22:00 CEST)
  { date: '2026-06-23', utcHour: 23, utcMin: 0 },  // L4 (2026-06-24 01:00 CEST)
  { date: '2026-06-27', utcHour: 21, utcMin: 0 },  // L5 (2026-06-27 23:00 CEST)
  { date: '2026-06-27', utcHour: 21, utcMin: 0 },  // L6 (2026-06-27 23:00 CEST)
  { date: '2026-06-28', utcHour: 19, utcMin: 0, knockout: true },  // r32_1 (2026-06-28 21:00 CEST)
  { date: '2026-06-29', utcHour: 20, utcMin: 30, knockout: true },  // r32_2 (2026-06-29 22:30 CEST)
  { date: '2026-06-30', utcHour: 1, utcMin: 0, knockout: true },  // r32_3 (2026-06-30 03:00 CEST)
  { date: '2026-06-29', utcHour: 17, utcMin: 0, knockout: true },  // r32_4 (2026-06-29 19:00 CEST)
  { date: '2026-06-30', utcHour: 21, utcMin: 0, knockout: true },  // r32_5 (2026-06-30 23:00 CEST)
  { date: '2026-06-30', utcHour: 17, utcMin: 0, knockout: true },  // r32_6 (2026-06-30 19:00 CEST)
  { date: '2026-07-01', utcHour: 1, utcMin: 0, knockout: true },  // r32_7 (2026-07-01 03:00 CEST)
  { date: '2026-07-01', utcHour: 16, utcMin: 0, knockout: true },  // r32_8 (2026-07-01 18:00 CEST)
  { date: '2026-07-02', utcHour: 0, utcMin: 0, knockout: true },  // r32_9 (2026-07-02 02:00 CEST)
  { date: '2026-07-01', utcHour: 20, utcMin: 0, knockout: true },  // r32_10 (2026-07-01 22:00 CEST)
  { date: '2026-07-02', utcHour: 23, utcMin: 0, knockout: true },  // r32_11 (2026-07-03 01:00 CEST)
  { date: '2026-07-02', utcHour: 19, utcMin: 0, knockout: true },  // r32_12 (2026-07-02 21:00 CEST)
  { date: '2026-07-03', utcHour: 3, utcMin: 0, knockout: true },  // r32_13 (2026-07-03 05:00 CEST)
  { date: '2026-07-03', utcHour: 22, utcMin: 0, knockout: true },  // r32_14 (2026-07-04 00:00 CEST)
  { date: '2026-07-04', utcHour: 1, utcMin: 30, knockout: true },  // r32_15 (2026-07-04 03:30 CEST)
  { date: '2026-07-03', utcHour: 18, utcMin: 0, knockout: true },  // r32_16 (2026-07-03 20:00 CEST)
  { date: '2026-07-04', utcHour: 21, utcMin: 0, knockout: true },  // r16_1 (2026-07-04 23:00 CEST)
  { date: '2026-07-04', utcHour: 17, utcMin: 0, knockout: true },  // r16_2 (2026-07-04 19:00 CEST)
  { date: '2026-07-05', utcHour: 20, utcMin: 0, knockout: true },  // r16_3 (2026-07-05 22:00 CEST)
  { date: '2026-07-06', utcHour: 0, utcMin: 0, knockout: true },  // r16_4 (2026-07-06 02:00 CEST)
  { date: '2026-07-06', utcHour: 19, utcMin: 0, knockout: true },  // r16_5 (2026-07-06 21:00 CEST)
  { date: '2026-07-07', utcHour: 0, utcMin: 0, knockout: true },  // r16_6 (2026-07-07 02:00 CEST)
  { date: '2026-07-07', utcHour: 16, utcMin: 0, knockout: true },  // r16_7 (2026-07-07 18:00 CEST)
  { date: '2026-07-07', utcHour: 20, utcMin: 0, knockout: true },  // r16_8 (2026-07-07 22:00 CEST)
  { date: '2026-07-09', utcHour: 20, utcMin: 0, knockout: true },  // qf_1 (2026-07-09 22:00 CEST)
  { date: '2026-07-10', utcHour: 19, utcMin: 0, knockout: true },  // qf_2 (2026-07-10 21:00 CEST)
  { date: '2026-07-11', utcHour: 21, utcMin: 0, knockout: true },  // qf_3 (2026-07-11 23:00 CEST)
  { date: '2026-07-12', utcHour: 1, utcMin: 0, knockout: true },  // qf_4 (2026-07-12 03:00 CEST)
  { date: '2026-07-14', utcHour: 19, utcMin: 0, knockout: true },  // sf_1 (2026-07-14 21:00 CEST)
  { date: '2026-07-15', utcHour: 19, utcMin: 0, knockout: true },  // sf_2 (2026-07-15 21:00 CEST)
  { date: '2026-07-18', utcHour: 21, utcMin: 0, knockout: true },  // bronze (2026-07-18 23:00 CEST)
  { date: '2026-07-19', utcHour: 19, utcMin: 0, knockout: true },  // final (2026-07-19 21:00 CEST)
];

// Sjekk om vi er innenfor et kampvindu
// Gruppespill: 3 timer etter kampstart (90 min + pause + ekstra)
// Sluttspill (w.knockout): 4 timer (ekstraomganger + straffekonkurranse)
function isWithinMatchWindow() {
  const now = new Date();
  const nowMs = now.getTime();
  return MATCH_WINDOWS.some(w => {
    const wDate = new Date(`${w.date}T${String(w.utcHour).padStart(2,'0')}:${String(w.utcMin).padStart(2,'0')}:00Z`);
    const windowAfterMs = (w.knockout ? 4 : 3) * 60 * 60 * 1000;
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
    if (!act || act.home === undefined || act.away === undefined || act.scoringExcluded) return;
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
  // Dedup: sjekk om denne goal-keyen allerede er håndtert
  const goalKey = `${matchId}_${liveEvent.homeGoals}_${liveEvent.awayGoals}_${liveEvent.playerName}_${liveEvent.minute}`;
  const dedupRef = db.collection('config').doc('firedGoals');
  let alreadyFired = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(dedupRef);
    const fired = snap.exists ? (snap.data().keys || []) : [];
    if (fired.includes(goalKey)) { alreadyFired = true; return; }
    tx.set(dedupRef, { keys: [...fired.slice(-20), goalKey] });
  });
  if (alreadyFired) { console.log('handleGoalEvent: allerede håndtert:', goalKey); return; }

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

  // Alle eksperter kommenterer alltid (reasons gir kontekst men er ikke påkrevd)

  // Generer og post kommentar
  const matchContext = {
    homeTeam:   liveEvent.homeTeam || liveEvent.homeNor,
    awayTeam:   liveEvent.awayTeam || liveEvent.awayNor,
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
// ── Bracket-tabell: hvilken kamp og side fylles ut av vinner/taper av gitt kampnummer ──
const BRACKET_SLOTS = {
  // matchNum -> [{ nextId, side, role }]  role: 'winner' | 'loser'
  73:  [{ nextId: 'r16_2', side: 'home', role: 'winner' }],
  74:  [{ nextId: 'r16_1', side: 'home', role: 'winner' }],
  75:  [{ nextId: 'r16_2', side: 'away', role: 'winner' }],
  76:  [{ nextId: 'r16_3', side: 'home', role: 'winner' }],
  77:  [{ nextId: 'r16_1', side: 'away', role: 'winner' }],
  78:  [{ nextId: 'r16_3', side: 'away', role: 'winner' }],
  79:  [{ nextId: 'r16_4', side: 'home', role: 'winner' }],
  80:  [{ nextId: 'r16_4', side: 'away', role: 'winner' }],
  81:  [{ nextId: 'r16_6', side: 'home', role: 'winner' }],
  82:  [{ nextId: 'r16_6', side: 'away', role: 'winner' }],
  83:  [{ nextId: 'r16_5', side: 'home', role: 'winner' }],
  84:  [{ nextId: 'r16_5', side: 'away', role: 'winner' }],
  85:  [{ nextId: 'r16_8', side: 'home', role: 'winner' }],
  86:  [{ nextId: 'r16_7', side: 'home', role: 'winner' }],
  87:  [{ nextId: 'r16_8', side: 'away', role: 'winner' }],
  88:  [{ nextId: 'r16_7', side: 'away', role: 'winner' }],
  89:  [{ nextId: 'qf_1',  side: 'home', role: 'winner' }],
  90:  [{ nextId: 'qf_1',  side: 'away', role: 'winner' }],
  91:  [{ nextId: 'qf_3',  side: 'home', role: 'winner' }],
  92:  [{ nextId: 'qf_3',  side: 'away', role: 'winner' }],
  93:  [{ nextId: 'qf_2',  side: 'home', role: 'winner' }],
  94:  [{ nextId: 'qf_2',  side: 'away', role: 'winner' }],
  95:  [{ nextId: 'qf_4',  side: 'home', role: 'winner' }],
  96:  [{ nextId: 'qf_4',  side: 'away', role: 'winner' }],
  97:  [{ nextId: 'sf_1',  side: 'home', role: 'winner' }, { nextId: 'bronze', side: 'home', role: 'loser' }],
  98:  [{ nextId: 'sf_1',  side: 'away', role: 'winner' }, { nextId: 'bronze', side: 'away', role: 'loser' }],
  99:  [{ nextId: 'sf_2',  side: 'home', role: 'winner' }, { nextId: 'bronze', side: 'home', role: 'loser' }],
  100: [{ nextId: 'sf_2',  side: 'away', role: 'winner' }, { nextId: 'bronze', side: 'away', role: 'loser' }],
  101: [{ nextId: 'final', side: 'home', role: 'winner' }],
  102: [{ nextId: 'final', side: 'away', role: 'winner' }],
};

async function propagateBracket(matchId, homeNor, awayNor, homeGoals, awayGoals, result) {
  const allMatches = [...KNOCKOUT_MATCHES];
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;
  const slots = BRACKET_SLOTS[match.matchNum];
  if (!slots || slots.length === 0) return;

  // Bestem vinner – bruk API-Footballs eget vinnerfelt (tar høyde for
  // ekstraomganger/straffer) fremfor å regne det ut selv fra scorer.
  // Fulltidsresultatet (homeGoals/awayGoals) brukes KUN til poeng i tippekonkurransen,
  // aldri til å avgjøre hvem som går videre.
  let homeWon;
  if (result?.winnerSide === 'home') {
    homeWon = true;
  } else if (result?.winnerSide === 'away') {
    homeWon = false;
  } else if (result?.penHome !== null && result?.penHome !== undefined) {
    homeWon = parseInt(result.penHome) > parseInt(result.penAway);
  } else if (parseInt(homeGoals) === parseInt(awayGoals)) {
    // Uavgjort og verken vinnerfelt eller straffedata finnes ennå – ikke propager, vent
    console.log(`propagateBracket: ${matchId} uavgjort (${homeGoals}-${awayGoals}) uten vinnerdata – venter`);
    return;
  } else {
    homeWon = parseInt(homeGoals) > parseInt(awayGoals);
  }
  const winner = homeWon ? homeNor : awayNor;
  const loser  = homeWon ? awayNor : homeNor;

  const resultsRef = db.collection('config').doc('results');
  const updates = {};
  for (const { nextId, side, role } of slots) {
    const team = role === 'winner' ? winner : loser;
    updates[`${nextId}.${side === 'home' ? 'homeTeam' : 'awayTeam'}`] = team;
  }
  await resultsRef.set(updates, { merge: true });
  console.log(`Bracket propagert fra ${matchId} (kamp ${match.matchNum}):`, updates);
}

async function handleMatchFinished(matchId, homeNor, awayNor, homeGoals, awayGoals, updatedResults) {
  // Propagér vinner/taper til neste kamp i bracketen automatisk
  await propagateBracket(matchId, homeNor, awayNor, homeGoals, awayGoals, updatedResults[matchId])
    .catch(e => console.error('propagateBracket feil:', e.message));

  if (!ANTHROPIC_KEY) return;

  // Ikke skriv nytt referat hvis det allerede finnes et
  const existingSum = await db.collection('summaries').doc(matchId).get();
  if (existingSum.exists && existingSum.data()?.botText) {
    console.log(`Referat for ${matchId} finnes allerede, hopper over.`);
    return;
  }

  // Hent alle brukere
  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== 'admin' && !u.id.startsWith('panel_'));

  // Beregn stillingstabell – bruker calcTotalScore som inkluderer gruppeplassering og spesialtips
  function calcScoreForSummary(user) {
    const total = calcTotalScore(user, updatedResults);
    let fulltreff = 0;
    for (const [mid, act] of Object.entries(updatedResults)) {
      const tip = user.tips?.[mid];
      if (!tip || act?.home === undefined) continue;
      if (calcMatchPts(tip, act) >= 4) fulltreff++;
    }
    return { total, fulltreff };
  }

  const ranked = allUsers
    .map(u => ({ ...u, ...calcScoreForSummary(u) }))
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

function toNor(apiName) {
  if (!apiName) return apiName;
  // Direkte oppslag
  if (API_TO_NOR[apiName]) return API_TO_NOR[apiName];
  // & → and
  const withAnd = apiName.replace('&', 'and').trim();
  if (API_TO_NOR[withAnd]) return API_TO_NOR[withAnd];
  // Kjente API-varianter
  const variants = {
    'United States': 'USA',
    'Czech Republic': 'Tsjekkia',
    'Czechia': 'Tsjekkia',
    'South Korea': 'Sør-Korea',
    'Korea Republic': 'Sør-Korea',
    'South Africa': 'Sør-Afrika',
    'Ivory Coast': 'Elfenbenskysten',
    "Cote d'Ivoire": 'Elfenbenskysten',
    'DR Congo': 'Kongo DR',
    'Congo DR': 'Kongo DR',
    'Cape Verde': 'Kapp Verde',
    'Saudi Arabia': 'Saudi-Arabia',
    'Bosnia and Herzegovina': 'Bosnia-Herz',
    'Bosnia & Herzegovina': 'Bosnia-Herz',
    'New Zealand': 'New Zealand',
  };
  return variants[apiName] || API_TO_NOR[apiName] || apiName;
}

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
  const status     = fixture.fixture?.status?.short;
  const isLive     = LIVE_STATUSES.has(status);
  const isFinished = FINISHED_STATUSES.has(status);
  const elapsed    = fixture.fixture?.status?.elapsed || null;

  // Bruk alltid 90-minuttsresultatet for poengberegning (fulltime)
  // I ekstraomganger/straffer er fixture.goals oppdatert løpende,
  // mens score.fulltime er låst etter 90 min
  const ftHome = fixture.score?.fulltime?.home;
  const ftAway = fixture.score?.fulltime?.away;
  const liveHome = fixture.goals?.home;
  const liveAway = fixture.goals?.away;

  // Under kamp: bruk live-score. Etter FT: bruk fulltime-score
  const home = (isFinished && ftHome !== null && ftHome !== undefined) ? ftHome : liveHome;
  const away = (isFinished && ftAway !== null && ftAway !== undefined) ? ftAway : liveAway;

  if (home === null || home === undefined) return null;

  const penHome = fixture.score?.penalty?.home ?? null;
  const penAway = fixture.score?.penalty?.away ?? null;
  const etHome  = fixture.score?.extratime?.home ?? null;
  const etAway  = fixture.score?.extratime?.away ?? null;

  // API-Football sier eksplisitt hvem som faktisk vant kampen (tar høyde for
  // ekstraomganger/straffer). Denne brukes til å avgjøre hvem som går videre
  // i sluttspillet – IKKE fulltidsresultatet, som kun brukes til poeng i tippekonkurransen.
  const homeWinnerApi = fixture.teams?.home?.winner;
  const awayWinnerApi = fixture.teams?.away?.winner;
  const winnerSide = homeWinnerApi === true ? 'home' : awayWinnerApi === true ? 'away' : null;

  return { home, away, status, elapsed, isLive, isFinished,
    penHome, penAway, etHome, etAway, winnerSide, updatedAt: Date.now() };
}

function buildLiveEvent(fixture, includeCards = false) {
  const events = fixture.events || [];
  if (!events.length) return null;
  const homeTeamApi = fixture.teams?.home?.name;
  const awayTeamApi = fixture.teams?.away?.name;
  const homeNor = toNor(homeTeamApi);
  const awayNor = toNor(awayTeamApi);
  const hg = fixture.goals?.home ?? 0;
  const ag = fixture.goals?.away ?? 0;
  const relevant = includeCards
    ? [...events].reverse().find(e => e.type === 'Goal' || e.type === 'Card')
    : [...events].reverse().find(e => e.type === 'Goal');
  if (!relevant) return null;
  const evTeamApi = relevant.team?.name;
  const isHome    = evTeamApi === homeTeamApi;
  const min       = relevant.time?.elapsed;
  if (relevant.type === 'Goal') {
    const isOwnGoal = relevant.detail === 'Own Goal';
    const sm = isOwnGoal ? ' (s.m.)' : relevant.detail === 'Penalty' ? ' (str.)' : '';
    const shortH = NOR_TO_SHORT[homeNor] || homeNor.slice(0,3).toUpperCase();
    const shortA = NOR_TO_SHORT[awayNor] || awayNor.slice(0,3).toUpperCase();
    // Ved selvmål scorer motstanderlaget det faktiske målet
    const homeScored = isOwnGoal ? !isHome : isHome;
    return {
      type: 'goal', homeTeam: homeNor, awayTeam: awayNor,
      shortHome: shortH, shortAway: shortA,
      homeGoals: hg, awayGoals: ag,
      homeScored, playerName: relevant.player?.name || '?',
      minute: min, suffix: sm, isOwnGoal, ts: Date.now(),
    };
  }
  if (relevant.type === 'Card') {
    const isYellow = relevant.detail?.includes('Yellow');
    const icon = isYellow ? '🟨' : '🟥';
    const shortH = NOR_TO_SHORT[homeNor] || homeNor.slice(0,3).toUpperCase();
    const shortA = NOR_TO_SHORT[awayNor] || awayNor.slice(0,3).toUpperCase();
    return {
      type: 'card',
      cardColor: isYellow ? 'Yellow' : 'Red',
      text: `${icon} ${relevant.player?.name || '?'} '${min} (${isHome ? shortH : shortA})`,
      playerName: relevant.player?.name || '?',
      minute: min,
      teamNor: isHome ? homeNor : awayNor,
      shortHome: shortH, shortAway: shortA,
      homeGoals: hg, awayGoals: ag,
      ts: Date.now(),
    };
  }
  return null;
}

async function getFixtureEvents(fixtureId) {
  if (!fixtureId) return [];
  try {
    const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`);
    return data.response || [];
  } catch(e) {
    console.warn('getFixtureEvents feilet:', e.message);
    return [];
  }
}

async function getFixtureLookup() {
  const snap = await db.collection('config').doc('fixtureLookup').get();
  return snap.exists ? snap.data() : {};
}

// ── Hovedjobb ────────────────────────────────────────────────────────
async function pollAndUpdate(checkFinished = true) {
  if (!API_KEY) { console.warn('FOOTBALL_API_KEY ikke satt'); return; }

  const liveFixtures     = await getActiveFixtures();
  const finishedFixtures = checkFinished ? await getRecentlyFinished() : [];

  const lookup         = await getFixtureLookup();
  const resultsRef     = db.collection('config').doc('results');
  const liveRef        = db.collection('config').doc('liveEvent');
  const prevGoalsRef   = db.collection('config').doc('prevGoals');
  const prevCardsRef   = db.collection('config').doc('prevCards');

  const currentResults = (await resultsRef.get()).data() || {};
  const prevGoals      = (await prevGoalsRef.get()).data() || {};
  const prevCards      = (await prevCardsRef.get()).data() || {};

  const updatedResults = { ...currentResults };
  let   resultsChanged = false;
  let   finishedEvent  = null;
  const batch          = db.batch();

  // Oppdater ferdigspilte kamper
  for (const fixture of finishedFixtures) {
    const homeNor = toNor(fixture.teams?.home?.name);
    const awayNor = toNor(fixture.teams?.away?.name);
    let matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${fixture.teams?.home?.name}_${fixture.teams?.away?.name}`];
    // Fallback: slå opp via homeTeam/awayTeam satt manuelt i results (r16+)
    if (!matchId) {
      matchId = Object.entries(currentResults).find(([, r]) =>
        r.homeTeam === homeNor && r.awayTeam === awayNor
      )?.[0] || null;
    }
    if (!matchId) continue;
    const result = buildMatchResult(fixture);
    if (!result) continue;
    const existing = currentResults[matchId];
    const isNew = !existing || existing.home !== result.home || existing.away !== result.away || existing.status !== result.status;
    if (isNew) {
      updatedResults[matchId] = result;
      resultsChanged = true;
      // Trigger tabellreferat når kamp er ferdig (FT) og ikke allerede trigget
      const justFinished = FINISHED_STATUSES.has(result.status) && (!existing || !FINISHED_STATUSES.has(existing.status));
      if (justFinished) {
        // Tabellreferat (lagres i 'summaries', ikke i chat) skal fortsatt postes
        // automatisk når en kamp avsluttes. Det er KUN auto-kommentarer på mål
        // (handleGoalEvent, i selve chat-loggen) som skal være deaktivert –
        // bot-kommentarer i chat skal kun trigges av @navn/@funfact.
        handleMatchFinished(matchId, homeNor, awayNor, result.home, result.away, { ...updatedResults, [matchId]: result })
          .catch(e => console.error('handleMatchFinished feil:', e.message));
        // Lagre finished-event – sendes til klienten etter live-loop
        const shortH = NOR_TO_SHORT[homeNor] || homeNor.slice(0,3).toUpperCase();
        const shortA = NOR_TO_SHORT[awayNor] || awayNor.slice(0,3).toUpperCase();
        finishedEvent = {
          type: 'finished',
          text: `Slutt! ${shortH} ${result.home}–${result.away} ${shortA}`,
          shortHome: shortH, shortAway: shortA,
          homeGoals: result.home, awayGoals: result.away,
          ts: Date.now(),
        };
      }
    }

    // Krediter mål/kort for kamper som ble ferdigspilt UTEN at vi fanget dem
    // mens de var live. Hopp over hvis kampen allerede er i currentResults med
    // isFinished=true – da er mål/kort allerede kreditert fra live-løypa.
    const alreadyProcessed = currentResults[matchId]?.isFinished === true;
    if (matchId && !alreadyProcessed) {
      const fixtureId = fixture.fixture?.id;
      const finEvents = fixtureId ? await getFixtureEvents(fixtureId) : [];
      const goalsDedupRef  = db.collection('config').doc('creditedGoals');
      const statsCacheRef2 = db.collection('config').doc('statsCache');
      for (const ev of finEvents.filter(e => e.type === 'Goal')) {
        const playerName = ev.player?.name;
        const isOwnGoal  = ev.detail === 'Own Goal';
        if (!playerName || isOwnGoal) continue;
        const evTeamApi   = ev.team?.name;
        const homeTeamApi = fixture.teams?.home?.name;
        const scorerTeam  = evTeamApi === homeTeamApi ? homeNor : awayNor;
        const goalDedupKey = `${matchId}_${ev.time?.elapsed}_${playerName}`;
        let alreadyCredited = false;
        await db.runTransaction(async tx => {
          const snap = await tx.get(goalsDedupRef);
          const data = snap.exists ? snap.data() : {};
          const credited = data.keys || [];
          if (credited.includes(goalDedupKey)) { alreadyCredited = true; return; }
          tx.set(goalsDedupRef, { keys: [...credited, goalDedupKey] });
        });
        if (alreadyCredited) continue;
        await db.runTransaction(async tx => {
          const snap = await tx.get(statsCacheRef2);
          const data = snap.exists ? snap.data() : {};
          const scorers = data.scorers || [];
          const idx = scorers.findIndex(s => s.name === playerName);
          if (idx >= 0) {
            scorers[idx] = { ...scorers[idx], team: scorerTeam, goals: (scorers[idx].goals || 0) + 1 };
          } else {
            scorers.push({ name: playerName, team: scorerTeam, goals: 1 });
          }
          scorers.sort((a, b) => b.goals - a.goals);
          tx.set(statsCacheRef2, { ...data, scorers, updatedAt: Date.now() });
        });
        console.log(`Toppscorer kreditert (backfill, ferdigspilt kamp): ${playerName} (${scorerTeam})`);
      }

      // Samme backfill-prinsipp for gule/røde kort
      const cardsDedupRef = db.collection('config').doc('creditedCards');
      const cardsRef2      = db.collection('config').doc('cards');
      for (const ev of finEvents.filter(e => e.type === 'Card')) {
        const cardPlayer = ev.player?.name;
        if (!cardPlayer) continue;
        const isYellow = ev.detail?.includes('Yellow');
        const cardTeamApi = ev.team?.name;
        const cardTeamNor = toNor(cardTeamApi) || cardTeamApi;
        const cardDedupKey = `${matchId}_${ev.time?.elapsed}_${cardPlayer}_${ev.detail}`;
        let alreadyCredited = false;
        await db.runTransaction(async tx => {
          const snap = await tx.get(cardsDedupRef);
          const data = snap.exists ? snap.data() : {};
          const credited = data.keys || [];
          if (credited.includes(cardDedupKey)) { alreadyCredited = true; return; }
          tx.set(cardsDedupRef, { keys: [...credited, cardDedupKey] });
        });
        if (alreadyCredited) continue;
        await db.runTransaction(async tx => {
          const snap = await tx.get(cardsRef2);
          const data = snap.exists ? snap.data() : {};
          const yKey = `_y_${cardTeamNor}`;
          const rKey = `_r_${cardTeamNor}`;
          const newY = (data[yKey] || 0) + (isYellow ? 1 : 0);
          const newR = (data[rKey] || 0) + (isYellow ? 0 : 1);
          tx.set(cardsRef2, { ...data, [yKey]: newY, [rKey]: newR, [cardTeamNor]: newY + newR * 3 });
        });
        console.log(`Kort kreditert (backfill, ferdigspilt kamp): ${isYellow ? 'Gult' : 'Rødt'} til ${cardTeamNor} (${cardPlayer})`);
      }
    }
  }

  // Live-kamper: oppdater score + sjekk nye mål
  let cardEventThisPoll = null;
  const newPrevGoals = { ...prevGoals };
  const newPrevCards = { ...prevCards };

  if (liveFixtures.length > 0) {
    for (const fixture of liveFixtures) {
      const homeNor = toNor(fixture.teams?.home?.name);
      const awayNor = toNor(fixture.teams?.away?.name);
      const matchId = lookup[`${homeNor}_${awayNor}`] || lookup[`${fixture.teams?.home?.name}_${fixture.teams?.away?.name}`];

      if (matchId) {
        const result = buildMatchResult(fixture);
        if (result) { updatedResults[matchId] = result; resultsChanged = true; }
      }

      // Hent hendelser separat for denne kampen
      const fixtureId = fixture.fixture?.id;
      const events = fixtureId ? await getFixtureEvents(fixtureId) : [];
      fixture.events = events; // legg på fixture-objektet for buildLiveEvent

      // Krediter ALLE måltilfeller for denne kampen siden sist (ikke bare det
      // siste), slik at ingen mål "forsvinner" fra toppscorerlisten hvis flere
      // mål skjer mellom to pollinger (f.eks. to mål i samme 20-sekunders vindu).
      // Dedup skjer per unikt mål (kamp+minutt+spiller), uavhengig av live-banneret.
      if (matchId) {
        const goalEvents = events.filter(e => e.type === 'Goal');
        if (goalEvents.length) {
          const goalsDedupRef = db.collection('config').doc('creditedGoals');
          const statsCacheRef = db.collection('config').doc('statsCache');
          for (const ev of goalEvents) {
            const playerName = ev.player?.name;
            const isOwnGoal = ev.detail === 'Own Goal';
            if (!playerName || isOwnGoal) continue; // selvmål teller ikke som scoring
            const evTeamApi = ev.team?.name;
            const homeTeamApi = fixture.teams?.home?.name;
            const scorerTeam = evTeamApi === homeTeamApi ? homeNor : awayNor;
            const goalDedupKey = `${matchId}_${ev.time?.elapsed}_${playerName}`;
            let alreadyCredited = false;
            await db.runTransaction(async tx => {
              const snap = await tx.get(goalsDedupRef);
              const data = snap.exists ? snap.data() : {};
              const credited = data.keys || [];
              if (credited.includes(goalDedupKey)) { alreadyCredited = true; return; }
              tx.set(goalsDedupRef, { keys: [...credited, goalDedupKey] });
            });
            if (alreadyCredited) continue;
            await db.runTransaction(async tx => {
              const snap = await tx.get(statsCacheRef);
              const data = snap.exists ? snap.data() : {};
              const scorers = data.scorers || [];
              const idx = scorers.findIndex(s => s.name === playerName);
              if (idx >= 0) {
                scorers[idx] = { ...scorers[idx], team: scorerTeam, goals: (scorers[idx].goals || 0) + 1 };
              } else {
                scorers.push({ name: playerName, team: scorerTeam, goals: 1 });
              }
              scorers.sort((a, b) => b.goals - a.goals);
              tx.set(statsCacheRef, { ...data, scorers, updatedAt: Date.now() });
            });
            console.log(`Toppscorer kreditert: ${playerName} (${scorerTeam})`);
          }
        }
      }

      // Sjekk om det er scoret et nytt mål siden forrige poll (kun for live-banner/UI)
      const currentGoalKey = `${homeNor}_${awayNor}_${fixture.goals?.home}_${fixture.goals?.away}`;
      const prevGoalKey    = prevGoals[`${homeNor}_${awayNor}`];

      if (prevGoalKey && prevGoalKey !== currentGoalKey) {
        // Nytt mål – bruk transaksjon for å unngå duplikat på tvers av instanser
        const teamKey = `${homeNor}_${awayNor}`;
        let isFirstToFire = false;
        await db.runTransaction(async tx => {
          const snap = await tx.get(prevGoalsRef);
          const data = snap.exists ? snap.data() : {};
          if (data[teamKey] !== currentGoalKey) {
            tx.set(prevGoalsRef, { ...data, [teamKey]: currentGoalKey });
            isFirstToFire = true;
          }
        });
        newPrevGoals[teamKey] = currentGoalKey;
        if (isFirstToFire) {
          const liveEvent = buildLiveEvent(fixture);
          if (liveEvent?.type === 'goal' && matchId) {
            await liveRef.set({ ...liveEvent, ts: Date.now() });
            setTimeout(async () => {
              try { await liveRef.set({ type: null, ts: Date.now() }); } catch(e) {}
            }, 30000);
            // Bot-kommentarer skal KUN trigges av @navn/@funfact i chat, ikke automatisk
            // ved mål eller andre kamphendelser. handleGoalEvent() er derfor deaktivert her.
            // handleGoalEvent(matchId, liveEvent, prevGoalKey).catch(e =>
            //   console.error('handleGoalEvent feil:', e.message)
            // );
          }
        }
      } else {
        newPrevGoals[`${homeNor}_${awayNor}`] = currentGoalKey;
      }

      // Krediter ALLE kort for denne kampen siden sist (samme prinsipp som mål),
      // transaksjonssikkert og med per-kort dedup, så ingen kort mistes hvis
      // flere deles ut mellom to pollinger.
      const cardsDedupRefLive = db.collection('config').doc('creditedCards');
      const cardsRefLive      = db.collection('config').doc('cards');
      for (const ev of events.filter(e => e.type === 'Card')) {
        const cardPlayer = ev.player?.name;
        if (!cardPlayer) continue;
        const isYellow = ev.detail?.includes('Yellow');
        const cardTeamApi = ev.team?.name;
        const cardTeamNor = toNor(cardTeamApi) || cardTeamApi;
        const cardDedupKey = `${matchId}_${ev.time?.elapsed}_${cardPlayer}_${ev.detail}`;
        let alreadyCredited = false;
        await db.runTransaction(async tx => {
          const snap = await tx.get(cardsDedupRefLive);
          const data = snap.exists ? snap.data() : {};
          const credited = data.keys || [];
          if (credited.includes(cardDedupKey)) { alreadyCredited = true; return; }
          tx.set(cardsDedupRefLive, { keys: [...credited, cardDedupKey] });
        });
        if (alreadyCredited) continue;
        await db.runTransaction(async tx => {
          const snap = await tx.get(cardsRefLive);
          const data = snap.exists ? snap.data() : {};
          const yKey = `_y_${cardTeamNor}`;
          const rKey = `_r_${cardTeamNor}`;
          const newY = (data[yKey] || 0) + (isYellow ? 1 : 0);
          const newR = (data[rKey] || 0) + (isYellow ? 0 : 1);
          tx.set(cardsRefLive, { ...data, [yKey]: newY, [rKey]: newR, [cardTeamNor]: newY + newR * 3 });
        });
        console.log(`Kort kreditert: ${isYellow ? 'Gult' : 'Rødt'} til ${cardTeamNor} (${cardPlayer})`);
      }

      // Live-banner for kort (kun visuelt – siste kort, ufarlig om det er "bare" det nyeste)
      const lastCardEvent = [...events].reverse().find(e => e.type === 'Card');
      if (lastCardEvent) {
        const cardKey = `${homeNor}_${awayNor}_${lastCardEvent.player?.name}_${lastCardEvent.time?.elapsed}_${lastCardEvent.detail}`;
        const prevCardKey = newPrevCards[`${homeNor}_${awayNor}`];
        let cardIsNew = false;
        if (cardKey !== prevCardKey) {
          await db.runTransaction(async tx => {
            const snap = await tx.get(prevCardsRef);
            const data = snap.exists ? snap.data() : {};
            if (data[`${homeNor}_${awayNor}`] !== cardKey) {
              tx.set(prevCardsRef, { ...data, [`${homeNor}_${awayNor}`]: cardKey });
              cardIsNew = true;
            }
          });
          newPrevCards[`${homeNor}_${awayNor}`] = cardKey;
        }
        if (cardIsNew) {
          const ce = buildLiveEvent(fixture, true);
          if (ce?.type === 'card') {
            cardEventThisPoll = ce;
            setTimeout(async () => {
              try { await db.collection('config').doc('liveEvent').set({ type: null, ts: Date.now() }); } catch(e) {}
            }, 30000);
          }
        }
      }
    }

    // Skriv KUN type:null (live-score uten hendelse) til liveEvent ved vanlig poll
    // Nye mål/kort skrives separat via transaksjon og nullstilles etter 30 sek
    if (cardEventThisPoll || finishedEvent) {
      batch.set(liveRef, cardEventThisPoll || finishedEvent);
    } else {
      // Ikke overskriv en aktiv hendelse (mål/kort/slutt) som er nyere enn 30 sek
      const liveSnap = await liveRef.get();
      const existing = liveSnap.exists ? liveSnap.data() : {};
      const age = Date.now() - (existing.ts || 0);
      if (!existing.type || age > 30000) {
        batch.set(liveRef, { type: null, ts: Date.now() });
      }
    }
  } else {
    batch.set(liveRef, finishedEvent || { type: null, ts: Date.now() });
  }

  if (resultsChanged) batch.set(resultsRef, updatedResults, { merge: true });
  batch.set(prevGoalsRef, newPrevGoals);
  batch.set(prevCardsRef, newPrevCards);

  await batch.commit();
  console.log(`Poll ferdig. Live: ${liveFixtures.length}, Ferdig: ${finishedFixtures.length}`);
  // Returner allFinished=true hvis det ikke er noen live-kamper igjen
  // (men bare hvis vi faktisk har sett minst én live kamp tidligere, dvs. prevGoals har data)
  const hadLiveMatches = Object.keys(prevGoals).length > 0;
  return { allFinished: hadLiveMatches && liveFixtures.length === 0 };
}

// ── Scheduled function med intern loop ───────────────────────────────
exports.pollFootball = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Europe/Oslo',
    timeoutSeconds: 58,
    memory: '256MiB',
    secrets: ['FOOTBALL_API_KEY', 'ANTHROPIC_KEY'],
  },
  async () => {
    if (!isWithinMatchWindow()) {
      console.log('Ingen kamp innenfor kampvindu – hopper over polling');
      return;
    }
    const POLL_INTERVAL_MS  = 20000;
    const FUNCTION_DURATION = 50000;
    const start = Date.now();
    let calls = 0;
    while (true) {
      // getRecentlyFinished kun hvert 5. poll (~100 sek) for å spare API-kvoter.
      // getActiveFixtures kjøres hver gang for rask mål-deteksjon (20 sek forsinkelse).
      const checkFinished = calls % 5 === 0;
      try { await pollAndUpdate(checkFinished); calls++; }
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
        const apiScorers = scorersData.response.slice(0, 50).map(e => ({
          name: e.player.name,
          team: API_TO_NOR[e.statistics?.[0]?.team?.name] || e.statistics?.[0]?.team?.name || '–',
          goals: e.statistics?.[0]?.goals?.total ?? 0,
        })).filter(s => s.goals > 0);
        // Full overwrite (ikke merge) – API-Football sin egen toppscorerliste er
        // alltid autoritativ og teller hver spiller nøyaktig én gang under ett
        // kanonisk navn. Live-krediteringen (mål/kort fortløpende) gir raskere
        // oppdateringer mellom disse 30-minutters kjøringene, men denne jobben
        // retter automatisk opp ev. drift/duplikater (f.eks. "E. Haaland" vs
        // "Erling Haaland", eller mål kreditert flere ganger) hver gang den kjører.
        apiScorers.sort((a, b) => b.goals - a.goals);
        await db.collection('config').doc('statsCache').set({ scorers: apiScorers, updatedAt: Date.now() }, { merge: true });
        console.log('Toppscorere oppdatert (full overwrite):', apiScorers.length);
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

      // Bruk spesifikk matchId fra request body hvis oppgitt
      let matchId, result;
      if (req.body?.matchId) {
        matchId = req.body.matchId;
        result = results[matchId];
        if (!result) { res.json({ ok: false, error: `Ingen resultat for kamp ${matchId}` }); return; }
      } else {
        // Finn siste kamp alfabetisk
        const matchEntries = Object.entries(results)
          .filter(([id, r]) => /^[A-Z]\d+$/.test(id) && r && typeof r.home === 'number' && typeof r.away === 'number')
          .sort(([a], [b]) => a.localeCompare(b));
        if (!matchEntries.length) { res.json({ ok: false, error: 'Ingen ferdigspilte kamper' }); return; }
        [matchId, result] = matchEntries[matchEntries.length - 1];
      }
      console.log('triggerSummary: generating for', matchId, result);
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
        const total = calcTotalScore(user, results);
        let fulltreff = 0;
        for (const [mid, act] of Object.entries(results)) {
          const tip = user.tips?.[mid];
          if (!tip || act?.home === undefined) continue;
          if (calcMatchPts(tip, act) >= 4) fulltreff++;
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
      // Ikke overskriv eksisterende botText
      const existingSum = await db.collection('summaries').doc(matchId).get();
      if (!existingSum.exists || !existingSum.data()?.botText) {
        await db.collection('summaries').doc(matchId).set({ botText:text, botId:expert.id, botName:expert.name, ts:FieldValue.serverTimestamp() }, { merge:true });
      }
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
      const scorers = scorersData.response.slice(0, 50).map(e => ({
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
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
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
  await db.collection('config').doc('fixtureLookup').set(lookup, { merge: true });
  res.json({ ok: true, entries: Object.keys(lookup).length });
});
