# ShishaWG Mod Setup Tool – Test Chat GPT

Stand: 9. September 2026 · Basis: 7.3.0 · Windows x64 portable

## Starten

`dist/ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe` starten. Eine Installation ist nicht erforderlich.

Die vollständige Arbeitskopie liegt unter `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool Chat GPT`. Der ursprüngliche Ordner `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool` wurde nicht bearbeitet. Die SHA-256-Prüfung aller 41 erfassten Originaldateien aus Quellcode, Dokumentation, Tests, Build-Ressourcen und Projektkonfiguration ergab keine Änderung.

Die Testfassung verwendet eigene lokale Einstellungen unter `%APPDATA%\ShishaWG Mod Setup Tool Chat GPT`. Deshalb ist eine neue Twitch-Anmeldung nötig; persönliche Profile müssen gegebenenfalls neu eingerichtet werden. Es wurden keine Zugangsdaten aus dem Originalprofil übernommen.

Das lokale OBS-Overlay verwendet `http://localhost:18943/overlay`, während das Original weiterhin Port 18942 verwendet. Der lokale Q&A-Prompter ist unter `http://localhost:18943/qna` erreichbar. Die bisherigen Cloud-Links sind erhalten.

**Die Online-Dienste sind dieselben wie in der bisherigen Anwendung.** Nach dem Anmelden arbeiten Chat-, Cloud- und Versandfunktionen mit den bestehenden Diensten. Die automatische Prüfung wurde ausschließlich mit isolierten Testdaten und blockierten Netzwerkzugriffen durchgeführt.

## Oberfläche und Bedienung

- Durchgehende Seitennavigation für alle acht Hauptmodule, mit sichtbarer aktiver Ansicht und übernommenen Hinweisen auf ungelesene Nachrichten und Fragen.
- Einheitliche dunkle Oberflächen, zurückhaltende grüne Akzente, konsistente Abstände, Schaltflächen, Formulare, Karten und Dialoge.
- Neuer Überblick mit aktivem Kanal, Verbindungsstatus und direktem Zugang zu den Modulen.
- Setup-Editor mit Personen links, Schnell-Notizen und Extras rechts sowie einer beim Scrollen erreichbaren Befehlsvorschau. Lange Vorschauen sind begrenzt und scrollbar.
- `Strg+K`: Module und Werkzeuge suchen. Pfeiltasten wählen, Enter öffnet, Escape schließt.
- `Alt+1` bis `Alt+9`: Übersicht beziehungsweise Module öffnen. Die bisherigen Shortcuts bleiben erhalten.
- „Ansicht & Startseite“: gewünschtes Startmodul oder zuletzt verwendetes Modul, kompaktere Darstellung und reduzierte Animationen speichern.
- Einklappbare Navigation und Anpassung an kleinere Fenster. Tastaturfokus, Dialogrollen und Tab-Begrenzung innerhalb geöffneter Dialoge ergänzt.
- Katalog, OBS, Ansichtsoptionen und Feedback sind direkt über die Navigation erreichbar.

## Erhaltener Funktionsumfang

| Bereich | Erhaltene Abläufe |
| --- | --- |
| Setup-Manager | 1–10 Personen, Hardware, Bowl/Farbe, E-Geräte, mehrere Tabaksorten, g/%, Aromen, Kohle, Extras, Promo-Ziele, Notizparser, Fuzzy Matching, Import, Kopieren, Twitch-Versand und Auto-Learning |
| Stream-Aktionen | Titel und Kategorie, Befehle, Clips, Raids, YouTube-Suche und gespeicherte Videos |
| Mod-HQ | Team-Chat, 7TV-Emotes, Benachrichtigungen, Stream-Marker, Zeitstempel, Chatter und Watchlist |
| Giveaways | Teilnahme-Modi, Ausschlussfilter, tagesbezogener Gewinnerausschluss, Ziehung, Countdown, Kanalpunkte, manuelle Belohnungslinks, Adressentwürfe, Kohlegrößen, Historie und Telegram-Versand |
| Fragen & Antworten | Listener, Personenfilter, Freigabe/Ablehnung, Duplikate, On-Air-Anzeige, Prompter, Bestrafungen und Statistiken |
| Umfragen & Vorhersagen | Umfragen, Predictions, Ergebnisanzeige, Vorlagen und Kanalpunkte-Optionen |
| Statistiken & Timer | Absolute Startzeiten, Wiederaufnahme, laufendes Setup anpassen, Kohle-/Elektro-Trennung, Vorheizen, Historie und Ranglisten |
| Eigenes Dashboard | Alle sieben Widget-Typen, gemeinsamer Setup-Zustand, Reihenfolge, Breite/Höhe, Einklappen, Layout-Sperre und lokale Persistenz |
| Integrationen | Twitch, Supabase, HookahTools-Katalog, 7TV, YouTube, Telegram, Trello-Feedback, OBS und bestehende Cloud-Portale |

Die Produktionsabhängigkeiten, ihre Versionsvorgaben und die installierten Build-Abhängigkeiten wurden übernommen. Bestehende Datenformate, Verschlüsselung und Cloud-Schnittstellen sind erhalten.

## Konkrete Korrekturen

1. **Setup-Widget:** Der Generator gibt jetzt den erzeugten Befehl zusätzlich als Wert zurück. Zuvor griff das Dashboard auf die Länge von `undefined` zu; das Widget konnte beim Öffnen ausfallen und seine Kopier-/Sendeaktionen erhielten keinen Befehl.
2. **Gemeinsamer Editorzustand:** Beim Wechsel vom Dashboard zum vollständigen Setup-Editor werden auch Tabak- und Gerätefelder aus dem gemeinsamen Zustand neu angezeigt.
3. **Keine ungewollte Namensänderung:** Das bloße Öffnen des Dashboard-Widgets setzt einen leeren Personennamen nicht mehr automatisch auf „Marvin“.
4. **Dashboard-Timer:** „Kohle gewendet“ aktualisiert nun Zähler und Kohletimer, erhält die gesamte Rauchdauer und speichert den Zustand. „Kopf beenden“ öffnet die bestehende Bewertung und Speicherung. Vorher verwiesen diese Aktionen auf nicht vorhandene Funktionen.
5. **Portable-Ressourcen:** Logo, Icon und begleitende HTML-Seiten werden mit verpackt. Insbesondere der lokale Q&A-Prompter benötigt die vorher nicht explizit enthaltenen `docs`-Dateien.
6. **Einstellungen:** Schreiben über eine temporäre Datei, Sicherung der letzten gültigen Version, Wiederherstellung bei beschädigtem JSON und Rücknahme des Speicherzustands bei einem Schreibfehler.
7. **Fenstergrenze:** Die Oberfläche hat keinen direkten Node-Zugriff mehr. Ein isoliertes, sandboxed Preload stellt nur die erfassten App-Schnittstellen bereit. Externe URLs werden auf HTTP/HTTPS beschränkt; Fremdseiten öffnen nicht im App-Fenster. Grundlage ist die [Electron-Dokumentation zur Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).

Reguläre Releases können weiterhin geöffnet werden. Automatisches Herunterladen und Drüberinstallieren regulärer Releases ist in dieser gekennzeichneten Testvariante gesperrt, damit der Rework beim Testen erhalten bleibt. Der bisherige Updater-Code und seine Schnittstellen sind weiter vorhanden.

## Neue Quellstruktur

- `src/renderer/modules/`: elf Fachbereiche für Workspace/Anmeldung, Setup, Stream-Aktionen, YouTube, Mod-HQ, Giveaways, Q&A/Umfragen, Vorhersagen, Timer/Statistiken, Feedback und Dashboard.
- `src/renderer/workspace.js` und `workspace.css`: Navigation, Suche, Ansichtspräferenzen und das übergreifende Design.
- `src/main/preload.template.cjs` und `src/shared/ipc-contract.json`: eingeschränkte Brücke zwischen Oberfläche und Hauptprozess.
- `src/main/runtime.js`, `settings-store.js`, `window-security.js`: Testidentität, lokale Einstellungen und Fenster-/Linkregeln.
- `scripts/build-renderer.cjs`: setzt die elf Fachdateien in festgelegter Reihenfolge zum Renderer zusammen und erzeugt das Preload. Der gemeinsame Zustand bleibt kompatibel. **`renderer.js` und `preload.js` sind erzeugte Dateien; Änderungen an den Quelldateien vornehmen.**
- `scripts/build-portable.cjs`: erstellt ausschließlich den portablen x64-Testbuild, ohne Veröffentlichung. Vorhandene lokale Electron-Dateien und Caches werden verwendet.
- `scripts/qa/`: reproduzierbare Offline-Fensterprüfung mit Testdaten.
- `scripts/verify-package.cjs`: vergleicht zentrale verpackte Dateien mit der Arbeitskopie.

Im Projektordner sind `npm start`, `npm test` und `npm run dist:test` verfügbar. Die erforderliche Renderer-Erzeugung ist jeweils vorgeschaltet. Das Quellcode-ZIP enthält Quellcode, Tests, Konfiguration und Ressourcen; installierte Abhängigkeiten und Build-Caches liegen in der vollständigen Arbeitskopie im Downloads-Ordner.

## Prüfergebnis und Grenzen

| Prüfung | Ergebnis |
| --- | --- |
| Bisherige Tests vor dem Rework | 48 / 48 erfolgreich |
| Gesamte Testsuite nach dem Rework | 63 / 63 erfolgreich, einschließlich aller bisherigen Tests |
| Direkter Vergleich der Befehlsgenerierung | 240 Varianten identisch zum eingefrorenen Original 7.3.0 |
| Bestandsabgleich | 419 ursprüngliche UI-IDs, 157 ursprüngliche Renderer-Funktionen, 94 Hauptprozess-Schnittstellen erhalten |
| Fensterprüfung der Arbeitskopie | 38 Prüfungen erfolgreich, keine Renderer-Fehler |
| Fensterprüfung der verpackten App | 38 Prüfungen erfolgreich, keine Renderer-Fehler |
| Ansichten und Bildschirmgrößen | Alle Module, alle sieben Dashboard-Widgets, 1440 × 960 und 960 × 700; 16 Bildschirmaufnahmen pro vollständigem Lauf |
| Paketvergleich | 15 zentrale Dateien einschließlich Preload, UI, Logo und Portalen bytegenau geprüft |
| Portable-Datei | Erfolgreich gebaut; Archivintegrität geprüft |
| Originaldateien | 41 SHA-256-Vergleiche, 0 Änderungen |

Die Fensterprüfung lädt den echten Renderer und das echte Preload aus dem verpackten App-Archiv in Electron. Externe App-Aufrufe werden durch lokale Antworten ersetzt. Dabei wurden unter anderem Dashboard-Eingabe, Kopieren, simuliertes Senden mit Timer-/OBS-Folgeaktionen, Kohlewechsel, Abschlussdialog, alle Widgets, Layout-Sperre, Suche, Navigation und die zehn Personen geprüft.

Eine echte Twitch-Anmeldung, reale Chat-/Cloud-Änderungen, Telegram-Versand und ein OBS-Livebetrieb wurden nicht ausgeführt. Ebenso ersetzt die Prüfung des verpackten Inhalts keinen manuellen Test der portablen Entpackroutine auf anderen Windows-Rechnern. Die Tests belegen den geprüften Umfang; sie sind keine Garantie für jeden möglichen Live-Zustand externer Dienste.
