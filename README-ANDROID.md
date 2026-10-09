# Jumpi Games for Android

The app is a full-screen WebView that opens **https://jumpigames.com/play** (always sideways). The game is the website,
so every website update reaches the app right away; a new app build is only needed for changes in `android/`
(icon, name, version, permissions).

- Code: `android/app/src/main/java/com/jumpigames/app/MainActivity.java`, package `com.jumpigames.app`.
- Every push to the `android-app` branch builds it on GitHub (Actions → "Android app"). The results go to the
  branch **`android-build`**: `jumpi-games.apk` (install on a phone), `jumpi-games.aab` (for Google Play), `build-log.txt`.
- No internet: `android/app/src/main/assets/offline.html`.
- The page knows it's in the app: the user agent ends with `JumpiApp/<version>` (the game adds `body.app`).
- Release signing: add the secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`,
  `ANDROID_KEY_ALIAS` in GitHub → Settings → Secrets → Actions. Without them the APK is signed with a debug key
  (fine for testing; a later build then has to be installed after uninstalling the old one).
