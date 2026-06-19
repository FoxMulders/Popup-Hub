# Universal links & app links

Replace placeholders before production store submission.

## iOS — `apple-app-site-association`

File: `public/.well-known/apple-app-site-association`

Replace `TEAM_ID` in `appID` with your Apple Developer **Team ID** (10-character string from [developer.apple.com/account](https://developer.apple.com/account) → Membership).

Example: `"appID": "AB12CD34EF.ca.popuphub.app"`

Deploy to `https://popuphub.ca/.well-known/apple-app-site-association` (no file extension; `Content-Type: application/json`).

Enable **Associated Domains** in Xcode: `applinks:popuphub.ca`.

## Android — `assetlinks.json`

File: `public/.well-known/assetlinks.json`

Replace `REPLACE_WITH_YOUR_RELEASE_KEY_SHA256` with the SHA-256 fingerprint of your **release** signing key:

```bash
keytool -list -v -keystore your-release.keystore -alias your-alias
```

Deploy to `https://popuphub.ca/.well-known/assetlinks.json`.

See also `PM/ios-testflight.md` and `PM/android-play-console.md`.
