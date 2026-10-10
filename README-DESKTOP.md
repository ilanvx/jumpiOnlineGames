# Jumpi Games for Windows (desktop/)

The game (https://jumpigames.com/play) in its own window, built with Electron.

- **Installer** (NSIS): Jumpi art on the welcome / finish pages, choose a folder, an "Almost ready!" page with a
  Desktop-shortcut checkbox, a progress bar, and "Run Jumpi Games" at the end. Always in the Start menu.
- **Splash**: the Jumpi banner with a loading bar while the game opens.
- **Updates**: every start checks GitHub Releases. A new version downloads with a progress bar in the same splash
  ("Updating Jumpi Games"), installs silently and the game opens again. Found while playing → installs on next close.
- In the app the page gets `JumpiApp/<version>` in its user agent (body.app: no paid store, no Discord), like the phone apps.

## Build / release
Push a change in `desktop/` to the `android-app` branch → GitHub Actions ("Windows app") builds version `1.0.<run>`
and publishes a GitHub Release with `Jumpi-Games-Setup.exe` + `latest.yml`. Download link:
https://github.com/ilanvx/jumpiOnlineGames/releases/latest/download/Jumpi-Games-Setup.exe (the site: `/download/windows`).

The installer is not code-signed yet, so Windows SmartScreen shows "Windows protected your PC" the first time
(More info → Run anyway). A code-signing certificate removes that.
