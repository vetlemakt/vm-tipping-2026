export const INVITE_CODE = 'VM2026';
export const ADMIN_CODE  = 'ADMIN2026';
export const FD_API_KEY  = 'YOUR_KEY_HERE'; // Replace with your football-data.org key

export const GROUPS = {
  A: ['Mexico',     'Sør-Afrika',  'Sør-Korea',    'Tsjekkia'],
  B: ['Canada',     'Bosnia-Herz', 'Qatar',        'Sveits'],
  C: ['Brasil',     'Marokko',     'Haiti',        'Skottland'],
  D: ['USA',        'Paraguay',    'Australia',    'Tyrkia'],
  E: ['Tyskland',   'Curacao',     'Elfenbenskysten','Ecuador'],
  F: ['Nederland',  'Japan',       'Sverige',      'Tunisia'],
  G: ['Belgia',     'Egypt',       'Iran',         'New Zealand'],
  H: ['Spania',     'Kapp Verde',  'Saudi-Arabia', 'Uruguay'],
  I: ['Frankrike',  'Senegal',     'Irak',         'Norge'],
  J: ['Argentina',  'Algerie',     'Østerrike',    'Jordan'],
  K: ['Portugal',   'Kongo DR',    'Usbekistan',   'Colombia'],
  L: ['England',    'Kroatia',     'Ghana',        'Panama'],
};

export const ALL_TEAMS = [...new Set(Object.values(GROUPS).flat())].sort();

// Match times in Norwegian time (CEST)
const GROUP_TIMES = [
  { date:'2026-06-11', time:'21:00' },
  { date:'2026-06-12', time:'00:00' },
  { date:'2026-06-13', time:'18:00' },
  { date:'2026-06-23', time:'21:00' },
  { date:'2026-06-24', time:'00:00' },
  { date:'2026-06-25', time:'21:00' },
];

export const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([g, t]) => [
  { id:`${g}1`, group:g, home:t[0], away:t[1], phase:'group', date:GROUP_TIMES[0].date, time:GROUP_TIMES[0].time },
  { id:`${g}2`, group:g, home:t[0], away:t[2], phase:'group', date:GROUP_TIMES[1].date, time:GROUP_TIMES[1].time },
  { id:`${g}3`, group:g, home:t[1], away:t[3], phase:'group', date:GROUP_TIMES[2].date, time:GROUP_TIMES[2].time },
  { id:`${g}4`, group:g, home:t[2], away:t[3], phase:'group', date:GROUP_TIMES[3].date, time:GROUP_TIMES[3].time },
  { id:`${g}5`, group:g, home:t[0], away:t[3], phase:'group', date:GROUP_TIMES[4].date, time:GROUP_TIMES[4].time },
  { id:`${g}6`, group:g, home:t[1], away:t[2], phase:'group', date:GROUP_TIMES[5].date, time:GROUP_TIMES[5].time },
]);

export const KNOCKOUT_ROUNDS = [
  { phase:'r32',    label:'Sekstendelsfinalene (kamp 73–88)', count:16, dates:['2026-06-28','2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03'] },
  { phase:'r16',    label:'Åttendedelsfinalene (kamp 89–96)', count:8,  dates:['2026-07-04','2026-07-05','2026-07-06','2026-07-07'] },
  { phase:'qf',     label:'Kvartfinalene (kamp 97–100)',       count:4,  dates:['2026-07-09','2026-07-10','2026-07-11','2026-07-12'] },
  { phase:'sf',     label:'Semifinalene (kamp 101–102)',       count:2,  dates:['2026-07-14','2026-07-15'] },
  { phase:'bronze', label:'Bronsefinalen (kamp 103)',          count:1,  dates:['2026-07-18'] },
  { phase:'final',  label:'Gullfinalen (kamp 104)',            count:1,  dates:['2026-07-19'] },
];

// Knockout matches with proper match numbers, descriptions and Norwegian kickoff times
export const KNOCKOUT_MATCHES = [
  // Sekstendelsfinalene - kamp 73-88
  { id:'r32_1',  phase:'r32',    matchNum:73,  home:'Vinner B',     away:'Toer A',        date:'2026-06-28', time:'21:00' },
  { id:'r32_2',  phase:'r32',    matchNum:74,  home:'Vinner E',     away:'3er A/B/C/D/F', date:'2026-06-29', time:'21:00' },
  { id:'r32_3',  phase:'r32',    matchNum:75,  home:'Vinner F',     away:'Toer C',        date:'2026-06-29', time:'03:00' },
  { id:'r32_4',  phase:'r32',    matchNum:76,  home:'Vinner C',     away:'Toer F',        date:'2026-06-29', time:'19:00' },
  { id:'r32_5',  phase:'r32',    matchNum:77,  home:'Vinner I',     away:'3er C/D/F/G/H', date:'2026-06-30', time:'23:00' },
  { id:'r32_6',  phase:'r32',    matchNum:78,  home:'Toer E',       away:'Toer I',        date:'2026-06-30', time:'19:00' },
  { id:'r32_7',  phase:'r32',    matchNum:79,  home:'Vinner A',     away:'3er C/E/F/H/I', date:'2026-07-01', time:'03:00' },
  { id:'r32_8',  phase:'r32',    matchNum:80,  home:'Vinner L',     away:'3er E/H/I/J/K', date:'2026-07-01', time:'18:00' },
  { id:'r32_9',  phase:'r32',    matchNum:81,  home:'Vinner D',     away:'3er B/E/F/I/J', date:'2026-07-01', time:'02:00' },
  { id:'r32_10', phase:'r32',    matchNum:82,  home:'Vinner G',     away:'3er A/E/H/I/J', date:'2026-07-01', time:'22:00' },
  { id:'r32_11', phase:'r32',    matchNum:83,  home:'Toer K',       away:'Toer L',        date:'2026-07-02', time:'01:00' },
  { id:'r32_12', phase:'r32',    matchNum:84,  home:'Vinner H',     away:'Toer J',        date:'2026-07-02', time:'21:00' },
  { id:'r32_13', phase:'r32',    matchNum:85,  home:'Vinner B',     away:'3er E/F/G/I/J', date:'2026-07-03', time:'02:00' },
  { id:'r32_14', phase:'r32',    matchNum:86,  home:'Vinner J',     away:'Toer H',        date:'2026-07-03', time:'00:00' },
  { id:'r32_15', phase:'r32',    matchNum:87,  home:'Vinner K',     away:'3er D/E/I/J/L', date:'2026-07-03', time:'03:30' },
  { id:'r32_16', phase:'r32',    matchNum:88,  home:'Toer D',       away:'Toer G',        date:'2026-07-04', time:'21:00' },
  // Åttendedelsfinalene - kamp 89-96
  { id:'r16_1',  phase:'r16',    matchNum:89,  home:'Vinner kamp 74', away:'Vinner kamp 77', date:'2026-07-05', time:'22:00' },
  { id:'r16_2',  phase:'r16',    matchNum:90,  home:'Vinner kamp 73', away:'Vinner kamp 75', date:'2026-07-05', time:'19:00' },
  { id:'r16_3',  phase:'r16',    matchNum:91,  home:'Vinner kamp 76', away:'Vinner kamp 78', date:'2026-07-06', time:'22:00' },
  { id:'r16_4',  phase:'r16',    matchNum:92,  home:'Vinner kamp 79', away:'Vinner kamp 80', date:'2026-07-07', time:'02:00' },
  { id:'r16_5',  phase:'r16',    matchNum:93,  home:'Vinner kamp 83', away:'Vinner kamp 84', date:'2026-07-06', time:'21:00' },
  { id:'r16_6',  phase:'r16',    matchNum:94,  home:'Vinner kamp 81', away:'Vinner kamp 82', date:'2026-07-07', time:'22:00' },
  { id:'r16_7',  phase:'r16',    matchNum:95,  home:'Vinner kamp 86', away:'Vinner kamp 88', date:'2026-07-08', time:'21:00' },
  { id:'r16_8',  phase:'r16',    matchNum:96,  home:'Vinner kamp 85', away:'Vinner kamp 87', date:'2026-07-08', time:'01:00' },
  // Kvartfinalene - kamp 97-100
  { id:'qf_1',   phase:'qf',     matchNum:97,  home:'Vinner kamp 89', away:'Vinner kamp 90', date:'2026-07-10', time:'22:00' },
  { id:'qf_2',   phase:'qf',     matchNum:98,  home:'Vinner kamp 93', away:'Vinner kamp 94', date:'2026-07-11', time:'21:00' },
  { id:'qf_3',   phase:'qf',     matchNum:99,  home:'Vinner kamp 91', away:'Vinner kamp 92', date:'2026-07-12', time:'22:00' },
  { id:'qf_4',   phase:'qf',     matchNum:100, home:'Vinner kamp 95', away:'Vinner kamp 96', date:'2026-07-13', time:'03:00' },
  // Semifinalene - kamp 101-102
  { id:'sf_1',   phase:'sf',     matchNum:101, home:'Vinner kamp 97', away:'Vinner kamp 98',  date:'2026-07-15', time:'02:00' },
  { id:'sf_2',   phase:'sf',     matchNum:102, home:'Vinner kamp 99', away:'Vinner kamp 100', date:'2026-07-16', time:'02:00' },
  // Bronsefinalen
  { id:'bronze', phase:'bronze', matchNum:103, home:'Taper kamp 101', away:'Taper kamp 102',  date:'2026-07-19', time:'21:00' },
  // Gullfinalen
  { id:'final',  phase:'final',  matchNum:104, home:'Vinner kamp 101', away:'Vinner kamp 102', date:'2026-07-20', time:'02:00' },
];

export const PHASE_OPTIONS = [
  { value:'pre',         label:'🕐 Før turnering – åpent for alle tips' },
  { value:'group_lock',  label:'🔒 Gruppespill startet – stengt' },
  { value:'group_done',  label:'✅ Gruppespill ferdig – endre sluttspill' },
  { value:'r32_lock',    label:'🔒 16-delsfinaler startet – stengt' },
  { value:'r32_done',    label:'✅ 16-delsfinaler ferdig' },
  { value:'r16_lock',    label:'🔒 8-delsfinaler startet – stengt' },
  { value:'r16_done',    label:'✅ 8-delsfinaler ferdig' },
  { value:'qf_lock',     label:'🔒 Kvartfinaler startet – stengt' },
  { value:'qf_done',     label:'✅ Kvartfinaler ferdig' },
  { value:'sf_lock',     label:'🔒 Semifinaler startet – stengt' },
  { value:'sf_done',     label:'✅ Semifinaler ferdig' },
  { value:'bronze_lock', label:'🔒 Finaler startet – stengt' },
  { value:'finished',    label:'🏆 Turnering avsluttet' },
];

export const OPEN_PHASES = new Set(['pre','group_done','r32_done','r16_done','qf_done','sf_done']);

export const FLAGS = {
  'Argentina':'🇦🇷','Algerie':'🇩🇿','Australia':'🇦🇺','Belgia':'🇧🇪',
  'Bolivia':'🇧🇴','Bosnia-Herz':'🇧🇦','Brasil':'🇧🇷','Canada':'🇨🇦',
  'Chile':'🇨🇱','Colombia':'🇨🇴','Costa Rica':'🇨🇷','Curacao':'🇨🇼',
  'Ecuador':'🇪🇨','Elfenbenskysten':'🇨🇮','Egypt':'🇪🇬','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Frankrike':'🇫🇷','Tyskland':'🇩🇪','Ghana':'🇬🇭','Haiti':'🇭🇹',
  'Honduras':'🇭🇳','Iran':'🇮🇷','Irak':'🇮🇶','Jamaica':'🇯🇲',
  'Japan':'🇯🇵','Jordan':'🇯🇴','Kamerun':'🇨🇲','Kapp Verde':'🇨🇻',
  'Kongo DR':'🇨🇩','Kroatia':'🇭🇷','Marokko':'🇲🇦','Mexico':'🇲🇽',
  'Nederland':'🇳🇱','New Zealand':'🇳🇿','Norge':'🇳🇴','Panama':'🇵🇦',
  'Paraguay':'🇵🇾','Peru':'🇵🇪','Portugal':'🇵🇹','Qatar':'🇶🇦',
  'Saudi-Arabia':'🇸🇦','Senegal':'🇸🇳','Skottland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Spania':'🇪🇸',
  'Sveits':'🇨🇭','Sverige':'🇸🇪','Sør-Afrika':'🇿🇦','Sør-Korea':'🇰🇷',
  'Tunisia':'🇹🇳','Tyrkia':'🇹🇷','Tsjekkia':'🇨🇿','USA':'🇺🇸',
  'Uruguay':'🇺🇾','Usbekistan':'🇺🇿',
};

export const WS_MSGS = {
  pre:         { label:'🟢 Åpent – lever dine tips!',            color:'#052e16' },
  group_lock:  { label:'🔴 Stengt – gruppespillet pågår',        color:'#450a0a' },
  group_done:  { label:'🟢 Åpent – endre sluttspill-tips!',      color:'#052e16' },
  r32_lock:    { label:'🔴 Stengt – sekstendelsfinalene pågår',  color:'#450a0a' },
  r32_done:    { label:'🟢 Åpent – oppdater neste runde!',       color:'#052e16' },
  r16_lock:    { label:'🔴 Stengt – åttendedelsfinalene pågår',  color:'#450a0a' },
  r16_done:    { label:'🟢 Åpent – oppdater neste runde!',       color:'#052e16' },
  qf_lock:     { label:'🔴 Stengt – kvartfinalene pågår',        color:'#450a0a' },
  qf_done:     { label:'🟢 Åpent – oppdater semifinale-tips!',   color:'#052e16' },
  sf_lock:     { label:'🔴 Stengt – semifinalene pågår',         color:'#450a0a' },
  sf_done:     { label:'🟢 Åpent – lever finale-tips!',          color:'#052e16' },
  bronze_lock: { label:'🔴 Stengt – finalene pågår',             color:'#450a0a' },
  finished:    { label:'🏁 Turneringen er over!',                color:'#1c1f2e' },
};

export const SPEC_FIELDS = [
  { key:'champion',    label:'🥇 Verdensmester',   pts:25 },
  { key:'runner_up',   label:'🥈 Sølvvinner',       pts:15 },
  { key:'third',       label:'🥉 Bronsevinner',      pts:10 },
  { key:'topscorer',   label:'⚽ Toppscorer',         pts:20 },
  { key:'most_carded', label:'🟨 Mest kort – lag',   pts:10 },
];
