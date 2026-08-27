# ShishaWG Mod Setup Tool 💨🛡️

Ein alleinstehendes Windows-Tool für Moderatorinnen und Moderatoren des YouTube & Twitch Kanals **ShishaWG**, um das aktuelle Stream-Setup im Twitch-Chat schnell, grammatikalisch korrekt und intuitiv über den Befehl `!editsetup` anzupassen.

![ShishaWG Mod Tool Logo](./build/icon.png)

---

## 🌟 Features

- 👤 **Twitch-Account Anbindung (OAuth)**:
  - Einloggen mit dem eigenen Twitch-Account (OAuth Implicit / Authorization Code Flow).
  - Zeigt Profilbild, Benutzername und Verbindungskanal.
  - Prüft und stellt sicher, dass der Befehl direkt im eigenen Namen im Chat des Zielkanals (z. B. `#marft` oder `#shishawg`) gesendet wird.

- 👥 **Dynamische Personenanzahl (1 bis 10 Personen)**:
  - Unterstützt bis zu 10 Personen parallel im Stream.
  - Pro Person eigene Eingabefelder für:
    - **Name**
    - **Pfeife**
    - **Kopf**
    - **HMD**
    - **Tabak 1, Tabak 2, Tabak 3** (wird automatisch mit `,` und `und` grammatikalisch richtig verknüpft).

- ⚡ **Exaktes Befehlsschema (`!editsetup`)**:
  - Generiert automatisch den Twitch-Chat-Befehl nach folgendem Muster:
    ```text
    !editsetup Marvin: Amotion Futr // Cosmo Bowl // ONMO HMD // Darkside Shot und Trofimoff Like Zaghoul // Yannick: Amotion Pedal // Hookain LitBowl // Na Grani // Trofimoff Anejo // Magic Cubes (Zauberwürfel) !kohle // Trofimoffs No Aroma Tasting //
    ```

- 🗄️ **integrierte Datenbank & Autovervollständigung**:
  - Vorschläge für beliebte Pfeifen, Köpfe, HMDs, Tabaksorten und Kohle beim Tippen.
  - Eigenes Verzeichnis-Fenster zum Hinzufügen, Bearbeiten und Löschen von Katalog-Einträgen.
  - **Zukunftssicher**: Das Backend ist als modularer Service aufgebaut und kann in Zukunft direkt an eine externe Online-Datenbank (z.B. REST API, Supabase, Firebase) angebunden werden.

- 🎨 **ShishaWG Branding**:
  - Dunkles, modernes Interface angelehnt an `shishawg.de` (Slate-Grau `#0b0f17`, Akzent-Blau `#0099ff` / `#38bdf8`, abgerundete Cards und Hover-Effekte).

- 📦 **Nativ verpackte Windows Exe (.exe)**:
  - Lässt sich als alleinstehende Windows-Anwendung installieren (Setup `.exe`) oder portable nutzen.

---

## 🚀 Installation & Nutzung

1. **Download & Start**:
   - Die `ShishaWG Mod Setup Tool Setup.exe` ausführen und installieren.
2. **Twitch Account verknüpfen**:
   - Oben rechts auf **"Mit Twitch verbinden"** klicken. Es öffnet sich das Twitch-Anmeldefenster im Browser. Nach der Bestätigung ist das Tool sofort einsatzbereit.
3. **Setup anpassen**:
   - Personenanzahl wählen (1 bis 10).
   - Namen, Pfeife, Kopf, HMD und Tabak eintragen.
4. **Senden**:
   - Auf **"🚀 In Twitch-Chat Senden (!editsetup)"** klicken oder den Befehl mit einem Klick in die Zwischenablage kopieren.

---

## 🛠️ Für Entwickler / Selbst Kompilieren

### Voraussetzungen
- [Node.js](https://nodejs.org/) (v18+)
- Git

### Befehle

```bash
# Repository klonen
git clone https://github.com/ShishaWG/swg-mod-setup-tool.git
cd swg-mod-setup-tool

# Abhängigkeiten installieren
npm install

# Anwendung im Entwicklungsmodus starten
npm start

# Windows .exe Installer kompilieren
npm run dist
```

Die fertige `ShishaWG Mod Setup Tool Setup.exe` befindet sich danach im Ordner `dist/`.

---

## 📄 Lizenz
MIT License - Erstellt für das ShishaWG Mod Team.
