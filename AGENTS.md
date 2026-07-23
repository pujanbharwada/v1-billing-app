# Agent Instructions for OilBillingApp

## Project type
- React Native application using `react-native` CLI with TypeScript support.
- App entry points: `index.js`, `App.tsx`.
- Main UI files live under `screens/` and top-level React code in the repo root.

## Key workflows
- Install dependencies from the repository root with `npm install`.
- Start the Metro server with `npm start`.
- Run on Android with `npm run android`.
- Run on iOS with `npm run ios`.
- Run lint checks with `npm run lint`.
- Run tests with `npm test`.

## Native platform notes
- `android/` contains the Android native project.
- `ios/` contains the iOS native project and CocoaPods integration.
- `android/local.properties` is local environment-specific and should not be assumed available on new machines.
- For iOS native dependency changes, use `bundle exec pod install` in `ios/` after updating native packages.

## Important conventions
- Prefer editing JavaScript/TypeScript source under `App.tsx`, `screens/`, and other root files.
- Avoid unnecessary native code changes unless the issue requires Android/iOS integration.
- Respect the existing React Native version and dependency versions in `package.json`.

## Useful files
- `package.json` — npm scripts and dependencies
- `tsconfig.json` — TypeScript config
- `babel.config.js` — Babel preset setup
- `metro.config.js` — Metro bundler configuration
- `.eslintrc.js` — linting config
- `jest.config.js` — test config

## Agent behavior
- When asked to modify UI or app behavior, focus on React Native source instead of native platform scaffolding.
- When asked to fix build or test issues, reproduce with the npm scripts above and inspect Metro/React Native logs.
- Do not create project scaffolding; this repo is already a concrete React Native app.
