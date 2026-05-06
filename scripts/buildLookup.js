const GROUP_MATCHES = [
  { id:'A1', home:'Mexico',    away:'Sør-Afrika' },
  { id:'A2', home:'Sør-Korea', away:'Tsjekkia' },
  { id:'A3', home:'Tsjekkia',  away:'Sør-Afrika' },
  { id:'A4', home:'Mexico',    away:'Sør-Korea' },
  { id:'A5', home:'Tsjekkia',  away:'Mexico' },
  { id:'A6', home:'Sør-Afrika',away:'Sør-Korea' },
  { id:'B1', home:'Canada',    away:'Bosnia-Herz' },
  { id:'B2', home:'Qatar',     away:'Sveits' },
  { id:'B3', home:'Sveits',    away:'Bosnia-Herz' },
  { id:'B4', home:'Canada',    away:'Qatar' },
  { id:'B5', home:'Sveits',    away:'Canada' },
  { id:'B6', home:'Bosnia-Herz',away:'Qatar' },
  { id:'C1', home:'Brasil',    away:'Marokko' },
  { id:'C2', home:'Haiti',     away:'Skottland' },
  { id:'C3', home:'Skottland', away:'Marokko' },
  { id:'C4', home:'Brasil',    away:'Haiti' },
  { id:'C5', home:'Skottland', away:'Brasil' },
  { id:'C6', home:'Marokko',   away:'Haiti' },
  { id:'D1', home:'USA',       away:'Paraguay' },
  { id:'D2', home:'Australia', away:'Tyrkia' },
  { id:'D3', home:'USA',       away:'Australia' },
  { id:'D4', home:'Tyrkia',    away:'Paraguay' },
  { id:'D5', home:'Tyrkia',    away:'USA' },
  { id:'D6', home:'Paraguay',  away:'Australia' },
  { id:'E1', home:'Tyskland',  away:'Curacao' },
  { id:'E2', home:'Elfenbenskysten',away:'Ecuador' },
  { id:'E3', home:'Tyskland',  away:'Elfenbenskysten' },
  { id:'E4', home:'Ecuador',   away:'Curacao' },
  { id:'E5', home:'Curacao',   away:'Elfenbenskysten' },
  { id:'E6', home:'Ecuador',   away:'Tyskland' },
  { id:'F1', home:'Nederland', away:'Japan' },
  { id:'F2', home:'Sverige',   away:'Tunisia' },
  { id:'F3', home:'Nederland', away:'Sverige' },
  { id:'F4', home:'Tunisia',   away:'Japan' },
  { id:'F5', home:'Japan',     away:'Sverige' },
  { id:'F6', home:'Tunisia',   away:'Nederland' },
  { id:'G1', home:'Belgia',    away:'Egypt' },
  { id:'G2', home:'Iran',      away:'New Zealand' },
  { id:'G3', home:'Belgia',    away:'Iran' },
  { id:'G4', home:'New Zealand',away:'Egypt' },
  { id:'G5', home:'Egypt',     away:'Iran' },
  { id:'G6', home:'New Zealand',away:'Belgia' },
  { id:'H1', home:'Spania',    away:'Kapp Verde' },
  { id:'H2', home:'Saudi-Arabia',away:'Uruguay' },
  { id:'H3', home:'Spania',    away:'Saudi-Arabia' },
  { id:'H4', home:'Uruguay',   away:'Kapp Verde' },
  { id:'H5', home:'Uruguay',   away:'Spania' },
  { id:'H6', home:'Kapp Verde',away:'Saudi-Arabia' },
  { id:'I1', home:'Frankrike', away:'Senegal' },
  { id:'I2', home:'Irak',      away:'Norge' },
  { id:'I3', home:'Frankrike', away:'Irak' },
  { id:'I4', home:'Norge',     away:'Senegal' },
  { id:'I5', home:'Norge',     away:'Frankrike' },
  { id:'I6', home:'Senegal',   away:'Irak' },
  { id:'J1', home:'Argentina', away:'Algerie' },
  { id:'J2', home:'Østerrike', away:'Jordan' },
  { id:'J3', home:'Argentina', away:'Østerrike' },
  { id:'J4', home:'Jordan',    away:'Algerie' },
  { id:'J5', home:'Jordan',    away:'Argentina' },
  { id:'J6', home:'Algerie',   away:'Østerrike' },
  { id:'K1', home:'Portugal',  away:'Kongo DR' },
  { id:'K2', home:'Usbekistan',away:'Colombia' },
  { id:'K3', home:'Portugal',  away:'Usbekistan' },
  { id:'K4', home:'Colombia',  away:'Kongo DR' },
  { id:'K5', home:'Colombia',  away:'Portugal' },
  { id:'K6', home:'Kongo DR',  away:'Usbekistan' },
  { id:'L1', home:'England',   away:'Kroatia' },
  { id:'L2', home:'Ghana',     away:'Panama' },
  { id:'L3', home:'England',   away:'Ghana' },
  { id:'L4', home:'Panama',    away:'Kroatia' },
  { id:'L5', home:'Panama',    away:'England' },
  { id:'L6', home:'Kroatia',   away:'Ghana' },
];

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

const FUNCTION_URL = 'https://us-central1-vm-tipping-2026.cloudfunctions.net/buildFixtureLookup';

async function main() {
  const matches = GROUP_MATCHES.map(m => ({ id: m.id, home: m.home, away: m.away }));
  console.log(`Sender ${matches.length} kamper...`);

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matches }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log(`✅ Ferdig! ${data.entries} oppføringer lagret i Firestore.`);
  } else {
    console.error('Feil:', data);
  }
}

main().catch(console.error);