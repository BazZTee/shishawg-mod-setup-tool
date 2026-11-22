# Umbauplan: Android-App (APK) – 22.11.2026

## Ausgangslage

- Die App ist eine Electron-App (Version 8.0.3). Die Oberfläche in `src/renderer` ist reines HTML/JS/CSS.
- Die Oberfläche spricht den Hintergrundteil nur über **eine** Brücke an: `window.swgBridge.invoke(kanal, …)` und `swgBridge.on(ereignis, …)` (`src/main/preload.js`). Die Liste der Kanäle steht in `src/shared/ipc-contract.json` (über 100 Kanäle).
- Der Hintergrundteil (`src/main`, rund 6.300 Zeilen) nutzt Node.js und Electron: `fs`, `http`, `crypto`, `ws`, `clipboard`, `shell`, `Notification` und `electron-updater`.

**Kernidee:** Für Android wird nur die Brücke ausgetauscht. Eine zweite Umsetzung von `swgBridge` in reinem Browser-JS bedient dieselben Kanäle. Die Oberfläche selbst bleibt unverändert.

## Technik

- **Capacitor** (Android-WebView-Hülle) mit der vorhandenen Oberfläche als Web-Inhalt.
- Plugins: `@capacitor/preferences` (Einstellungen), `@capacitor/filesystem` (größere JSON-Daten), `@capacitor/clipboard`, `@capacitor/browser` (externe Links), `@capacitor/local-notifications`, `@capacitor/app` (Deep Links).
- `@supabase/supabase-js` läuft im Browser unverändert. Für WebSocket wird der eingebaute `WebSocket` statt `ws` benutzt.

## Phasen

### Phase 0 – Vorbereitung (klein)
1. Gemeinsame Logik, die nicht von Node abhängt, nach `src/shared` verschieben: Twitch-API-Aufrufe, Katalog-Logik, Supabase-Zugriffe. Ziel: Desktop und Android nutzen denselben Code.
2. Speicherzugriffe hinter eine kleine Schnittstelle legen (`storage.get/set/readJson/writeJson`). Unter Electron steckt `fs` dahinter, unter Android Capacitor.
3. Die vorhandenen Tests laufen danach weiterhin grün.

### Phase 1 – Grundgerüst (mittel)
1. Verzeichnis `mobile/` mit Capacitor-Projekt anlegen (`npx cap init`, `npx cap add android`).
2. Das Build-Skript (`scripts/build-renderer.cjs`) so erweitern, dass es die Oberfläche zusätzlich nach `mobile/www` kopiert und dort `bridge-android.js` statt der Preload-Brücke einbindet.
3. `bridge-android.js`: dieselbe `invoke`/`on`-Form wie in `preload.js`, mit derselben Kanal-Liste aus `ipc-contract.json`. Kanäle, die noch nicht umgesetzt sind, geben den klaren Fehler „Auf Android nicht verfügbar“ zurück.
4. Das Layout für Handybreite prüfen (Dashboard, Seitenleiste, Dialoge) und Anpassungen per `@media` vornehmen, ohne die Desktop-Ansicht zu verändern.

### Phase 2 – Kernfunktionen (groß)
Reihenfolge nach Nutzen für Mods unterwegs:

| Bereich | Kanäle | Umsetzung auf Android |
|---|---|---|
| Twitch-Login | `twitch:login/logout/check-auth/save-token` | **Device Code Flow** von Twitch statt lokalem Server: Code anzeigen, im Browser bestätigen, Token abholen. Braucht keine Redirect-URI. |
| Twitch-API | `twitch:*` (Titel, Spiel, Marker, Clip, Raid, Umfragen, Vorhersagen …) | `fetch` direkt auf die Helix-API, Logik aus `twitchService.js` übernehmen |
| Chat | `twitch:send-chat*`, Listener (Q&A, Giveaway, Kanalpunkte) | Browser-`WebSocket` auf `wss://irc-ws.chat.twitch.tv` bzw. EventSub |
| Katalog/Setup | `db:*`, `profiles:*`, `obs:publish-setup` | `dbService.js` mit der Speicher-Schnittstelle, Supabase wie bisher |
| Mod-Chat | `modchat:*` | Supabase, unverändert |
| Q&A, Giveaway, Stats, Watchlist, Marker, Strafen | jeweilige Kanäle | Supabase oder lokaler Speicher |
| Trello, Telegram, 7TV, YouTube | `app:send-trello-card`, `giveaway:send-telegram`, … | `fetch` – vorher prüfen, ob die Dienste CORS aus der WebView erlauben, sonst `CapacitorHttp` nutzen |
| Zwischenablage, Links, Hinweise | `app:copy-clipboard`, `app:open-external`, `app:notify-background` | Capacitor-Plugins |

**Verschlüsselung (`crypto.js`):** AES-256-GCM gibt es in WebCrypto. `scrypt` gibt es dort nicht. Der Schlüssel wird aus festen Werten abgeleitet, deshalb kann er einmalig vorberechnet oder mit `scrypt-js` erzeugt werden. Das Datenformat (iv + authTag + Ciphertext) muss gleich bleiben, damit Desktop und Android dieselben Daten lesen.

### Phase 3 – Was wegfällt oder anders läuft
- **OBS-Overlay-Server** (`127.0.0.1`): Auf dem Handy nicht sinnvoll. `obs:get-info` meldet „nur am PC“. Das Setup wird trotzdem über Supabase veröffentlicht, das Overlay kommt weiterhin vom PC.
- **Auto-Updater**: Wird ersetzt durch eine Prüfung der neuesten GitHub-Release-Version mit dem Hinweis „Neue APK herunterladen“.
- **Laufen im Hintergrund**: Android beendet Chat-Listener, sobald die App im Hintergrund ist. Listener laufen also nur bei geöffneter App. Das wird in der Oberfläche so angezeigt.

### Phase 4 – Release über GitHub (klein)
1. Einen Keystore einmalig erzeugen und **nicht** ins Repository legen. Er wird als GitHub-Secrets hinterlegt (`ANDROID_KEYSTORE_BASE64`, Passwort, Alias).
2. Ein Workflow `.github/workflows/android.yml` läuft bei jedem Tag `v*`: Node einrichten, `npm ci`, `build:renderer`, `npx cap sync android`, `./gradlew assembleRelease`, signieren, `ShishaWG-Mod-Setup-Tool-<version>.apk` an das Release hängen.
3. Die Versionsnummer kommt aus `package.json` (`versionName`, `versionCode`).
4. In die Release-Notes kommt ein Hinweis: „Installation aus unbekannten Quellen erlauben“.

## Risiken / offene Punkte

- **Doppelte Pflege:** Jede neue Funktion braucht künftig auch einen Android-Kanal. Phase 0 (gemeinsamer Code) verringert das deutlich.
- **CORS:** Einige Dienste lassen Aufrufe aus der WebView eventuell nicht zu. Das muss in Phase 2 je Dienst getestet werden.
- **Token-Speicher:** `@capacitor/preferences` speichert unverschlüsselt. Für das Twitch-Token besser ein Secure-Storage-Plugin (Android Keystore) verwenden.
- **Play Store:** Nicht geplant, nur APK über GitHub. Play Protect kann beim Installieren warnen.

## Empfohlener Einstieg

Phase 0 und 1, dazu aus Phase 2 nur der Twitch-Login und das Senden des Setups. Damit gibt es früh eine installierbare Test-APK, mit der sich das Konzept prüfen lässt, bevor alle Kanäle umgesetzt werden.
