/* Commands checked against https://chatgames.pro/de/modguide on 22 November 2026. */
const ChatGamesCommands = (() => {
  const button = (command, label) => ({ command, label, type: 'button' });
  const choice = (command, label, values) => ({ command, label, type: 'choice', values });
  const number = (command, label, min, max, hint = '') => ({ command, label, type: 'number', min, max, hint });
  const text = (command, label, hint, optional = false) => ({ command, label, type: optional ? 'optionalText' : 'text', hint });
  const toggle = (command, label) => choice(command, label, ['on', 'off']);
  const timer = (label, min, max, zero = false) => ({ ...number('!timer', label, zero ? 0 : min, max, `${zero ? `0 oder ${min}` : min}–${max} Sekunden`), positiveMin: min });
  const mode = (values) => choice('!mode', 'Spielmodus', values);
  const rounds = (max, label = 'Runden') => number('!rounds', label, 1, max);
  const pause = [button('!pause', 'Pausieren'), button('!resume', 'Fortsetzen')];

  const games = [
    { id: 'hangman', label: 'Hangman', icon: '🔤', open: '!hangman', settings: [button('!vote', 'Abstimmungsmodus'), button('!lobby', 'Lobby-Modus'), timer('Zeit pro Zug / Abstimmung', 5, 300, true), toggle('!instantwin', 'Ganzes Wort raten'), choice('!words', 'Wörter pro Spiel oder Wortliste', ['1', '5', '10', 'en', 'de', 'es', 'pt', 'fr']), toggle('!daily', 'Tageswort')] },
    { id: 'trivia', label: 'Trivia', icon: '🧠', open: '!trivia', settings: [text('!category', 'Kategorie', 'z. B. Flags'), button('!poll', 'Kategorien per Twitch-Umfrage'), rounds(100, 'Fragen'), timer('Zeit pro Frage', 5, 300), toggle('!autojump', 'Automatisch weiter'), toggle('!pro', 'Pro-Fragen'), choice('!pictures', 'Bilderrunden', ['off', 'mix', 'only']), toggle('!intl', 'Internationaler Chat'), toggle('!double', 'Doppelte Punkte am Schluss'), toggle('!streaks', 'Antwort-Serien'), toggle('!daily', 'Tagesquiz'), text('!triviapack', 'Fragenpaket', 'Kurze ID oder off')] },
    { id: 'golf', label: 'Mini Golf', icon: '⛳', open: '!minigolf', aliases: ['!golf'], settings: [mode(['classic', 'race', 'elimination', 'chatball', 'versus']), text('!course', 'Bahn hinzufügen', 'Bibliotheks-ID oder Bahn-Code'), choice('!courses', 'Bahnliste laden', ['tutorial', 'pro', 'arcade', 'ricochet', 'water', 'chaos', 'race', 'clear', 'endless']), button('!endless', 'Nächstes Endlos-Loch'), button('!endless reset', 'Endlose Wüste zurücksetzen (zweimal in einer Minute)'), button('!cup', 'Wochen-Cup laden'), button('!cup last', 'Letzten Wochen-Cup laden'), { command: '!holes', label: 'Löcher', type: 'numberOrAll', min: 1, max: 18, hint: '1–18 oder all' }, timer('Zeit pro Loch', 10, 900, true), toggle('!playalong', 'Streamer spielt mit'), number('!grace', 'Nachlaufzeit', 0, null, 'Sekunden; 0 = aus'), number('!maxplayers', 'Maximale Spieler', 0, null, '0 = unbegrenzt'), toggle('!latejoin', 'Später Einstieg'), choice('!cap', 'Schlaglimit über Par', ['off', '3', '4', '6']), toggle('!collide', 'Ball-Kollisionen'), toggle('!prediction', 'Twitch-Vorhersage'), toggle('!facecam', 'Facecam'), choice('!tutorial', 'Anleitung', ['always', 'first', 'never']), choice('!scoring', 'Wertung', ['points', 'strokes'])] },
    { id: 'chess', label: 'Schach', icon: '♟️', open: '!chess', settings: [choice('!color', 'Streamer-Farbe', ['white', 'black', 'coinflip']), timer('Zeit pro Zug', 10, 600), toggle('!easymode', 'Züge markieren'), toggle('!allowresign', 'Chat darf aufgeben'), toggle('!showhistory', 'Zughistorie'), toggle('!showcaptured', 'Geschlagene Figuren'), choice('!puzzle', 'Aufgaben-Modus', ['on', 'off', 'easy', 'medium', 'hard']), choice('!hearts', 'Herzen', ['1', '3', '5']), choice('!handicap', 'Vorgabe', ['none', 'knight', 'rook', 'queen', 'pawn', 'time', 'time chat']), text('!fen', 'Startstellung', 'FEN [Lösungszüge] oder off')] },
    { id: 'chatships', label: 'ChatShips', icon: '🚢', open: '!chatships', settings: [choice('!first', 'Erster Schuss', ['streamer', 'chat', 'coinflip', 'random']), timer('Zeit zur Schusswahl', 10, 120), toggle('!showvotes', 'Stimmen anzeigen')] },
    { id: 'memory', label: 'Meemorie', icon: '🃏', open: '!memory', settings: [choice('!size', 'Spielfeld', ['4', '6', '8']), choice('!first', 'Erster Zug', ['streamer', 'chat', 'coinflip', 'random']), timer('Zeit zur ersten Karte', 10, 120), toggle('!showvotes', 'Stimmen anzeigen')] },
    { id: 'chatdle', label: 'Chatdle', icon: '🟩', open: '!chatdle', settings: [mode(['classic', 'easy5']), choice('!words', 'Wortliste', ['en', 'de', 'es', 'pt', 'fr']), choice('!rounds', 'Wörter pro Spiel', ['1', '3', '5', '10']), timer('Zeit pro Abstimmung', 15, 120), toggle('!daily', 'Tageswort')] },
    { id: 'marbles', label: 'Marbles on Chat', icon: '🔮', open: '!marbles', settings: [text('!track', 'Strecke hinzufügen', 'Bibliotheks-ID oder Strecken-Code'), choice('!tracks', 'Strecken laden', ['clear', 'random']), number('!maxplayers', 'Maximale Murmeln', 1, 250), toggle('!playalong', 'Streamer spielt mit'), choice('!teams', 'Teams', ['off', '2', '4']), toggle('!followers', 'Nur Follower'), { ...number('!minage', 'Mindestalter Twitch-Konto', 1, null), type: 'numberOrOff', hint: 'Tage oder off' }, toggle('!subheat', 'Abonnenten zuerst im letzten Lauf'), { ...number('!heatcap', 'Murmeln pro Lauf', 1, null), type: 'numberOrOff', hint: 'Anzahl oder off = alle' }, toggle('!heatline', 'Top-3-Chatzeile nach jedem Lauf'), toggle('!knockout', 'K.-o.-Cup')] },
    { id: 'backseat', label: 'Backseat Apocalypse', icon: '🚗', open: '!backseat', aliases: ['!car'], settings: [] },
    { id: 'sizeup', label: 'Size Up', icon: '📏', open: '!sizeup', settings: [rounds(10, 'Dinge pro Spiel'), timer('Zeit pro Ding', 10, 120), text('!category', 'Kategorie', 'mix, towers, landmarks, animals, sea, dinos, vehicles, flight, ships, weight oder speed'), toggle('!median', 'Median statt Durchschnitt'), toggle('!bust', 'Nicht drüber'), toggle('!daily', 'Tagesspiel'), mode(['versus', 'chat', 'survival'])] },
    { id: 'tierlist', label: 'Chat-Tierlist', icon: '🏆', open: '!tierlist', aliases: ['!tiers'], settings: [text('!pack', 'Liste', 'Kürzel, Name oder fresh', true), choice('!items', 'Anzahl Dinge', ['8', '12', '16']), timer('Zeit pro Ding', 10, 60)] },
    { id: 'climb', label: 'ChatClimb', icon: '🧗', open: '!climb', settings: [button('!veto', 'Veto: Streamer zielt selbst (8 s)'), number('!veto', 'Veto mit Sprungwinkel', 0, 180, '0 rechts, 90 hoch, 180 links')] },
    { id: 'wordrush', label: 'Word Rush', icon: '🔠', open: '!wordrush', settings: [rounds(20, 'Level pro Lauf'), timer('Zeit pro Level', 30, 300), { ...number('!padlock', 'Wörter pro Person', 0, 20), type: 'numberOrOff', hint: '0–20 oder off' }, choice('!words', 'Wortliste', ['en', 'de'])] },
    { id: 'feud', label: 'Chat Feud', icon: '🎯', open: '!feud', settings: [mode(['coop', 'streamer', 'ffa']), toggle('!survey', 'Chat baut Tafeln'), rounds(10, 'Tafeln'), timer('Zeit pro Antwort', 10, 60), choice('!words', 'Sprache', ['en', 'de', 'es', 'pt', 'fr'])] },
    { id: 'brawl', label: 'Chat Brawl', icon: '🥊', open: '!brawl', settings: [rounds(10, 'Minispiele'), timer('Zeit pro Minispiel', 30, 90), toggle('!playalong', 'Streamer spielt Riesen')] },
    { id: 'hotseat', label: 'CHATionair', icon: '💡', open: '!hotseat', settings: [text('!contestant', 'Kandidat', 'Twitch-Name oder streamer'), timer('Zeit pro Frage', 15, 120, true)] },
    { id: 'bossraid', label: 'Boss Raid', icon: '🐉', open: '!bossraid', settings: [choice('!boss', 'Boss, Schwierigkeit oder Zeit', ['dragon', 'kraken', 'toaster', 'slime', 'random', 'easy', 'normal', 'hard', '6', '8', '10'])] },
    { id: 'pixel', label: 'Pixel Reveal', icon: '🖼️', open: '!pixel', settings: [choice('!category', 'Bilder', ['mix', 'animals', 'food', 'places', 'things']), rounds(20, 'Bilder'), timer('Zeit bis Bild scharf ist', 15, 60)] },
    { id: 'mapguess', label: 'Map Guess', icon: '🗺️', open: '!mapguess', aliases: ['!map'], settings: [rounds(10, 'Orte'), timer('Zeit pro Ort', 15, 120), mode(['versus', 'chat', 'survival'])] },
    { id: 'higherlower', label: 'Higher or Lower', icon: '📈', open: '!higherlower', aliases: ['!hol'], settings: [choice('!deck', 'Zahlen', ['height', 'length']), mode(['streak', 'knockout']), { ...number('!rounds', 'Karten', 0, 40), type: 'numberOrOff', hint: '1–40; 0 oder off = ohne Limit' }, timer('Zeit pro Karte', 10, 60)] },
    { id: 'price', label: 'Guess the Price', icon: '💰', open: '!price', settings: [choice('!currency', 'Währung', ['eur', 'usd']), mode(['versus', 'chat', 'survival']), toggle('!nogoingover', 'Nicht drüber'), rounds(10, 'Dinge'), timer('Zeit pro Ding', 10, 120)] },
    { id: 'yearguess', label: 'Year Guess', icon: '📅', open: '!yearguess', settings: [mode(['versus', 'chat', 'survival']), rounds(10, 'Fotos'), timer('Zeit pro Foto', 10, 120)] }
  ];

  const controls = [button('!start', 'Spiel starten'), button('!cancel', 'Spiel abbrechen'), button('!skip', 'Runde überspringen'), text('!kick', 'Spieler entfernen', 'Twitch-Name'), text('!unkick', 'Spieler wieder zulassen', 'Twitch-Name'), button('!next', 'Nächste Frage / Runde'), button('!restart', 'Neue Lobby starten'), button('!again', 'Spiel mit gleichen Einstellungen wiederholen'), text('!msg', 'Nachricht im Spiel zeigen', 'Text, wenige Sekunden oben im Spiel'), { ...number('!addtime', 'Schach-Zugzeit hinzufügen', 1, null, 'Sekunden; leer = 30'), type: 'optionalNumber' }, ...pause];
  const general = [button('!home', 'Zum Dashboard / Spiel beenden'), button('!dashboard', 'Zum Dashboard (Alias)'), ...['en', 'de', 'es', 'pt', 'fr'].map(language => button(`!${language}`, `Sprache: ${language}`)), toggle('!subonly', 'Nur Abonnenten'), button('!chatgameshelp', 'Befehlsübersicht anzeigen'), text('!rank', 'Rang oder Chatter-Sterne', 'Name oder me; leer = Chat-Rang', true), text('!top', 'Top 3 im Chat', 'Spielname; leer = gesamt', true), button('!me', 'Session-Punkte oder eigene Kugel'), button('!session', 'Session-Punkte'), button('!tonight', 'Session-Punkte (Alias)'), button('!session reset', 'Session zurücksetzen'), button('!finale', 'Session-Finale zeigen'), button('!chatgames', 'ChatGames-Link posten')];
  const viewer = [button('!join', 'Marbles beitreten'), button('!me', 'Eigene Murmel finden'), button('!reset', 'Murmel zurücksetzen'), number('!marble', 'Murmeltyp', 1, null), number('!skin', 'Aussehen', 1, null), button('!skins', 'Aussehen anzeigen'), choice('!team', 'Team wählen', ['rot', 'blau', 'gelb', 'grün']), number('!rate', 'Strecke bewerten', 1, 10), text('!stats', 'Statistik abfragen', 'Spielername, leer = eigene Statistik', true), button('!record', 'Streckenrekord'), button('!use', 'Item zünden'), ...['boost', 'ghost', 'rocket', 'lightning', 'slick'].map(item => button(`!${item}`, `Item: ${item}`)), text('!guess', 'Ganzes Wort raten', 'Wort bei Hangman')];

  function build(definition, value = '') {
    const command = definition?.command;
    if (typeof command !== 'string' || !/^![a-z]+(?: [a-z]+)?$/i.test(command)) throw new Error('Ungültiger Befehl.');
    if (definition.type === 'button') return command;
    const input = String(value ?? '').trim();
    if (definition.type === 'choice' && !definition.values.includes(input)) throw new Error('Wähle einen gültigen Wert.');
    if (definition.type === 'optionalNumber' && !input) return command;
    if (definition.type === 'number' || definition.type === 'optionalNumber' || definition.type === 'numberOrAll' || definition.type === 'numberOrOff') {
      if (definition.type === 'numberOrAll' && input.toLowerCase() === 'all') return `${command} all`;
      if (definition.type === 'numberOrOff' && input.toLowerCase() === 'off') return `${command} off`;
      if (!/^\d+$/.test(input) || !Number.isSafeInteger(Number(input)) || Number(input) < definition.min ||
        (definition.max !== null && Number(input) > definition.max) ||
        (Number(input) > 0 && definition.positiveMin && Number(input) < definition.positiveMin)) {
        throw new Error(`Erlaubt: ${definition.min}${definition.max === null ? ' oder mehr' : `–${definition.max}`}${definition.type === 'numberOrAll' ? ' oder all' : definition.type === 'numberOrOff' ? ' oder off' : ''}.`);
      }
    }
    if (definition.type === 'text' || definition.type === 'optionalText') {
      if (!input && definition.type === 'optionalText') return command;
      if (!input || input.length > 160 || /[\r\n!]/.test(input)) throw new Error('Bitte gültigen Text mit höchstens 160 Zeichen eingeben.');
    }
    return `${command} ${input}`;
  }
  return { games, controls, general, viewer, build };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ChatGamesCommands;
