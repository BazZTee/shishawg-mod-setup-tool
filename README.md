# 💨 ShishaWG Mod Setup Tool (v7.0.7)

Das ultimative Moderator- und Stream-Management-Tool für das Moderatoren-Team des Twitch-Kanals **ShishaWG**. Entwickelt für schnelles Erstellen, Importieren, Verwalten und Live-Senden von Shisha-Setups, Giveaways, Q&A-Sessions, Stream-Aktionen und Cloud-Synchronisation in Echtzeit.

---

## 📑 Inhaltsverzeichnis

- [✨ Highlights & Neuerungen in v7.0.7](#-highlights--neuerungen-in-v707)
- [🎛️ Die Module im Überblick](#️-die-module-im-überblick)
  - [1. 💬 Setup Generator & Chat-Befehl](#1--setup-generator--chat-befehl)
  - [2. ⚡ Quick-Actions & Stream-Manager](#2--quick-actions--stream-manager)
  - [3. 🎁 Giveaway-Portal & Adress-Manager](#3--giveaway-portal--adress-manager)
  - [4. ❓ Live Q&A & Twitch-Umfragen](#4--live-qa--twitch-umfragen)
  - [5. 👥 Team Mod-Chat & Watchlist](#5--team-mod-chat--watchlist)
  - [6. 📦 Tabak- & Hardware-Katalog](#6--tabak--hardware-katalog)
  - [7. 🎥 OBS Studio Overlay-Server](#7--obs-studio-overlay-server)
- [🔘 Erklärung der wichtigsten Knöpfe & Steuerelemente](#-erklärung-der-wichtigsten-knöpfe--steuerelemente)
- [⌨️ Tastaturkürzel (Hotkeys)](#️-tastaturkürzel-hotkeys)
- [🔄 Streamer-Profile & Multi-Channel Support](#-streamer-profile--multi-channel-support)
- [🚀 Installation & Updates](#-installation--updates)

---

## ✨ Highlights & Neuerungen in v7.0.7

- 🪵 **Kohle-Größen-Auswahl bei Einlösungen (26er vs. 27er Kohle)**: Zuschauer können auf der Gewinner-Seite bei Kohle-Prämien nun direkt ihre Wunschgröße auswählen (**26er Kohle (26mm)** oder **27er Kohle (27mm)**). Die Auswahl wird in der Adressmaske, in der Historie und in der Telegram-Nachricht an Marvin lückenlos angezeigt (nur bei Kohle-Einlösungen, nicht bei normalen Giveaways).
- 👤 **Gewinner-Avatar Anzeige Fix**: Twitch-Profilbilder von Gewinnern und Kanalpunkte-Einlösern werden nun immer zuverlässig geladen (inklusive dynamischem Unavatar/Helix-Fallback).
- ⚡ **All-In-One eShisha-Unterstützung (z.B. `XKAH Shii`)**: Wird ein All-In-One Gerät als `⚡ E-Gerät` ausgewählt, wird es in den Statistiken und Analytics automatisch voll als Pfeife und Kopf gewertet. Im Twitch-Chat-Befehl wird es intelligent dedupliziert.
- 🎥 **YouTube-Finder Kanal-Zuordnung Fix**: Videos werden nun exakt dem tatsächlichen Uploader-Kanal zugeordnet (`SHISHAWG` in Rot vs. `MARVOCADO` in Blau).
- 📊 **Stats & Session-Historie Fix**: Tabaksorten, Pfeifen, Köpfe und HMDs werden beim Beenden eines Kopfes nun immer vollständig und exakt aus dem aktiven Setup übernommen (kein „Unbekannter Tabak“ mehr).
- 👑 **Mod-Prioritäts-Kaskade & Anti-Doppelpost-Schutz**: Automatische Chat-Antworten folgen einer festen Kaskade: **`BazZTeeDJ` (Sofort)** ➔ **`flashmobnbg` (2,5s Backup)** ➔ **Restlicher Mod-Pool (5s)**.

- 🔗 **Persistente IRC-Architektur**: Eine einzige, extrem stabile WebSocket-Verbindung zu Twitch mit automatischem Reconnect nach 5 Sekunden – kein Verbindungsabriss mehr bei langen Streams.
- 🏆 **Tagesbasierter Giveaway-Ausschluss**: Gewinner werden jetzt tagesbasiert geprüft. Wer heute bereits gewonnen hat, wird freundlich per Bot im Chat benachrichtigt; an Folgetagen darf jeder wieder mitmachen.
- 🎰 **Chat-Countdown beim Auslosen**: Animierter 3-Sekunden-Countdown (`3... 2... 1...`) direkt im Twitch-Chat bei jeder Verlosung.
- ⚡ **Sofortige Befehlsbereitschaft**: Schnelle Notizen, Fuzzy-Matching und Setup-Importe aktivieren den Senden-Button und Tastatur-Shortcuts ohne manuelle Klicks.
- ☁️ **Supabase Realtime Cloud**: Nahtlose Synchronisation aller Setups, Gewinner, Mod-Nachrichten und Watchlist-Einträge zwischen allen aktiven Mods.

---

## 🎛️ Die Module im Überblick

### 1. 💬 Setup Generator & Chat-Befehl
- **Dynamisches Personen-Grid (1 bis 10 Personen)**:
  - Name, Pfeife, Bowl/Kopf, HMD, E-Gerät-Modus (z.B. OOKA, X-Kah) und Bowl-Farben.
  - Dynamische Tabak-Slots: Beim Eintippen der letzten Sorte öffnet sich automatisch der nächste Slot.
  - Optionale Mengenangaben in Gramm (`g`) oder Prozent (`%`).
- **Schnell-Notizen mit Fuzzy-Matching (<kbd>Strg+N</kbd>)**:
  - Freitext aus Stream-Notizen einfügen – der Parser erkennt Personen, Hardware und Tabaksorten automatisch und füllt die Felder passend aus.
- **Setup-Import**:
  - `!setup` direkt aus dem Chat abrufen oder aus der Zwischenablage einlesen.
- **Globale Extras & Promo-Codes**:
  - Kohle (`input-global-kohle`), Tastings und Rabatt-Codes (`!kohle`, `!xk`) wahlweise hinter Pfeife, Kopf, HMD oder als Extra anhängbar.
- **Twitch-Chat Live-Vorschau**:
  - Authentische Chatzeile mit farbigem Mod-Badge und Zeichenzähler (`0 / 500`).

### 2. ⚡ Quick-Actions & Stream-Manager
- **Stream-Informationen**: Stream-Titel und Spiel/Kategorie (z.B. *Just Chatting*) in Sekundenschnelle aktualisieren.
- **Stream-Marker**: Wichtige Momente während des Streams für den späteren Schnitt mit Zeitstempel markieren.
- **Sofort-Clip**: Erstellt auf Knopfdruck einen Twitch-Clip und kopiert den Link.
- **Raid-Manager**: Zielkanal suchen, Raid starten oder abbrechen.
- **Chat-Moderation**: Chat leeren, Emote-Only, Sub-Only oder Slow-Mode umschalten.

### 3. 🎁 Giveaway-Portal & Adress-Manager
- **Teilnahme-Modi**: Keyword-Modus (z.B. `!join`) oder Chatters-Modus (alle aktiven Zuschauer).
- **Smarte Ausschluss-Filter**:
  - 🚫 Bots ausschließen (Nightbot, StreamElements, etc.)
  - 🛡️ Moderatoren ausschließen
  - 📋 Watchlist-User ausschließen
  - 🏆 Heutige Gewinner ausschließen (mit Anti-Spam-geschützter Chat-Erklärung)
- **Gewinner-Ermittlung**:
  - Animierte Roulette-Ziehung im Tool.
  - Paralleler 3-Sekunden-Countdown im Twitch-Chat.
  - Automatische Chat-Benachrichtigung mit persönlichem Adresslink.
- **Kanalpunkte-Integration**:
  - Automatisches Erfassen von Kanalpunkte-Einlösungen (z.B. *1KG Zauberwürfel FREE!*).
- **Adress-Review & Telegram-Export**:
  - Überprüfung eingehender Lieferadressen.
  - Ein-Klick-Versand der Adressdaten an den internen Telegram-Versandkanal.

### 4. ❓ Live Q&A & Twitch-Umfragen
- **Zuschauerfragen**:
  - Automatischer Listener auf `!frage`, `!q` und `!question`.
  - Fragen genehmigen, ablehnen oder als beantwortet archivieren.
  - On-Air-Schaltung zur Einblendung im OBS-Stream.
- **Twitch Helix Polls**:
  - Eigene Umfragen mit flexibler Dauer (1–5 Min) und Kanalpunkte-Stimmen starten.
  - Vorlagen-System für wiederkehrende Fragen (z.B. *„Welcher Kopf als nächstes?“*).
- **Glücksrad**:
  - Interaktives Rad für Fragen-Auswahl und Bestrafungs-Aufgaben.

### 5. 👥 Team Mod-Chat & Watchlist
- **Interner Team-Chat**: Echtzeit-Kommunikation für das Mod-Team während des Streams – unabhängig vom öffentlichen Twitch-Chat.
- **Gemeinsame Watchlist**: Verdächtige User oder Trolle mit Grund, Datum und Risikostufe markieren.
- **Kohletimer & Session-Tracking**: Startzeit von Shisha-Köpfen stoppen, um rechtzeitig neue Kohlen aufzulegen.

### 6. 📦 Tabak- & Hardware-Katalog
- **5.900+ Tabaksorten**: Integrierter Katalog via HookahTools mit Marken- und Geschmackssuche.
- **Eigene Einträge**: Eigene Tabake, Pfeifen, Köpfe, HMDs und Kohlesorten anlegen und editieren.
- **Auto-Learning**: Unbekannte Sorten aus Chat-Setups werden auf Wunsch automatisch in den Katalog übernommen.

### 7. 🎥 OBS Studio Overlay-Server
- Lokaler WebSocket-Server auf Port `18942`.
- Bereitstellung von Browser-Quellen für OBS:
  - Setup-Banner (aktuelle Pfeife, Kopf, Tabak)
  - Q&A Frage-Banner (aktuelle Frage auf dem Bildschirm)
  - Kohletimer-Widget

---

## 🔘 Erklärung der wichtigsten Knöpfe & Steuerelemente

| Button / Element | Symbol / Label | Funktion |
| :--- | :--- | :--- |
| `#btn-send-chat` | 📤 **In Twitch-Chat Senden (!editsetup)** | Sendet den generierten Setup-Befehl via Bot direkt in den Kanal. |
| `#btn-copy` | 📋 **Kopieren** | Kopiert den aktuellen Befehl in die Windows-Zwischenablage. |
| `#btn-reset-all` | 🗑️ **Zurücksetzen** | Leert das gesamte Formular, Notizen und Extras für ein neues Setup. |
| `#btn-fetch-chat-setup` | 📥 **Chat-Setup holen** | Fragt das aktuell im Chat hinterlegte `!setup` ab und befüllt die Felder. |
| `#btn-toggle-notes` | 📝 **Notizen** | Öffnet das Schnell-Notizen-Pad für automatisches Fuzzy-Matching. |
| `#btn-show-onboarding` | ❓ **Hilfe** | Blendet die Schritt-für-Schritt-Anleitung für Moderatoren wieder ein. |
| `#btn-start-giveaway` | ▶️ **Registrierung Starten** | Startet den Chat-Listener für Giveaway-Teilnehmer und postet die Ansage. |
| `#btn-stop-giveaway` | ⏹️ **Registrierung Stoppen** | Schließt den Lostopf für neue Teilnehmer. |
| `#btn-draw-winner` | 🎲 **GEWINNER AUSLOSEN** | Startet die Roulette-Animation und den Chat-Countdown zur Gewinnerziehung. |
| `#btn-send-winner-telegram` | ✈️ **An Telegram Senden** | Übermittelt die geprüfte Lieferadresse an das Logistik-Team. |
| `#btn-check-updates` | 🔄 **v7.0.7** | Prüft manuell auf neue Releases auf GitHub. |

---

## ⌨️ Tastaturkürzel (Hotkeys)

| Tastenkombination | Aktion |
| :--- | :--- |
| <kbd>Strg</kbd> + <kbd>Enter</kbd> | **Befehl senden**: Überträgt das fertige Setup sofort in den Twitch-Chat. |
| <kbd>Strg</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | **Befehl kopieren**: Kopiert den `!editsetup`-Text in die Zwischenablage. |
| <kbd>Strg</kbd> + <kbd>L</kbd> | **Alles leeren**: Setzt das gesamte Setup-Formular zurück. |
| <kbd>Strg</kbd> + <kbd>N</kbd> | **Schnell-Notizen**: Öffnet oder schließt das Notizen-Pad und fokussiert das Textfeld. |
| <kbd>ESC</kbd> | **Hauptmenü**: Schließt geöffnete Modale oder kehrt zur Mod-Zentrale zurück. |

---

## 🔄 Streamer-Profile & Multi-Channel Support

Über das Profil-Menü oben rechts kann flexibel zwischen verschiedenen Kanälen und Streamern gewechselt werden:
- **Marved** (`#marved`)
- **Kai**
- **Eigene Profile** mit separatem Zielkanal, Bot-Account und Telegram-Tokens anlegbar.

Beim Profilwechsel passen sich alle Chat-Befehle, Q&A-Listener und Giveaway-Einstellungen automatisch an den gewählten Zielkanal an.

---

## 🚀 Installation & Updates

### Portable Version (ohne Installation)
1. Die Datei `ShishaWG-Mod-Setup-Tool-Portable-7.0.7.exe` aus dem [Release-Bereich](https://github.com/BazZTee/shishawg-mod-setup-tool/releases) herunterladen.
2. An einem beliebigen Ort ausführen – keine Administratorrechte erforderlich.

### Setup Installer
1. Die Datei `ShishaWG-Mod-Setup-Tool-Setup-7.0.7.exe` herunterladen und ausführen.
2. Installiert die App im Benutzerverzeichnis und erstellt eine Desktop-Verknüpfung.

### Automatisches Update
Die App verfügt über einen integrierten Auto-Updater. Sobald ein neues Release auf GitHub verfügbar ist, erscheint ein Update-Banner in der Kopfzeile.

