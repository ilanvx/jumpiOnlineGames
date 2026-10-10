# Jumpi Games for iPhone and iPad (TestFlight)

Same idea as the Android app: a full-screen web view of **https://jumpigames.com/play**, always sideways,
"JumpiApp/<version>" in the user agent (so the game hides the paid store and Discord), other pages open in Safari,
and a "no internet" page with TRY AGAIN. Code: `ios/Jumpi/GameViewController.swift`. Bundle id **com.jumpigames.jumpi**.

The project file is made on GitHub's Mac with XcodeGen from `ios/project.yml`. The workflow `.github/workflows/ios.yml`
runs when `ios/` changes on the `android-app` branch (or by hand in Actions → "iOS app" → Run workflow), archives the
app, signs it automatically with the App Store Connect API key and uploads it to TestFlight. Log: branch `ios-build`.

## One-time setup (Ilan)
1. Apple Developer Program membership (developer.apple.com, $99 a year).
2. App Store Connect → Apps → **+** → New App: iOS, name JUMPI, bundle id **com.jumpigames.jumpi**
   (register it first under Certificates, Identifiers & Profiles → Identifiers if it isn't in the list), SKU e.g. `jumpi`.
3. App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → **+**, access **Admin**
   (needed so the build can make its own signing certificate). Download the `.p8` (only once!), note the Key ID and the Issuer ID.
4. Team ID: developer.apple.com → Account → Membership details.
5. GitHub → the repo → Settings → Secrets and variables → Actions → New repository secret:
   `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`, `APPSTORE_KEY_P8` (open the .p8 in Notepad and paste all of it).
6. Actions → "iOS app" → Run workflow. About 10 minutes later the build appears in App Store Connect → TestFlight.

## Testers
- Internal testing (up to 100 people from your App Store Connect team): no review, available right away.
- External testing (anyone, by email or a public link, up to 10,000): the first build goes through a short Beta App Review.
- Testers install the free **TestFlight** app on the iPhone and open the invite.
