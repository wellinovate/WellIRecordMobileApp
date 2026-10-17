# Dependency audit

Run on 2026-10-17 with `npm audit --omit=dev`.

## Server (`server/`)
0 vulnerabilities. CI fails the build on any high or critical finding.

## App (root)
55 findings (1 critical, 32 high, 22 moderate). Almost all sit in the build and dev-server tool chain, not in code that runs on a patient's phone:

| Package | Pulled in by | Runs in the shipped app? | Action |
|---|---|---|---|
| shell-quote (critical) | react-native -> react-devtools-core | No. Dev tools only | Wait for the React Native patch. Never run the dev server on an untrusted network |
| metro, metro-config, metro-file-map, micromatch, braces, fast-glob, chokidar, compression | react-native, expo | No. Bundler | Fixed by Expo and React Native upgrades. No safe in-place fix |
| @expo/cli, @expo/metro-config, @expo/code-signing-certificates, node-forge | expo | No. Build tooling | Same |
| tailwindcss, source-map-js | NativeWind | No. Build time CSS | Same |
| @solana-mobile/* | transitive, not imported by app code | Not imported | Find the parent with `npm ls @solana-mobile/mobile-wallet-adapter-protocol` and drop it if it is unused |
| @clerk/expo, react-native-maps, react-native-reanimated, react-native-worklets | direct | Yes, but the advisories come through the tooling above | Re-check after each Expo SDK upgrade |

Do not run `npm audit fix --force`. It proposes major version changes to Expo and React Native that would break the build.

## Routine
1. Each Expo SDK upgrade: re-run the audit and update this file.
2. Dependabot (or Renovate) for security updates on `server/` and the app.
3. CI: `server` job blocks on high or above. The `app-audit` job reports but does not block.
