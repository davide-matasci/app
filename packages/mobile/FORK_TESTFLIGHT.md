# Building this fork for your own iPhone (TestFlight)

The `Fork iOS TestFlight` workflow builds the iOS app on a GitHub-hosted Mac,
signs it with your Apple Developer account and uploads it to TestFlight. No Mac
is needed. Your bundle ID and team are swapped in at build time, so nothing
account-specific is committed.

Differences from the upstream app in this build:

- The "Share To SN" share extension is not embedded (it needs an extra App ID
  and an App Group).
- The associated-domains entitlement for `app.standardnotes.com` is removed
  (it only works for the upstream app ID).
- In-app purchases will not load; subscriptions tied to your account still work.
- The home-screen name defaults to "Notes Fork". The icon is still upstream's.

## One-time setup

All of this can be done in a phone browser.

### 1. Apple Developer portal (developer.apple.com/account)

1. Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App.
2. Description: anything. Bundle ID: *Explicit*, e.g. `com.yourname.notes`.
3. Tick the **Data Protection** capability (Complete Protection). Register.

### 2. App Store Connect (appstoreconnect.apple.com)

1. Apps → **+** → New App. Platform iOS, any name, pick the bundle ID from
   step 1, SKU: anything.
2. Users and Access → Integrations → App Store Connect API → generate a team
   key with the **App Manager** role. Note the **Key ID** and **Issuer ID** and
   download the `.p8` file (it can only be downloaded once).
3. In the app's TestFlight tab, create an internal testing group and add
   yourself.

### 3. GitHub

1. Create an empty **private** repository named `ios-certificates`. The
   encrypted signing certificate and profile are stored there.
2. Create a fine-grained personal access token (Settings → Developer settings)
   limited to that repository, with **Contents: Read and write**.
3. In this fork: Settings → Secrets and variables → Actions → add these
   repository secrets:

| Secret | Value |
| --- | --- |
| `IOS_BUNDLE_ID` | the bundle ID from step 1 |
| `APPSTORE_CONNECT_KEY_ID` | Key ID |
| `APPSTORE_CONNECT_KEY_ISSUER_ID` | Issuer ID |
| `APPSTORE_CONNECT_KEY` | full text of the `.p8` file |
| `MATCH_GIT_TOKEN` | the personal access token |
| `MATCH_PASSWORD` | any long passphrase you invent (encrypts the certificate) |

Optional repository variables: `IOS_DISPLAY_NAME` (home-screen name),
`MATCH_CERTIFICATES_REPO` (`owner/repo`, if not `<you>/ios-certificates`).

## Building

Actions → **Fork iOS TestFlight** → Run workflow. When it finishes, the build
appears in the TestFlight app after Apple's processing (usually 10–30 minutes).
The workflow also runs on the 1st of every month, because TestFlight builds
expire after 90 days.
