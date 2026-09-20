# Supabase-Sicherheitsumstellung

Die Reihenfolge ist verbindlich. Das Lockdown-SQL darf erst ausgeführt werden, wenn die Edge Function und die aktualisierten Clients bereitstehen. Alte Tool-Versionen verwenden noch direkte Datenbankzugriffe und funktionieren nach dem Lockdown nicht mehr vollständig.

## 1. Edge Function vorbereiten

Die Funktion liegt unter `supabase/functions/channel-api/index.ts`.

In Supabase muss für die Function ein langes, zufälliges Secret mit dem Namen `ADDRESS_ENCRYPTION_SECRET` gesetzt werden. Dieses Secret darf nicht in GitHub, die Desktop-App oder die Webseiten geschrieben werden. Optional kann `CORE_MODS` als kommaseparierte Liste gepflegt werden.

Die Function wird mit deaktivierter Supabase-JWT-Pflicht bereitgestellt, weil sie Twitch-Tokens selbst validiert. Datenbankzugriffe erfolgen erst nach dieser Prüfung mit der serverseitigen Service Role.

## 2. Function bereitstellen und prüfen

Die Function `channel-api` deployen. Danach zunächst ohne Datenbank-Lockdown testen:

- Desktop-App mit Twitch verbinden.
- Mod-Chat laden und eine Testnachricht senden.
- Q&A öffnen und eine Frage umschalten.
- Einen Testgewinn anlegen und die Claim-Seite mit dem richtigen Twitch-Konto abschicken.
- Prüfen, dass die neue Adresse in `giveaway_winners.address` als String mit Präfix `v2:` gespeichert wurde.

## 3. Aktualisierte Clients veröffentlichen

Die aktualisierten Dateien unter `docs/` veröffentlichen und eine neue Desktop-Version verteilen. Alle Moderatoren müssen diese Version verwenden, bevor die alten Policies entfernt werden.

## 4. Öffentliche Tabellenzugriffe schließen

Erst danach `scripts/supabase_lockdown_8_0_1.sql` im Supabase SQL Editor ausführen.

Die Migration:

- entfernt sämtliche anonymen Schreibrechte;
- sperrt Gewinner, Mod-Chat, Watchlist, Sessions und Telegram-Konfiguration vollständig für den öffentlichen Schlüssel;
- lässt nur öffentliche Anzeigeinhalte lesbar;
- gibt bei `qna_settings` nur ausdrücklich ungefährliche Spalten frei;
- lässt `broadcaster_token` ausschließlich über die geprüfte Function erreichen.

## 5. Abschlussprüfung

- Claim mit richtigem und falschem Twitch-Konto testen.
- Einen Account testen, der im Zielkanal kein Moderator ist.
- Einen Moderator in einem zweiten Kanal testen; er darf keine Daten von `marved` erhalten.
- OBS-Overlays und öffentliche Q&A-Anzeige testen.
- Polls, Vorhersagen und Telegram-Versand testen.

Die bestehenden Twitch- und Telegram-Tokens werden durch diese Umstellung weder gelöscht noch rotiert.
