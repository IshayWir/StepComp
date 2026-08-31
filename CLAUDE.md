# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

StepComp is an Expo (SDK 54) / React Native app, written in TypeScript. It is an early-stage scaffold: `App.tsx` still has the default Expo boilerplate, and the only app code so far is a Supabase client. Given the dependencies (HealthKit + Supabase), this is being built as a step-count tracking/competition app with cloud sync.

## Commands

There is no lint or test setup yet — don't assume `npm run lint`/`test` exist.

```
npm install         # install deps
npm run start        # expo start (Metro bundler + dev menu)
npm run ios          # expo start --ios
npm run android       # expo start --android
npm run web           # expo start --web
```

Type-check with `npx tsc --noEmit` (no dedicated script defined).

## Environment

Requires a `.env` with:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`EXPO_PUBLIC_*` vars are inlined into the client bundle by Expo, so only non-secret, publishable values belong there (Supabase's anon key is designed to be public; RLS policies are what actually protect data).

## Architecture

- `index.ts` — entry point, calls `registerRootComponent(App)`.
- `App.tsx` — root component (currently default template content).
- `src/lib/supabase.ts` — the Supabase client. Auth sessions are persisted via `expo-secure-store` (not AsyncStorage), wired through a custom `storage` adapter passed to `createClient`. `detectSessionInUrl` is disabled since this is a native app, not a browser.
- `app.json` — Expo config. Native plugins currently registered: `expo-secure-store` and `@kingstinct/react-native-healthkit` (Apple HealthKit access — iOS only). There is no `ios`/`android` native project checked in; they're gitignored and generated on demand (e.g. via prebuild).

## Expo version note

Per [AGENTS.md](AGENTS.md), Expo has changed significantly — read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo API code rather than relying on prior training knowledge.
