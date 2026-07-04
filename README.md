# AnyGram

Production-ready React Native Telegram client powered by [TDLib](https://github.com/tdlib/td) via [react-native-tdlib](https://github.com/vladlenskiy/react-native-tdlib).

## Features

- Full TDLib authorization flow (phone, SMS code, 2FA password)
- Hardcoded MTProto proxy applied before authentication
- Real-time chat list and messaging
- GitHub Actions CI builds a device IPA on every push

## Configuration

Telegram API credentials and MTProto proxy are configured in `src/config/tdlibConfig.ts`:

- **App name:** AnyGram
- **Bundle ID:** `com.anygram.app`
- **Proxy type:** `proxyTypeMtproto` (all traffic routed through proxy)

## TDLib startup order

1. `startTdLib` — creates TDLib client and sends `setTdlibParameters`
2. `addProxy` — enables MTProto proxy before auth network requests
3. Authorization state machine handles login

## Local development

```bash
npm install
cd ios && pod install && cd ..
npm run ios
```

Requires macOS with Xcode for iOS builds.

## GitHub Actions IPA

Workflow: `.github/workflows/ios-build.yml`

Runs on `macos-latest`, installs Node.js LTS, npm dependencies, CocoaPods, archives with `xcodebuild`, and uploads `AnyGram.ipa` as an artifact.

### Optional code signing secrets

When these repository secrets are set, the workflow produces a signed IPA:

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64-encoded provisioning profile |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_SIGNING_IDENTITY` | e.g. `Apple Distribution: Your Name (TEAMID)` |

Without signing secrets, an unsigned IPA is packaged from the archive.

## License

MIT
