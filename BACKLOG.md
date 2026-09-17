# Backlog – ShishaWG Mod Setup Tool

Single Source of Truth für Change Requests, Ideen und Entscheidungen.
Diese Datei kann direkt an Anti-Gravity als Kontext gereicht werden.

**Status-Symbole:** 💡 Idee · 🔨 In Arbeit · ✅ Fertig · ❌ Abgelehnt

**Kürzel für Priorität:** H = hoch · M = mittel · N = niedrig

📋 **Live Trello Board:** [SWG Mod Tool CR's](https://trello.com/b/BHLXcNzA/swg-mod-tool-crs)

---

## 1. Aktive Requests

💡 **Ideen** (noch nicht angesetzt)

| # | Request | Pri | Datum | Anmerkung |
|---|---------|-----|-------|-----------|
| 13 | UI & Design Rework (visuelle Modernisierung, Farben, Typografie, Spacing & Komponenten) | M | 03.09.2026 | Großes Design-Refresh für ein aufgeräumtes, modernes Dashboard und klare Kontraste. |
| 14 | Standard-Startansicht festlegen (Default Start-Modul z. B. Setup-Manager merken) | M | 03.09.2026 | App merkt sich lokal das Lieblingsmodul des Mods und öffnet es direkt beim App-Start (abschaltbar/änderbar). Spec: unten „Spec #14“. |

🔨 **In Arbeit** (aktuell umsetzend)

| # | Request | Pri | Status | Anmerkung |
|---|---------|-----|--------|-----------|
| - | (leer) | | | |

---

## 2. Fertig

| # | Request | Fertig am | Version |
|---|---------|-----------|---------|
| 4 | Fix Supabase Active Bowl Timer & Multi-User Live Sync (updateHeadCounterUI Crash behoben, Realtime Sync entkoppelt & 4s Polling-Fallback hinzugefügt) | 02.09.2026 | v7.1.0 |
| 5 | Session Resume & Quick Start (Köpfe aus Historie per 🔄-Button wiederaufnehmen, Timer mit Originalstartzeit fortsetzen, Direkter Startbutton in Timer-Leiste) | 02.09.2026 | v7.1.1 |
| 6 | In-Place Session Setup Update (Laufenden Kopf nur anpassen Toggle im Generator, Timer läuft nahtlos weiter ohne neuen Kopf zu starten) | 02.09.2026 | v7.1.2 |
| 7 | UI Polish: Toggle Switch ins Header-Panel neben Kopieren-Button verschoben & Text auf „Nur laufendes Setup anpassen" vereinfacht | 02.09.2026 | v7.1.3 |
| 8 | Timer Autostart Fix: Timer startet nicht mehr beim bloßen Ausfüllen der Formularfelder, sondern ausschließlich beim Klick auf „In Twitch-Chat Senden" oder „▶️ Kopf starten" | 02.09.2026 | v7.1.4 |
| 9 | Hardware Analytics Exclusivity: Elektrogeräte (XKAH etc.) werden strikt nur unter Top 5 Elektrogeräte geführt und verfälschen nicht mehr die Top 5 Köpfe | 02.09.2026 | v7.1.5 |
| 11 | Fix: Setup-Import / Einfügen übernimmt Tabaksorten nicht (auch bei tool-generiertem Format) | 03.09.2026 | v7.1.6 |
| 12 | Stats: Getrennte Ø Rauchdauer für Kohle-Köpfe vs. E-Köpfe (Naturkohle vs. Elektrogeräte sauber aufgeteilt) | 03.09.2026 | v7.1.7 |
| 2 | Geschmack pro Tabaksorte aus der Datenbank herausnehmen und in den Chat-Befehl schreiben, wenn er unter ~150 Zeichen lang ist; darüber rausgenommen | 03.09.2026 | v7.1.8 |
| 10 | 7TV Emotes im Mod-Chat rendern & per interaktivem Picker einfügen | 03.09.2026 | v7.1.8 |
| 1 | Mods können Change Requests direkt aus dem Tool senden; kommen bei Bastian auf Trello an | 03.09.2026 | v7.2.0 |
| 3 | Individuelles Mod-Dashboard: 8. Kachel auf Landingpage, unsichtbares 12-Spalten Git-Raster, Drag & Drop, frei skalierbare Widget-Größen & Einklappbarkeit | 04.09.2026 | v7.3.0 |

---

## 3. Abgelehnt / Parked

| # | Request | Entscheidung | Warum | Datum |
|---|---------|--------------|-------|-------|
| - | (leer) | | | |

---

## Workflow

1. Change Request kommt → wird unter „Ideen“ eingetragen (nächste freie #-Nummer, durchlaufend).
2. Kurzes Review: Priorität setzen, bei Unklarheit eine Anmerkung mit offener Frage.
3. Entscheidung pro Request: **jetzt** (→ In Arbeit), **später** (bleibt Idee), **drop** (→ Abgelehnt mit Begründung).
4. Nach Umsetzung: Nummer in „Fertig“ verschieben + Build-Version notieren.
5. `#`-Nummern nie wiederverwenden – so bleibt die Historie sauber.

---

## Specs (Kopierbar für Anti-Gravity)

### Spec #1 – Change-Request-Button (GitHub Issue)

**Ziel:** Mods können aus dem Tool heraus einen Change Request als vorbefülltes GitHub-Issue an Bastian senden.

**Funktionsweise:**
1. Neuer Button im Header: „💡 Change Request“ (neben Hotkey-Bulb, vor Twitch-Login). Style: `btn-icon-bulb`.
2. Klick öffnet einen kleinen Modal:
   - **Titel** (Kurzbeschreibung, Pflichtfeld, max. 100 Zeichen)
   - **Details** (Mehrzeiliges Textfeld: Was soll wie geändert werden?)
   - **Kategorie** (Dropdown: Fehler / Wunsch / UI / Inhalt & Daten / Sonstiges)
   - Submit-Button: „📤 Als GitHub-Issue senden“
3. Beim Senden: Button wird disabled + Status-Text „Öffne Browser...“.
4. Renderer baut den Link und ruft `ipcRenderer.invoke('app:open-external', url)` auf:
   ```
   https://github.com/BazZTee/shishawg-mod-setup-tool/issues/new?title=<URL-encodierte Titel vorangestellt mit [CR]: ...>&body=<URL-encodierte Details>
   ```
   - Vor der Details im Body automatisch einfügen (Template):
     ```
     **Kategorie:** <ausgewählte Kategorie>
     **Tool-Version:** v<app-version> (aus package.json via IPC oder window.appInfo)
     **Mod:** <Twitch-Login-Name, falls verbunden; sonst „(nicht angemeldet)“>
     **Datum:** <ggjj.mm.tttt>

     <Details vom Mod>
     ```
5. `app:open-external` existiert bereits in main.js (shell.openExternal) – muss nicht neu gebaut werden.
6. Nach erfolgreichem Öffnen: Erfolgsmeldung im Toast: „Browser geöffnet – klicke bei GitHub auf ‚Create issue‘, damit der Request bei Bastian ankommt.“

**Wichtige Hinweise:**
- Issue-Titel-Prefix `[CR]` = einheitlich filterbar.
- Mod muss einen GitHub-Account haben (sonst öffnet sich die GitHub-Login-Seite – das ist akzeptabel, keine Extra-Logik nötig).
- **Kein** automatisches Erstellen des Issues – der Mod bestätigt manuell per Klick auf GitHub. So geht nichts verloren, wenn er es noch einmal durchlesen will.

**Definition of Done:**
- [ ] Button im Header sichtbar
- [ ] Modal mit Titel/Details/Kategorie
- [ ] Klick öffnet Browser auf vorbefülltem `issues/new`-Link
- [ ] Template im Body mit Kategorie, Version, Mod-Name, Datum
- [ ] Erfolgs-Toast nach Öffnen
- [ ] Funktioniert auch, wenn kein Twitch-Account verbunden ist (dann „(nicht angemeldet)“)

---

### Spec #2 – Geschmäcker automatisch in den Chat-Befehl

**Ziel:** Wenn der Mod ein Setup per `!editsetup` sendet und der fertige Befehl **unter der Schwellenwert-Länge** liegt, sollen die Geschmacks-Notizen der verwendeten Tabaksorten automatisch in den Befehl mitreingeschrieben werden. Liegt der Befehl darüber, werden sie weggelassen (der Chat bleibt sauber/kurz).

**Datenquelle (geklärt ✅):** Die HookahTools-API liefert pro Sorte bereits ein `description`-Feld mit den Aromen, z. B. `description: "Green Apple, Sweet Pear"` (zusätzlich existieren `type` und `base_notes` – `description` ist die menschenlesbare Quelle und soll verwendet werden).
- **Umsetzung in `dbService.js`:** Der Delta-Sync holt aktuell nur `id,name,brand_id,line,updated_at` → `description` (und optional `type`) an beide Fetch-Stellen anhängen (Delta-Query + Voll-Download).
- **Cache:** `hookahtools_tobacco_snapshot.json`-Struktur erweitern: aus reinen Strings wird pro Sorte ein Objekt `{ name, flavor }` (Name = aktuell formatierter Display-Name). **Wichtig:** `combinedTobacco` in `dbService.js` hat schon die Form `{ name, source, isCustom }` → einfach `flavor` daneben ergänzen, Renderer konsumiert `tobacco[i].flavor`.
- **Fallback:** Fehlendes `description` → `flavor: null` → Befehl exakt wie heute (kein leeres `()`).
- **Backward-Kompatibilität:** Renderer muss Sorten sowohl als String (alte Cache-Dateien) als auch als Objekt vertragen, bis der nächste Sync den Cache neu baut.

**Funktionsweise:**
1. Bei der Befehlsgenerierung (renderer.js, `fullCommand`-Build) wird die finale Länge des `!editsetup`-Befehls gemessen.
2. Schwellenwert: Konstante `MAX_LEN_WITH_FLAVORS = 150` (konfigurierbar in einem neuen kleinen Setting-Sliding oder als feste Konstante – im Review entscheiden).
3. **Länge ≤ Schwellenwert:** Hinter jede Tabaksorte im Befehl wird der Geschmack angehängt, Format: `Sorte (Geschmack1, Geschmack2)`.
   - Beispiel: `030 Bärenstark 42 (Schokolade, Kaffee) und Funky Fruits Blueberry (Beere, süß)`
   - Sorten ohne Geschmack in der DB: einfach ohne Anhang.
4. **Länge > Schwellenwert:** Geschmäcker werden weggelassen – Befehl bleibt exakt wie heute.
   - Wichtig: Die Schwellenwert-Prüfung gilt für den Befehl **inklusive** der Geschmäcker. Praktisch: erst Befehl ohne Geschmäcker bauen → misst man über → fertig; andernfalls mit Geschmäckern bauen → liegt er damit trotzdem über (möglich, weil Anhang länger als das Budget) → dann ohne Geschmäcker senden. Also: mit-Geschmäck-Variante nur senden, wenn sie selbst ≤ Schwellenwert.
5. Optional: Ein kleiner Switch „Geschmäcker automatisch anhängen“ (Standard: an) falls der Mod es einmal manuell unterdrücken will.

**Definition of Done:**
- [ ] ✅ Datenquelle geklärt (`description`-Feld) – Anti-Gravity holt es im Delta-Sync + Voll-Download mit
- [ ] Befehl ≤ Schwellenwert → Geschmäcker im Befehl, Format `Sorte (G1, G2)`
- [ ] Befehl > Schwellenwert → exakt wie heute, keine Geschmäcker
- [ ] Schwellenwert als Konstante/Setting (150 als Default)
- [ ] Import-Pfad (`!editsetup` lesen) bleibt unverändert lesbar (Geschmäcker landen im selben `//`-Segment)
- [ ] Sorten ohne Geschmacks-Daten: kein Bruch, kein leeres `()`

---

### Spec #3 – Individuelles Mod-Dashboard (Interaktives Widget-Cockpit mit Grid-Raster & Resize)

**Ziel:** Jedes Mod kann sich auf der Hub-Seite (Landing) ein eigenes Dashboard zusammenbauen. Auf der Landingpage gibt es dafür eine neue 8. Kachel mit einem großen `➕`. Im Dashboard können die Funktions-Boxen auf einem unsichtbaren Git-Raster frei verschoben und in der Größe (1/3, 1/2, Vollbild) angepasst werden.

**Hintergrund & Einstieg:**
- Auf dem Hub (`view-landing`) vervollständigt eine **8. Kachel** das Raster zu einem symmetrischen 2×4-Grid:
  - Leerzustand: Gestrichelte Kachel mit großem leuchtenden `➕ Mein Dashboard`.
  - Konfiguriert: Vollwertige Kachel mit Badge (z. B. `3 MODULE AKTIV`) und Direktstart-Button `Tool öffnen →`.
- **Ausnahme (fest):** „Giveaways & Adressen“ ist eine geschützte Anwendung → bleibt als Ganzes separat und wird nicht zerlegt.

**Funktionsweise:**
1. **Unsichtbares Layout-Raster (CSS Grid):**
   - Das Dashboard nutzt ein flexibles 12-Spalten-Raster.
   - Jedes Widget dockt sauber an Nachbarboxen an.
2. **Freies Verschieben (Drag & Drop):**
   - Jedes Widget besitzt in der Kopfleiste einen Drag-Handle (`⠿`), um es an jede gewünschte Position zu ziehen (z. B. Chat rechts, Setup links).
3. **Frei skalierbare Größen (Resize):**
   - Jedes Widget kann in der Breite skaliert werden:
     - `1/3 Breite` (kompakt für Timer, Stats)
     - `1/2 Breite` (ideal für Setup-Generator)
     - `Volle Breite` (perfekt für Mod-HQ Live-Chat)
   - Anpassbar über einen Resize-Handle an der Box-Ecke oder Header-Buttons.
4. **Einklappbar:**
   - Jede Box hat ein `▼ / ▲`-Icon im Header, um sie bei Bedarf auf einen schmalen Streifen einzuklappen.
5. **„➕ Neues Modul“-Kachel:**
   - Direkt im Grid liegt eine gestrichelte Plus-Kachel, über die neue Widgets aus dem Katalog hinzugefügt werden können.
6. **Persistenz:**
   - Gespeichert lokal im `localStorage` unter `swg_custom_dashboard_config` (Position, Spaltenbreite, Einklapp-Status).

**Definition of Done:**
- [ ] 8. Kachel auf der Landingpage mit `➕` und aktivem Zustand
- [ ] Grid-Dashboard mit unsichtbarem 12-Spalten-Raster
- [ ] Widgets frei verschiebbar (Drag & Drop)
- [ ] Widgets in der Breite skalierbar (1/3, 1/2, Vollbild)
- [ ] Widgets ein-/ausklappbar mit Zustandserhalt
- [ ] Speicherung lokal in `localStorage` pro Moderator-PC
- [ ] Giveaways bleibt als separates Modul ausgeschlossen

---

### Spec #10 – 7TV-Emotes im internen Mod-Chat

**Ziel:** Im internen Mod-Chat (`view-modchat`) sollen 7TV-Emotes (sowohl globale als auch die Channel-Emotes des jeweils aktiven Streamers) erkannt und als Bilder gerendert werden, damit Absprachen und Reaktionen für das Moderatoren-Team das gewohnte Twitch-Feeling bieten.

**Architektur & Datenspeicherung:**
- **Keine Änderung an der Datenbank:** In Supabase / `mod_chat_messages.json` wird weiterhin reiner Text gespeichert (z. B. `"Haha das war so KEKW"`).
- **Client-seitige Anreicherung:** Die Konvertierung von Emote-Codes (z. B. `KEKW`, `monkaW`, `OMEGALUL`) in Bilder erfolgt ausschließlich beim Rendern im Renderer (`renderer.js`).
- **Hohe Performance & Offline-Toleranz:** Emote-Listen werden gecached. Ist die 7TV API offline oder langsam, bleibt der Chat voll funktionsfähig und zeigt den Originaltext an.

**7TV API-Datenquellen:**
- **Channel-Emotes:** `https://7tv.io/v3/users/twitch/{twitch_user_id}`
  - Liefert das Emote-Set des konfigurierten Twitch-Kanals.
- **Globale 7TV-Emotes:** `https://7tv.io/v3/emote-sets/global`
  - Liefert die plattformweiten 7TV-Standard-Emotes.
- **CDN-URLs:** Bilder liegen auf `https://cdn.7tv.app/emote/{id}/1x.webp` (Standardauflösung für Chat-Fluss).

**Funktionsweise:**
1. **Initialisierung & Caching:**
   - Beim App-Start oder beim Wechsel des Streamer-Profils lädt ein Service (z. B. `sevenTvService.js` im Main-Prozess oder direkt via IPC) die globalen + Channel-Emotes herunter.
   - Ein Map-Objekt `emoteMap: Map<string, { url: string, name: string, isZeroWidth: boolean }>` wird aufgebaut.
   - Lokaler Fallback-Cache (z. B. im `store` oder `dbService` mit 24h Gültigkeit), um 7TV-Rate-Limits oder Downtimes abzufangen.
2. **Chat-Rendering (`renderModChatMessages`):**
   - Statt `escapeHtml(msg.text)` unzerlegt auszugeben, wird der Text nach Whitespace getrennt (Tokenizing).
   - Treffer in `emoteMap` werden durch ein HTML-Image-Tag ersetzt:
     ```html
     <img class="mod-chat-emote" src="${emote.url}" alt="${emote.name}" title="${emote.name}" loading="lazy">
     ```
   - Alle restlichen Textbestandteile werden strikt per `escapeHtml()` abgesichert (XSS-Schutz).
   - Styling (`styles.css`): `.mod-chat-emote { height: 28px; max-height: 1.5em; vertical-align: middle; object-fit: contain; }`
3. **Phasen-Aufteilung:**
   - **Phase 1 (Core):** Automatisches Parsing und Rendern von getippten Emote-Namen im Chat-Verlauf.
   - **Phase 2 (UX-Bonus):** Kleiner Emote-Picker-Button (🙂) neben dem Chat-Eingabefeld mit Suchleiste und Klick-zum-Einfügen in das Textfeld.

**Definition of Done:**
- [ ] 7TV API Abruf für globale Emotes implementiert
- [ ] 7TV API Abruf für den aktiven Kanal (über Twitch-User-ID) implementiert
- [ ] Gecachte Emote-Map mit Fallback bei Netzwerkfehlern / Offline
- [ ] Chat-Parser ersetzt bekannte Wörter sicher und performant durch `<img>`-Tags
- [ ] HTML-Escaping für regulären Text bleibt 100% intakt (XSS-sicher)
- [ ] Emotes werden mit max. 28px Höhe inline und sauber zentriert im Chat dargestellt
- [ ] Text im Chat bleibt als reiner Text kopierbar/gespeichert (kein DB-Overhead)

---

### Spec #11 – Fix: Setup-Import & Zwischenablage-Parser für Tabaksorten

**Problemstellung:**
Beim Einfügen vorhandener Setups über das Zwischenablage-/Import-Modal (`btnApplyPasteSetup`) oder beim Abrufen aus dem Twitch-Chat (`!setup` Antwort) werden die Tabaksorten nicht zuverlässig in die Formularfelder des Generators übernommen. Selbst wenn man einen exakt vom Tool generierten Befehl (z. B. `!editsetup Ocean Hookah // Cosmo Bowl // Onmo HMD // 27er // MustH - Pynkman //`) einfügt, bleiben die Tabakfelder leer oder unvollständig.

**Ursachenanalyse (in `src/renderer/renderer.js`):**
1. **Falsche Falsy-Bedingung bei Segmentverarbeitung:**
   - In `parseChatSetupMessage` werden Segmente nach `//` aufgeteilt.
   - Wenn eine Person neu angelegt wird, wird `tobaccos` standardmäßig als `['']` initialisiert.
   - Trifft nun das nachfolgende Tabak-Segment ein, prüft Zeile 1651:
     `if (currentPerson && (!currentPerson.pipe || currentPerson.tobaccos[0]))`
   - Weil `currentPerson.tobaccos[0]` ein leerer String `''` (falsy) ist und `pipe` bereits gesetzt ist (`!currentPerson.pipe === false`), evaluiert dieser gesamte Ausdruck zu `false`!
   - Da kein `else`-Zweig existiert, wird das Tabak-Segment **komplett verworfen**.
2. **Zuordnung bei 1-Person vs. Multi-Person:**
   - Single-Person-Befehle besitzen kein `Name:`-Präfix vor den Segmenten.
   - Die Unterscheidung zwischen Pfeife, Zubehör und Tabak-Listen (`splitTobaccoString`) muss eindeutig greifen, ohne dass Tabake als Pfeife missinterpretiert oder fallen gelassen werden.
3. **Mengenangaben & Format-Bereinigung:**
   - Formate wie `Sorte (15g)`, `Sorte (50%)` oder Mischungen wie `Sorte 1 und Sorte 2` müssen wieder sauber in getrennte Zeilen und die entsprechenden Mengenangaben-Inputs (`tobaccoAmounts`, `tobaccoUnit`, `showTobaccoAmounts`) zerlegt werden.
4. **Fuzzy-Matching & Freitext-Fallback:**
   - Findet das Fuzzy-Matching den Tabak im lokalen/remote HookahTools-Katalog (`catalog.tobacco`), wird der offizielle Name gewählt; wird er nicht gefunden, muss der String als Freitext (Custom Tobacco) 1:1 erhalten bleiben, statt im Nichts zu verschwinden.

**Lösungsansatz:**
1. **Parser-Bedingungslogik reparieren:**
   - Die Segment-Schleife in `parseChatSetupMessage` so überarbeiten, dass Tabak-Segmente zuverlässig als solche identifiziert und der jeweiligen Person zugeordnet werden.
   - Vorhandene leere Platzhalter (`['']`) müssen durch die tatsächlich geparsten Tabake ersetzt bzw. neue Tabake angehängt werden.
2. **Round-Trip-Garantie (Idempotenz):**
   - Jeder von `generateCommandString()` erzeugte `!editsetup`-Befehl muss beim erneuten Einfügen über `parseChatSetupMessage()` exakt dieselben Werte für Pfeife, Kopf, HMD, Kohle, Extras und alle Tabaksorten (inkl. Gramm-/Prozent-Angaben) wieder in `state.persons` schreiben.
3. **Unterstützung verschiedener Trennzeichen:**
   - Tabakmischungen mit `und`, `,`, `&` oder `+` müssen sauber in einzelne Tabak-Slots aufgeteilt werden.

**Definition of Done:**
- [ ] Eigene, vom Tool generierte `!editsetup`-Befehle (sowohl 1-Person als auch Multi-Person) lassen sich per Zwischenablage einfügen und stellen 100% aller Tabaksorten wieder her
- [ ] Mengenangaben wie `(12g)` oder `(40%)` werden wieder korrekt in die Mengenfelder und Einheit-Schalter übernommen
- [ ] Tabakmischungen (`Sorte A und Sorte B`) landen in getrennten Tabak-Eingabezeilen
- [ ] Tabaksorten, die nicht im Katalog existieren, bleiben als Freitext im Feld erhalten
- [ ] Kohle- und Extra-Segmente stören die Tabakerkennung nicht mehr

---

### Spec #12 – Getrennte Rauchdauer-Statistik (Kohle vs. E-Kopf)

**Ziel:** In den Analytics & KPIs (`view-stats`) soll die durchschnittliche Rauchdauer nicht mehr als ein einziger aggregierter Gesamtwert berechnet werden, sondern sauber getrennt nach:
1. **Klassische Köpfe mit Naturkohle** (normale Setups)
2. **E-Köpfe / Elektrogeräte** (z. B. XKAH, IMOTO, e-HMDs)

**Hintergrund:**
Elektrogeräte besitzen ein völlig anderes Hitzemanagement, feste Timer/Akkulaufzeiten oder andere Rauchgewohnheiten als traditionelle Köpfe mit Naturkohle. Ein gemeinsamer Schnitt verfälscht beide Kategorien. Durch die Trennung erhält der Streamer realistische Einblicke in die tatsächliche Session-Dauer beider Systeme.

**Erkennungslogik (analog zu v7.1.5 Hardware Analytics):**
Eine Session gilt als **E-Kopf / Elektrogerät**, wenn mindestens eine der folgenden Bedingungen zutrifft:
- `session.is_electric === true` bzw. `session.isElectric === true`
- Feld `session.electric_device` ist gesetzt
- Die Einträge in `bowl`, `hmd` oder `pipe` enthalten E-Geräte-Schlüsselwörter: `xkah`, `elektr`, `e-kopf`, `e–kopf`, `imoto`, `e-hmd`, `e–hmd`

Trifft keine dieser Bedingungen zu, wird die Session als **klassischer Kohle-Kopf** gewertet.

**Berechnung:**
- **Kohle:**
  - `sumDurationCoal`: Summe aller `duration_minutes` klassischer Sessions
  - `countCoal`: Anzahl klassischer Sessions
  - `avgDurationCoal = countCoal > 0 ? Math.round(sumDurationCoal / countCoal) : 0`
- **E-Kopf:**
  - `sumDurationElectric`: Summe aller `duration_minutes` von Elektro-Sessions
  - `countElectric`: Anzahl Elektro-Sessions
  - `avgDurationElectric = countElectric > 0 ? Math.round(sumDurationElectric / countElectric) : 0`

**UI & Layout (`index.html` / `styles.css`):**
- Die KPI-Leiste wird angepasst:
  - Entweder als zwei separate KPI-Karten im Grid (z. B. 🪵 *Ø Dauer (Kohle)* und ⚡ *Ø Dauer (E-Kopf)*, inkl. Angabe der jeweiligen Session-Anzahl, z. B. „aus 42 Köpfen“)
  - Oder als erweiterte KPI-Karte mit Gesamtschnitt + Sub-Zeilen für Kohle und E-Kopf.
  - Empfehlung: 2 eigenständige, klare KPI-Cards für maximale Lesbarkeit im Stream.

**Definition of Done:**
- [ ] Sessions werden in `renderStatsAnalytics()` sauber nach Kohle vs. E-Gerät gefiltert
- [ ] Durchschnittliche Rauchdauer wird für beide Typen separat berechnet
- [ ] Neue KPI-Karten in `index.html` (z. B. `kpi-avg-duration-coal` und `kpi-avg-duration-electric`)
- [ ] Anzeige formatiert mit Minuten und Fallback (`-` oder `0 Min`), wenn keine Daten für eine Kategorie vorliegen
- [ ] Grid in `styles.css` reagiert sauber auf die zusätzliche KPI-Karte (responsive für Full-HD und kleinere Fenster)

---

### Spec #14 – Standard-Startansicht (Default Start Module)

**Ziel:** Jeder Moderator kann sich ein Standard-Startmodul (z. B. Setup-Manager oder Mod-HQ) definieren, sodass das Tool beim Öffnen direkt in diese Ansicht springt, statt immer auf dem Dashboard (`view-landing`) zu starten.

**Hintergrund:**
Viele Moderatoren nutzen das Tool im Stream-Alltag primär für eine konkrete Hauptaufgabe (z. B. Kopf-Setups eintragen oder im Mod-Chat schreiben). Wenn man das Tool oft neu öffnet oder im Hintergrund laufen hat, spart der direkte Sprung jedes Mal einen Klick.

**Funktionsweise:**
1. **Auswahl des Standard-Moduls:**
   - Jedes Modul kann als Standard-Startansicht festgelegt werden:
     - `view-landing` (Standard / Hauptmenü Dashboard)
     - `view-setup` (Setup-Manager & Generator)
     - `view-quickactions` (Quick-Actions & Stream-Manager)
     - `view-modchat` (Mod-HQ Live-Chat)
     - `view-giveaways` (Giveaways & Adressen)
     - `view-qna` (Community Q&A)
     - `view-polls` (Live Twitch-Umfragen)
     - `view-stats` (Stats & Kohle-Timer)
2. **Einstellungs-UI:**
   - **Option A (Sehr intuitiv):** Ein kleiner Pin-Button 📌 in der Header-Leiste jedes Moduls (neben dem Zurück-Pfeil `← Zurück zum Hauptmenü`):
     - Klick auf 📌: Toast *„📌 Setup-Manager als Standard-Startseite festgelegt“*.
     - Erneuter Klick auf 📌: Toast *„Startseite zurückgesetzt (Dashboard)“*.
   - **Option B:** Ein Dropdown in den App-/Profil-Einstellungen: *„Standard-Startseite beim Öffnen: [Hauptmenü / Setup-Manager / Mod-HQ / ...]“*.
3. **Persistenz:**
   - Gespeichert lokal pro Client via `localStorage.getItem('default_start_view')` bzw. in den lokalen App-Settings.
   - Dadurch hat jeder Moderator auf seinem eigenen PC seine persönliche Lieblingsansicht.
4. **App-Start-Verhalten:**
   - Beim Laden der Seite (`initApp()`) prüft der Renderer, ob eine `default_start_view` konfiguriert ist und nicht gleich `'view-landing'` ist.
   - Falls gesetzt, wird sofort `showView(savedDefaultView)` aufgerufen.
5. **Navigation & Rückweg:**
   - Der Moderator gelangt jederzeit wie gewohnt per `← Zurück zum Hauptmenü` oder mit der Taste `ESC` zurück auf das Dashboard.

**Definition of Done:**
- [ ] Speichern und Auslesen der bevorzugten Startansicht via `localStorage`
- [ ] UI-Element zum einfachen Setzen/Entfernen (Pin-Button 📌 oder Einstellungs-Dropdown)
- [ ] Automatischer Aufruf von `showView()` beim App-Start
- [ ] Deaktivierung / Rücksetzen auf Standard (`view-landing`) jederzeit möglich
- [ ] `ESC` und `← Zurück zum Hauptmenü` funktionieren weiterhin nahtlos







