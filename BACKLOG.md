# Backlog – ShishaWG Mod Setup Tool

Single Source of Truth für Change Requests, Ideen und Entscheidungen.
Diese Datei kann direkt an Anti-Gravity als Kontext gereicht werden.

**Status-Symbole:** 💡 Idee · 🔨 In Arbeit · ✅ Fertig · ❌ Abgelehnt

**Kürzel für Priorität:** H = hoch · M = mittel · N = niedrig

---

## 1. Aktive Requests

💡 **Ideen** (noch nicht angesetzt)

| # | Request | Pri | Datum | Anmerkung |
|---|---------|-----|-------|-----------|
| 1 | Mods können Change Requests direkt aus dem Tool senden; kommen bei Bastian an und werden automatisch ins Backlog übernommen | M | 30.08.2026 | ✅ Transport entschieden: **GitHub Issue** (vorbefüllter Issue-Link aus dem Tool). Spec: unten „Spec #1". |
| 2 | Geschmack pro Tabaksorte aus der Datenbank herausnehmen und in den Chat-Befehl schreiben, wenn er unter ~150 Zeichen lang ist; darüber rausgenommen | M | 30.08.2026 | ✅ Datenquelle geklärt: `description`-Feld der HookahTools-API (siehe Spec #2). Jetzt umsetzbar. |
| 3 | Jedes Mod kann sich ein eigenes Dashboard aus den einzelnen Funktions-Boxen der Tool-Seiten zusammenstellen (einklappbar); Giveaways bleibt ausgeschlossen | M | 30.08.2026 | ⚠️ Offene Frage: Persistenz nur lokal oder per Gist pro Mod synchronisiert? (siehe Spec #3). |

🔨 **In Arbeit** (aktuell umsetzend)

| # | Request | Pri | Status | Anmerkung |
|---|---------|-----|--------|-----------|
| - | (leer) | | | |

---

## 2. Fertig

| # | Request | Fertig am | Version |
|---|---------|-----------|---------|
| - | (leer) | | |

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

### Spec #3 – Individuelles Mod-Dashboard (Boxen selbst zusammenstellen)

**Ziel:** Jedes Mod kann sich auf der Hub-Seite (Landing) ein eigenes Dashboard zusammenbauen, indem es sich die einzelnen Funktions-Boxen (Karten) der Tool-Unterseiten aussucht. Die gewählten Boxen erscheinen als „Mein Dashboard“-Sicht und sind dort einzeln ein-/ausklappbar.

**Hintergrund/Struktur (verifiziert):**
- Der Hub (`view-landing`) zeigt aktuell 6 Kacheln (Setup-Manager, Quick-Actions, Mod-HQ, Giveaways, Q&A, Stats).
- Jede Tool-Unterseite besteht aus selbstständigen Karten-Blöcken mit eigener Header/Body-Struktur, z. B.:
  - Quick-Actions: `section.qa-card` (Stream-Manager, Video-Suche/Raid-Finder, Soundboard, Clipping, YouTube-Card …) – jede `qa-card` steht für sich
  - Setup-Manager: `persons-section-card`, `global-extras-card`, Notizen-Card, Send-Card
  - Mod-HQ: Chat-Card, Marker-Card, Watchlist-Card
- **Ausnahme (fest):** „Giveaways & Adressen“ ist eine in sich geschlossene Mehr-Modul-Anwendung → bleibt als Ganzes Kachel, **wird nicht in das Boxen-Dashboard zerlegt**.
- Q&A und Stats sind noch „Geplant“ – ihre Boxen erscheinen erst, wenn die Views implementiert sind (Dashboard-Builder einfach dynamisch: nur fertig implementierte Boxen anbieten).

**Funktionsweise:**
1. Neue Hub-Section **„Mein Dashboard“** oberhalb der Kachel-Grid (oder eigene Kachel „⚙️ Mein Dashboard“ als 7. Kachel, die View #7 `view-mydashboard` öffnet – Variante im Review entscheiden).
2. Dashboard-View zeigt die selektierten Boxen als Karten-Grid (ähnlich `hub-tiles-grid`, aber mit dem echten Funktions-Inhalt statt Beschreibungstext).
   - Jede Box: eigener Header mit **Einklapp-Toggle** (aufgeklappt = volle Funktion, zugeklappt = nur Header + Icon + Titel, Höhe ~48px).
   - Zustand „auf/zu“ pro Box wird gemerkt.
3. **„Dashboard bearbeiten“-Modus:** Button/Icon (Zahnrad) schaltet Edit-Modus an:
   - Checkbox pro Box (aktiv im Dashboard / nicht aktiv)
   - Reihenfolge per Drag & Drop (oder ▲/▼-Buttons – Einfachheit schlägt Drag-Library)
   - „Zurücksetzen“ (Standard-Dashboard)
4. **Verfügbare Boxen (Katalog):** jede Box wird in `renderer.js` als Datenobjekt registriert: `{ id, viewSource: 'view-quickactions', elSelector: '.qa-card-xxx', title, icon }`. Beim Umschalten zwischen Views darf sich eine Box nur an EINER Stelle aktiv finden – wenn sie im Dashboard aktiv ist und das Mod zusätzlich die Original-Tool-Seite öffnet, gilt die Box dort wie heute (kein Doppelausführen; technisch: Box-Element wird per `appendChild` nicht dupliziert, sondern der Dashboard zeigt eine Verknüpfung/Oder die Box bleibt wo sie ist – **entscheidungsbedürftig, s. offene Fragen**).
5. **Persistenz:** Auswahl, Reihenfolge, Auf/Zu-Zustand werden in `dbService.js` (lokal, `userData`) unter z. B. `myDashboard: { boxes: [{id, order, collapsed}] }` gespeichert.
6. Standardzustand (noch nie konfiguriert): Dashboard ist leer mit Hint „Füge Boxen hinzu ⚙️“.

**Definition of Done:**
- [ ] Box-Katalog: alle existierenden Karten-Blöcke aus Quick-Actions, Setup-Manager & Mod-HQ als selektierbare Einträge registriert (Giveaways ausgeschlossen)
- [ ] „Mein Dashboard“-Sicht auf Hub erreichbar, zeigt nur selektierte Boxen mit echtem Funktionsinhalt
- [ ] Pro Box: ein/ausklappbar, Zustand bleibt erhalten
- [ ] Edit-Modus: An/Aus wählen, Reihenfolge, Zurücksetzen
- [ ] Persistenz über Neustart (lokal), Zustand pro Mod-Gerät
- [ ] Keine Duplikate/Verwahrlosung, wenn Original-Tool-Seite und Dashboard gleichzeitig geöffnet sind
- [ ] „Geplant“-Module (Q&A, Stats) tauchen erst nach ihrer Implementierung im Builder auf

**Offene Fragen (im Review entscheiden):**
1. **Doppelnutzung:** Eine Box kann inhaltlich nur an einer Stelle stehen – wenn sie im Dashboard aktiv ist und das Mod die Original-Unterseite öffnet: (a) Box dort ausgegraut mit Hinweis, (b) Box wird in den Dashboard „ausgecheckt“, (c) Box existiert an beiden Stellen (Zustand getrennt). **Empfehlung: (a)** – einfachste, verständlichste Variante.
2. **Cloud-Persistenz:** Dashboard-Layout nur lokal (empfohlen für V1 – es ist Geräte-Kosmetik) oder pro Mod per Gist synchronisiert (damit jeder Mod sein Layout auf jedem Rechner hat)? Gist-Sync pro Mod = größere Gist-Struktur-Änderung, kann später folgen.



