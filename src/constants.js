export const INVITE_CODE = 'VM2026';
export const ADMIN_CODE  = 'ADMIN2026';
export const FD_API_KEY  = '6ce1f4deb4bd4cf9b0657606a267a212'; // 

export const GROUPS = {
  A: ['USA',       'Mexico',       'Canada',             'Panama'],
  B: ['Brasil',    'Argentina',    'Colombia',           'Ecuador'],
  C: ['Frankrike', 'Spania',       'England',            'Belgia'],
  D: ['Portugal',  'Nederland',    'Danmark',            'Polen'],
  E: ['Tyskland',  'Kroatia',      'Serbia',             'Sveits'],
  F: ['Japan',     'Sør-Korea',    'Australia',          'Iran'],
  G: ['Marokko',   'Senegal',      'Ghana',              'Tunisia'],
  H: ['Qatar',     'Saudi-Arabia', 'Uruguay',            'Kamerun'],
  I: ['Ukraina',   'Tyrkia',       'Romania',            'Slovakia'],
  J: ['Østerrike', 'Tsjekkia',     'Skottland',          'Albania'],
  K: ['Honduras',  'Costa Rica',   'Jamaica',            'Trinidad og Tobago'],
  L: ['Peru',      'Chile',        'Paraguay',           'Bolivia'],
};

export const ALL_TEAMS = [...new Set(Object.values(GROUPS).flat())].sort();

export const GROUP_MATCHES = Object.entries(GROUPS).flatMap(([g, t]) => [
  { id:`${g}1`, group:g, home:t[0], away:t[1], phase:'group', date:'2026-06-11' },
  { id:`${g}2`, group:g, home:t[0], away:t[2], phase:'group', date:'2026-06-12' },
  { id:`${g}3`, group:g, home:t[1], away:t[3], phase:'group', date:'2026-06-13' },
  { id:`${g}4`, group:g, home:t[2], away:t[3], phase:'group', date:'2026-06-23' },
  { id:`${g}5`, group:g, home:t[0], away:t[3], phase:'group', date:'2026-06-24' },
  { id:`${g}6`, group:g, home:t[1], away:t[2], phase:'group', date:'2026-06-25' },
]);

export const KNOCKOUT_ROUNDS = [
  { phase:'r32',    label:'Sekstendelsfinalene', count:16, dates:['2026-06-28','2026-07-01'] },
  { phase:'r16',    label:'Åttendedelsfinalene', count:8,  dates:['2026-07-04','2026-07-06'] },
  { phase:'qf',     label:'Kvartfinalene',        count:4,  dates:['2026-07-09','2026-07-10'] },
  { phase:'sf',     label:'Semifinalene',         count:2,  dates:['2026-07-14','2026-07-15'] },
  { phase:'bronze', label:'Bronsefinalen',        count:1,  dates:['2026-07-18'] },
  { phase:'final',  label:'Gullfinalen',          count:1,  dates:['2026-07-19'] },
];

export const KNOCKOUT_MATCHES = KNOCKOUT_ROUNDS.flatMap(({ phase, count, dates }) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${phase}_${i+1}`, phase,
    home: '?', away: '?',
    date: dates[Math.min(i, dates.length - 1)],
  }))
);

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
  'Brasil':'🇧🇷','Argentina':'🇦🇷','Frankrike':'🇫🇷','Spania':'🇪🇸',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Portugal':'🇵🇹','Nederland':'🇳🇱','Belgia':'🇧🇪',
  'Tyskland':'🇩🇪','Danmark':'🇩🇰','Uruguay':'🇺🇾','Mexico':'🇲🇽',
  'USA':'🇺🇸','Canada':'🇨🇦','Senegal':'🇸🇳','Ghana':'🇬🇭',
  'Marokko':'🇲🇦','Kamerun':'🇨🇲','Kroatia':'🇭🇷','Serbia':'🇷🇸',
  'Sveits':'🇨🇭','Polen':'🇵🇱','Japan':'🇯🇵','Sør-Korea':'🇰🇷',
  'Australia':'🇦🇺','Iran':'🇮🇷','Saudi-Arabia':'🇸🇦','Qatar':'🇶🇦',
  'Ecuador':'🇪🇨','Colombia':'🇨🇴','Tunisia':'🇹🇳','Costa Rica':'🇨🇷',
  'Panama':'🇵🇦','Honduras':'🇭🇳','Jamaica':'🇯🇲','Peru':'🇵🇪',
  'Chile':'🇨🇱','Paraguay':'🇵🇾','Bolivia':'🇧🇴','Ukraina':'🇺🇦',
  'Tyrkia':'🇹🇷','Romania':'🇷🇴','Slovakia':'🇸🇰','Østerrike':'🇦🇹',
  'Tsjekkia':'🇨🇿','Skottland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Albania':'🇦🇱',
  'Trinidad og Tobago':'🇹🇹',
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
  { key:'topscorer',   label:'⚽ Toppscorer – lag',  pts:20 },
  { key:'most_carded', label:'🟨 Mest kort – lag',   pts:10 },
];
