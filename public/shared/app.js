/*
  The Jumpi Android app (built from the "android-app" branch on GitHub, see README-ANDROID.md there).
  PHONES_NEED_APP: true = on a phone's web browser the game shows "Get the app" instead of the game
  (Android: download the app; iPhone: play on a computer). Computers and the app itself always play.
  Switch it on only after the APK was tested on a real phone.
*/
export const PHONES_NEED_APP = false;
// where the "DOWNLOAD FOR ANDROID" button goes: the APK on our server (public/download/jumpi-games.apk via
// /download/android), or the Google Play page once the app is there (then put that link here)
export const ANDROID_DOWNLOAD = "/download/android";
export const GOOGLE_PLAY_URL = "";
// false = the app downloads are closed for now: /download/android and the APK file don't download (server.js sends
// people to the home page), and the "Download for Android" and "Microsoft Store" buttons on the website do nothing
// (public/site/chrome.js). Set to true to open them again.
export const APP_DOWNLOADS_OPEN = false;
