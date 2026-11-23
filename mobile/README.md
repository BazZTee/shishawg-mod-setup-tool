# Android-App (Capacitor)

Die Android-App nutzt **denselben Code** wie die Desktop-App:

- Oberfläche: `src/renderer` (unverändert)
- Hintergrund: `src/main` läuft in der WebView. Node- und Electron-Module werden beim Bauen durch die Ersatzmodule in `mobile/shims` ersetzt (Dateien → IndexedDB, `https` → `fetch`, `ws` → Browser-WebSocket, `crypto` → crypto-browserify + scrypt-js).
- Twitch-Login: Die Login-Seite öffnet sich im In-App-Browser, die Weiterleitung auf `http://localhost:17525/auth` wird abgefangen und an den normalen Login-Code übergeben.

Nicht auf Android: OBS-Overlay-Server (läuft weiter vom PC), Auto-Updater (stattdessen Hinweis auf neue APK im GitHub-Release), Chat-Listener im Hintergrund.

## Befehle (im Ordner `mobile`)

```powershell
npm install
npm run build      # mobile/www erzeugen
npm run serve      # Vorschau im Browser: http://127.0.0.1:5179
npm test           # Tests der Ersatzmodule
npm run sync       # build + in das Android-Projekt kopieren
npm run apk:debug  # Debug-APK (braucht Android SDK + JDK 21)
```

## Release über GitHub

Der Workflow `.github/workflows/android.yml` läuft bei jedem veröffentlichten Release und hängt die signierte APK an. Benötigte Repository-Secrets:

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Keystore-Datei als Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort des Keystores |
| `ANDROID_KEY_ALIAS` | Alias des Schlüssels |
| `ANDROID_KEY_PASSWORD` | Passwort des Schlüssels |

Ohne diese Secrets baut der Workflow nur eine Debug-APK als Artefakt. **Den Keystore sicher aufbewahren:** Ohne denselben Schlüssel lassen sich spätere Versionen nicht als Update über die installierte App installieren.

Keystore erzeugen (PKCS12, Alias `shishawg`; Keystore- und Schlüsselpasswort sind gleich):

```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE\shishawg-release.keystore" -alias shishawg -keyalg RSA -keysize 4096 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\shishawg-release.keystore")) | Set-Clipboard
```

Wichtig: GitHub nimmt den Workflow aus dem Stand, den das Release-Tag markiert. `mobile/` und der Workflow müssen also im Branch liegen, aus dem Releases getaggt werden.

Lokal (Emulator-Tests) werden nur Debug-APKs gebaut: JDK 21 als `JAVA_HOME`, Android SDK als `ANDROID_HOME`.
