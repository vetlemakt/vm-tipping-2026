// VM Quiz – spillerdatabase
// Hvert objekt: id, name, country, year, position, number (shirt), wrongAnswers
// wrongAnswers: [to fra samme lag/år, ett tullete/feil]

export const QUIZ_PLAYERS = [
  // ── 1982 ───────────────────────────────────────────────────────────
  { id:1,  name:'Zico',          country:'Brasil',     year:1982, pos:'MF', num:10,
    wrong:['Sócrates','Falcão','Pelé'] },
  { id:2,  name:'Paolo Rossi',   country:'Italia',     year:1982, pos:'FW', num:20,
    wrong:['Dino Zoff','Marco Tardelli','Diego Maradona'] },
  { id:3,  name:'Karl-Heinz Rummenigge', country:'Vest-Tyskland', year:1982, pos:'FW', num:9,
    wrong:['Paul Breitner','Klaus Fischer','Franz Beckenbauer'] },
  { id:4,  name:'Dino Zoff',     country:'Italia',     year:1982, pos:'GK', num:1,
    wrong:['Claudio Gentile','Gaetano Scirea','Enzo Bearzot'] },

  // ── 1986 ───────────────────────────────────────────────────────────
  { id:5,  name:'Diego Maradona',country:'Argentina',  year:1986, pos:'MF', num:10,
    wrong:['Jorge Valdano','Sergio Batista','Pelé'] },
  { id:6,  name:'Gary Lineker',  country:'England',    year:1986, pos:'FW', num:10,
    wrong:['Peter Shilton','Bryan Robson','Gordon Banks'] },
  { id:7,  name:'Michel Platini',country:'Frankrike',  year:1986, pos:'MF', num:10,
    wrong:['Jean Tigana','Alain Giresse','Zinedine Zidane'] },
  { id:8,  name:'Emilio Butragueño',country:'Spania',  year:1986, pos:'FW', num:7,
    wrong:['Michel','Víctor Muñoz','Fernando Torres'] },
  { id:9,  name:'Preben Elkjær', country:'Danmark',    year:1986, pos:'FW', num:11,
    wrong:['Michael Laudrup','Søren Lerby','Peter Schmeichel'] },
  { id:10, name:'Lothar Matthäus',country:'Vest-Tyskland',year:1986,pos:'MF',num:10,
    wrong:['Harald Schumacher','Andreas Brehme','Sepp Maier'] },

  // ── 1990 ───────────────────────────────────────────────────────────
  { id:11, name:'Salvatore Schillaci',country:'Italia',year:1990, pos:'FW', num:19,
    wrong:['Roberto Baggio','Paolo Maldini','Gianfranco Zola'] },
  { id:12, name:'Roger Milla',   country:'Kamerun',    year:1990, pos:'FW', num:9,
    wrong:['Thomas N\'Kono','Omam-Biyik','Samuel Eto\'o'] },
  { id:13, name:'Roberto Baggio',country:'Italia',     year:1990, pos:'MF', num:18,
    wrong:['Gianluca Vialli','Aldo Serena','Dino Zoff'] },
  { id:14, name:'Lothar Matthäus',country:'Vest-Tyskland',year:1990,pos:'MF',num:10,
    wrong:['Rudi Völler','Jürgen Klinsmann','Klaus Allofs'] },
  { id:15, name:'Peter Shilton', country:'England',    year:1990, pos:'GK', num:1,
    wrong:['Gary Lineker','Paul Gascoigne','David Seaman'] },
  { id:16, name:'Claudio Caniggia',country:'Argentina',year:1990, pos:'FW', num:9,
    wrong:['Diego Maradona','Gabriel Batistuta','Néstor Sensini'] },

  // ── 1994 ───────────────────────────────────────────────────────────
  { id:17, name:'Romário',       country:'Brasil',     year:1994, pos:'FW', num:11,
    wrong:['Bebeto','Mauro Silva','Cafu'] },
  { id:18, name:'Bebeto',        country:'Brasil',     year:1994, pos:'FW', num:9,
    wrong:['Romário','Mazinho','Taffarel'] },
  { id:19, name:'Roberto Baggio',country:'Italia',     year:1994, pos:'FW', num:10,
    wrong:['Demetrio Albertini','Luigi Apolloni','Fabrizio Ravanelli'] },
  { id:20, name:'Hristo Stoichkov',country:'Bulgaria', year:1994, pos:'FW', num:8,
    wrong:['Yordan Lechkov','Krasimir Balakov','Zlatko Yankov'] },
  { id:21, name:'Oleg Salenko',  country:'Russland',   year:1994, pos:'FW', num:11,
    wrong:['Victor Onopko','Igor Dobrovolski','Nikita Simonyan'] },
  { id:22, name:'Florin Răducioiu',country:'Romania',  year:1994, pos:'FW', num:9,
    wrong:['Gheorghe Hagi','Dan Petrescu','Ion Dumitrescu'] },
  { id:23, name:'Gheorghe Hagi', country:'Romania',    year:1994, pos:'MF', num:10,
    wrong:['Ioanel Mutu','Dan Petrescu','Lăcătuș'] },

  // ── 1998 ───────────────────────────────────────────────────────────
  { id:24, name:'Ronaldo',       country:'Brasil',     year:1998, pos:'FW', num:9,
    wrong:['Rivaldo','Roberto Carlos','Cafu'] },
  { id:25, name:'Zinedine Zidane',country:'Frankrike', year:1998, pos:'MF', num:10,
    wrong:['Thierry Henry','Lilian Thuram','Marcel Desailly'] },
  { id:26, name:'Davor Šuker',   country:'Kroatia',    year:1998, pos:'FW', num:9,
    wrong:['Zvonimir Boban','Robert Prosinečki','Slaven Bilić'] },
  { id:27, name:'Gabriel Batistuta',country:'Argentina',year:1998,pos:'FW',num:9,
    wrong:['Ariel Ortega','Diego Simeone','Hernán Crespo'] },
  { id:28, name:'Dennis Bergkamp',country:'Nederland', year:1998, pos:'FW', num:10,
    wrong:['Marc Overmars','Patrick Kluivert','Clarence Seedorf'] },
  { id:29, name:'Thierry Henry', country:'Frankrike',  year:1998, pos:'FW', num:12,
    wrong:['David Trezeguet','Emmanuel Petit','Youri Djorkaeff'] },

  // ── 2002 ───────────────────────────────────────────────────────────
  { id:30, name:'Ronaldo',       country:'Brasil',     year:2002, pos:'FW', num:9,
    wrong:['Ronaldinho','Rivaldo','Roberto Carlos'] },
  { id:31, name:'Rivaldo',       country:'Brasil',     year:2002, pos:'MF', num:10,
    wrong:['Ronaldo','Cafu','Edmílson'] },
  { id:32, name:'Oliver Kahn',   country:'Tyskland',   year:2002, pos:'GK', num:1,
    wrong:['Michael Ballack','Miroslav Klose','Carsten Jancker'] },
  { id:33, name:'Michael Ballack',country:'Tyskland',  year:2002, pos:'MF', num:13,
    wrong:['Oliver Kahn','Miroslav Klose','Jens Lehmann'] },
  { id:34, name:'Hong Myung-Bo', country:'Sør-Korea',  year:2002, pos:'DF', num:6,
    wrong:['Ahn Jung-Hwan','Park Ji-Sung','Hwang Sun-Hong'] },
  { id:35, name:'Rui Costa',     country:'Portugal',   year:2002, pos:'MF', num:10,
    wrong:['Luís Figo','Fernando Couto','João Pinto'] },

  // ── 2006 ───────────────────────────────────────────────────────────
  { id:36, name:'Miroslav Klose',country:'Tyskland',   year:2006, pos:'FW', num:11,
    wrong:['Lukas Podolski','Michael Ballack','Oliver Kahn'] },
  { id:37, name:'Zinedine Zidane',country:'Frankrike', year:2006, pos:'MF', num:10,
    wrong:['Thierry Henry','Patrick Vieira','Franck Ribéry'] },
  { id:38, name:'Ronaldinho',    country:'Brasil',     year:2006, pos:'MF', num:10,
    wrong:['Kaká','Adriano','Robinho'] },
  { id:39, name:'Francesco Totti',country:'Italia',    year:2006, pos:'FW', num:10,
    wrong:['Luca Toni','Gianluigi Buffon','Andrea Pirlo'] },
  { id:40, name:'Gianluigi Buffon',country:'Italia',   year:2006, pos:'GK', num:1,
    wrong:['Fabio Cannavaro','Alessandro Del Piero','Marco Materazzi'] },
  { id:41, name:'Cristiano Ronaldo',country:'Portugal',year:2006,pos:'FW',num:17,
    wrong:['Luís Figo','Deco','Nuno Gomes'] },
  { id:42, name:'Lukas Podolski',country:'Tyskland',   year:2006, pos:'FW', num:20,
    wrong:['Miroslav Klose','Torsten Frings','Per Mertesacker'] },

  // ── 2010 ───────────────────────────────────────────────────────────
  { id:43, name:'David Villa',   country:'Spania',     year:2010, pos:'FW', num:7,
    wrong:['Fernando Torres','Xavi','Andrés Iniesta'] },
  { id:44, name:'Andrés Iniesta',country:'Spania',     year:2010, pos:'MF', num:6,
    wrong:['Xavi','David Villa','Sergio Ramos'] },
  { id:45, name:'Diego Forlán',  country:'Uruguay',    year:2010, pos:'FW', num:10,
    wrong:['Luis Suárez','Edinson Cavani','Diego Lugano'] },
  { id:46, name:'Wesley Sneijder',country:'Nederland', year:2010, pos:'MF', num:10,
    wrong:['Arjen Robben','Robin van Persie','Rafael van der Vaart'] },
  { id:47, name:'Thomas Müller', country:'Tyskland',   year:2010, pos:'FW', num:13,
    wrong:['Miroslav Klose','Mesut Özil','Bastian Schweinsteiger'] },
  { id:48, name:'Asamoah Gyan',  country:'Ghana',      year:2010, pos:'FW', num:3,
    wrong:['Michael Essien','Kevin-Prince Boateng','Sulley Muntari'] },
  { id:49, name:'Giovanni van Bronckhorst',country:'Nederland',year:2010,pos:'DF',num:5,
    wrong:['Dirk Kuyt','Mark van Bommel','Nigel de Jong'] },

  // ── 2014 ───────────────────────────────────────────────────────────
  { id:50, name:'James Rodríguez',country:'Colombia',  year:2014, pos:'MF', num:10,
    wrong:['Radamel Falcao','Carlos Bacca','Camilo Zúñiga'] },
  { id:51, name:'Thomas Müller', country:'Tyskland',   year:2014, pos:'FW', num:13,
    wrong:['Miroslav Klose','Mario Götze','Toni Kroos'] },
  { id:52, name:'Mario Götze',   country:'Tyskland',   year:2014, pos:'MF', num:19,
    wrong:['Thomas Müller','Toni Kroos','André Schürrle'] },
  { id:53, name:'Arjen Robben',  country:'Nederland',  year:2014, pos:'FW', num:11,
    wrong:['Wesley Sneijder','Robin van Persie','Dirk Kuyt'] },
  { id:54, name:'Lionel Messi',  country:'Argentina',  year:2014, pos:'FW', num:10,
    wrong:['Gonzalo Higuaín','Sergio Agüero','Ángel Di María'] },
  { id:55, name:'Neymar',        country:'Brasil',     year:2014, pos:'FW', num:10,
    wrong:['Hulk','David Luiz','Oscar'] },
  { id:56, name:'Tim Howard',    country:'USA',        year:2014, pos:'GK', num:1,
    wrong:['Clint Dempsey','Michael Bradley','DaMarcus Beasley'] },
  { id:57, name:'Karim Benzema', country:'Frankrike',  year:2014, pos:'FW', num:10,
    wrong:['Olivier Giroud','Mathieu Valbuena','Moussa Sissoko'] },
  { id:58, name:'Sunil Chhetri', country:'Tanzania',   year:2014, pos:'FW', num:11,
    wrong:['Miroslav Klose','Thomas Müller','David Villa'] },  // tullete

  // ── 2018 ───────────────────────────────────────────────────────────
  { id:59, name:'Kylian Mbappé', country:'Frankrike',  year:2018, pos:'FW', num:10,
    wrong:['Antoine Griezmann','Paul Pogba','Raphaël Varane'] },
  { id:60, name:'Antoine Griezmann',country:'Frankrike',year:2018,pos:'FW',num:7,
    wrong:['Kylian Mbappé','Olivier Giroud','N\'Golo Kanté'] },
  { id:61, name:'Luka Modrić',   country:'Kroatia',    year:2018, pos:'MF', num:10,
    wrong:['Ivan Rakitić','Mario Mandžukić','Marcelo Brozović'] },
  { id:62, name:'Harry Kane',    country:'England',    year:2018, pos:'FW', num:9,
    wrong:['Raheem Sterling','Dele Alli','Kieran Trippier'] },
  { id:63, name:'Eden Hazard',   country:'Belgia',     year:2018, pos:'MF', num:10,
    wrong:['Romelu Lukaku','Kevin De Bruyne','Thibaut Courtois'] },
  { id:64, name:'Cristiano Ronaldo',country:'Portugal',year:2018,pos:'FW',num:7,
    wrong:['Bernardo Silva','João Moutinho','Pepe'] },
  { id:65, name:'Romelu Lukaku', country:'Belgia',     year:2018, pos:'FW', num:9,
    wrong:['Eden Hazard','Dries Mertens','Axel Witsel'] },
  { id:66, name:'Thibaut Courtois',country:'Belgia',   year:2018, pos:'GK', num:1,
    wrong:['Jan Vertonghen','Toby Alderweireld','Yannick Carrasco'] },
  { id:67, name:'Denis Cheryshev',country:'Russland',  year:2018, pos:'FW', num:6,
    wrong:['Fyodor Smolov','Alan Dzagoev','Igor Akinfeev'] },
  { id:68, name:'Ivan Perišić',  country:'Kroatia',    year:2018, pos:'MF', num:4,
    wrong:['Luka Modrić','Ivan Rakitić','Dejan Lovren'] },
  { id:69, name:'Hirving Lozano',country:'Mexico',     year:2018, pos:'FW', num:22,
    wrong:['Javier Hernández','Héctor Herrera','Carlos Vela'] },
  { id:70, name:'Mohamed Salah', country:'Egypt',      year:2018, pos:'FW', num:10,
    wrong:['Essam El-Hadary','Marwan Mohsen','Ahmed Fathy'] },

  // ── 2022 ───────────────────────────────────────────────────────────
  { id:71, name:'Lionel Messi',  country:'Argentina',  year:2022, pos:'FW', num:10,
    wrong:['Julián Álvarez','Rodrigo De Paul','Emiliano Martínez'] },
  { id:72, name:'Kylian Mbappé', country:'Frankrike',  year:2022, pos:'FW', num:10,
    wrong:['Olivier Giroud','Ousmane Dembélé','Antoine Griezmann'] },
  { id:73, name:'Julián Álvarez',country:'Argentina',  year:2022, pos:'FW', num:9,
    wrong:['Lautaro Martínez','Alexis Mac Allister','Ángel Di María'] },
  { id:74, name:'Achraf Hakimi', country:'Marokko',    year:2022, pos:'DF', num:2,
    wrong:['Youssef En-Nesyri','Hakim Ziyech','Sofiane Boufal'] },
  { id:75, name:'Luka Modrić',   country:'Kroatia',    year:2022, pos:'MF', num:10,
    wrong:['Andrej Kramarić','Ivan Perišić','Mateo Kovačić'] },
  { id:76, name:'Emi Martínez',  country:'Argentina',  year:2022, pos:'GK', num:23,
    wrong:['Franco Armani','Rodrigo De Paul','Leandro Paredes'] },
  { id:77, name:'Cody Gakpo',    country:'Nederland',  year:2022, pos:'FW', num:11,
    wrong:['Memphis Depay','Davy Klaassen','Denzel Dumfries'] },
  { id:78, name:'Ritchie de Laet',country:'Monaco',    year:2022, pos:'DF', num:99,
    wrong:['Kylian Mbappé','Lionel Messi','Cody Gakpo'] }, // tullete
  { id:79, name:'Olivier Giroud',country:'Frankrike',  year:2022, pos:'FW', num:9,
    wrong:['Kylian Mbappé','Marcus Thuram','Kingsley Coman'] },
  { id:80, name:'Hakim Ziyech',  country:'Marokko',    year:2022, pos:'MF', num:7,
    wrong:['Achraf Hakimi','Youssef En-Nesyri','Azzedine Ounahi'] },
  { id:81, name:'Goncalo Ramos', country:'Portugal',   year:2022, pos:'FW', num:9,
    wrong:['Cristiano Ronaldo','Bernardo Silva','Rafael Leão'] },
  { id:82, name:'Pedri',         country:'Spania',     year:2022, pos:'MF', num:16,
    wrong:['Gavi','Álvaro Morata','Ferran Torres'] },
  { id:83, name:'Bukayo Saka',   country:'England',    year:2022, pos:'FW', num:17,
    wrong:['Harry Kane','Phil Foden','Jude Bellingham'] },
  { id:84, name:'Jude Bellingham',country:'England',   year:2022, pos:'MF', num:22,
    wrong:['Bukayo Saka','Raheem Sterling','Marcus Rashford'] },
  { id:85, name:'Gavi',          country:'Spania',     year:2022, pos:'MF', num:6,
    wrong:['Pedri','Dani Olmo','Sergio Busquets'] },
  { id:86, name:'Enzo Fernández',country:'Argentina',  year:2022, pos:'MF', num:24,
    wrong:['Alexis Mac Allister','Rodrigo De Paul','Leandro Paredes'] },
  { id:87, name:'Sofyan Amrabat',country:'Marokko',    year:2022, pos:'MF', num:4,
    wrong:['Hakim Ziyech','Selim Amallah','Noussair Mazraoui'] },
  { id:88, name:'Richarlison',   country:'Brasil',     year:2022, pos:'FW', num:9,
    wrong:['Vinícius Jr.','Neymar','Rodrygo'] },
  { id:89, name:'Vinícius Jr.',  country:'Brasil',     year:2022, pos:'FW', num:20,
    wrong:['Richarlison','Rodrygo','Lucas Paquetá'] },
  { id:90, name:'Ilkay Gündogan',country:'Tyskland',   year:2022, pos:'MF', num:21,
    wrong:['Thomas Müller','Kai Havertz','Serge Gnabry'] },

  // ── Ekstra klassikere ──────────────────────────────────────────────
  { id:91, name:'Peter Shilton', country:'England',    year:1986, pos:'GK', num:1,
    wrong:['Gary Lineker','Bryan Robson','Terry Butcher'] },
  { id:92, name:'Rudi Völler',   country:'Vest-Tyskland',year:1986,pos:'FW',num:9,
    wrong:['Lothar Matthäus','Karl-Heinz Rummenigge','Bodo Illgner'] },
  { id:93, name:'Carlos Valderrama',country:'Colombia',year:1990,pos:'MF',num:10,
    wrong:['Freddy Rincón','René Higuita','Bernardo Redín'] },
  { id:94, name:'Toto Schillaci',country:'Italia',     year:1990, pos:'FW', num:19,
    wrong:['Roberto Baggio','Gianluca Vialli','Gianfranco Zola'] },
  { id:95, name:'Jorge Campos',  country:'Mexico',     year:1994, pos:'GK', num:1,
    wrong:['Hugo Sánchez','Luis García','Alberto García Aspe'] },
  { id:96, name:'Ronaldo',       country:'Brasil',     year:2006, pos:'FW', num:9,
    wrong:['Ronaldinho','Kaká','Adriano'] },
  { id:97, name:'Francesco Totti',country:'Italia',    year:2006, pos:'FW', num:10,
    wrong:['Andrea Pirlo','Gianluigi Buffon','Alessandro Nesta'] },
  { id:98, name:'Robinho',       country:'Brasil',     year:2010, pos:'FW', num:11,
    wrong:['Kaká','Maicon','Julio César'] },
  { id:99, name:'Robin van Persie',country:'Nederland',year:2014,pos:'FW',num:9,
    wrong:['Arjen Robben','Wesley Sneijder','Memphis Depay'] },
  { id:100,name:'Andrés Iniesta',country:'Spania',     year:2014, pos:'MF', num:6,
    wrong:['Xavi','David Silva','Gerard Piqué'] },
  { id:101,name:'Paul Pogba',    country:'Frankrike',  year:2018, pos:'MF', num:6,
    wrong:['N\'Golo Kanté','Blaise Matuidi','Moussa Sissoko'] },
  { id:102,name:'Kaká',          country:'Brasil',     year:2010, pos:'MF', num:10,
    wrong:['Robinho','Maicon','Gilberto Silva'] },
  { id:103,name:'Iker Casillas', country:'Spania',     year:2010, pos:'GK', num:1,
    wrong:['Xavi','Carles Puyol','Joan Capdevila'] },
  { id:104,name:'Xavi',          country:'Spania',     year:2010, pos:'MF', num:8,
    wrong:['Andrés Iniesta','Fernando Torres','Sergio Ramos'] },
  { id:105,name:'Per Mertesacker',country:'Tyskland',  year:2010, pos:'DF', num:17,
    wrong:['Bastian Schweinsteiger','Mesut Özil','Sami Khedira'] },
];

// Get today's quiz player (rotates daily at 06:00)
export function getTodaysPlayer() {
  const now = new Date();
  const base = new Date('2026-06-11T06:00:00');
  let dayIndex = Math.floor((now - base) / (1000 * 60 * 60 * 24));
  if (now.getHours() < 6) dayIndex--; // before 06:00 = yesterday's quiz
  const idx = ((dayIndex % QUIZ_PLAYERS.length) + QUIZ_PLAYERS.length) % QUIZ_PLAYERS.length;
  return QUIZ_PLAYERS[idx];
}

// Shuffle array
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
