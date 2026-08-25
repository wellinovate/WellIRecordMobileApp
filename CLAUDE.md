# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start the Vite dev server (HMR)
npm run build     # tsc -b (type-check, solution-style project refs) then vite build
npm run preview   # serve the production build locally
npm run lint       # oxlint (not ESLint) — rules live in .oxlintrc.json
```

There is no test runner configured in this project.

## Architecture

This is a client-only React + TypeScript + Vite app — no backend, no router, no network
requests. It's a faithful reimplementation of a Claude Design mobile prototype ("WelliRecord",
a family health-records app), rebuilt as a plain responsive web app rather than as a native app
or a fake-device mockup.

**Single state hook, no per-screen state.** `src/state/useWelliApp.ts` (`useWelliApp`) is the
one source of truth: a single `AppState` object (active tab, modal visibility flags, form
inputs, etc.) updated through an internal `patch()` helper, plus an `actions` object of every
mutation (`setTab`, `openShareFlow`, `revokeShare`, ...) and the static reference data
(`records`, `family`, `doctors`, `proxyLog`, `activityLog`, `onboardingSlides`). `App.tsx` calls
this hook once and passes the whole returned object (typed as `WelliApp`) down as a single
`app` prop — screens and modals do not hold their own state or receive granular props.

**Screens and modals derive their own view data.** Components in `src/screens/` and
`src/modals/` take `{ app }: { app: WelliApp }`, read `app.state` / `app.records` / etc.
directly, and compute whatever filtered or joined data they need inline in the component body
(e.g. `RecordsScreen` filters `records` by `state.recordFilter` and `state.recordQuery` itself).
There's no separate selectors/derived-state layer — this mirrors the `renderVals()` pattern of
the original Claude Design source this was ported from.

**Modals are always mounted; visibility is self-guarded.** Every modal in `src/modals/` is
rendered unconditionally by `App.tsx` and returns `null` internally when its own
`state.show*`/`state.record DetailId`/etc. flag is falsy. There is no modal stack, portal, or
z-index manager — stacking order comes from JSX order and hardcoded `z-index` values matched to
the original design spec.

**Tab navigation is state, not routes.** `state.tab` (`'home' | 'records' | 'share' | 'care' |
'profile'`) selects which screen renders in `App.tsx`; there is no React Router or URL sync.

**Theming via context, not CSS variables.** `src/theme/ThemeContext.tsx` provides the active
palette object (`LIGHT_THEME` / `DARK_THEME`, defined in `src/data/mockData.ts`) computed from
`state.darkMode` via `themeFor()`. Components call `useTheme()` and read fields like
`theme.surface` / `theme.text` directly in inline styles. Many status/brand colors (e.g. the
`#041E42` navy, `#0EA5E9` accent, red/green status pills) are intentionally hardcoded rather than
themed, matching the source design.

**Styling is inline styles + a small utility stylesheet.** Layout and per-element colors are
almost entirely React inline `style` objects ported directly from the original HTML/CSS design.
`src/index.css` only holds structural/shared classes (`.phone-shell`, `.screen-pad`, `.chip`,
`.tab-bar`, `.overlay-fullscreen`, keyframe animations, etc.) and the mobile-shell responsive
behavior — full-bleed below ~460px, a centered rounded "phone" card above it. There is no
Tailwind, CSS-in-JS, or component library.

**Mock data doubles as the backend.** `src/data/mockData.ts` holds all fixtures (family
members, health records, doctors, providers, notifications, onboarding copy, etc.) and
`src/data/types.ts` holds their shared types. `useWelliApp` mutates copies of this data in
React state; only two pieces of state persist across reloads, via `localStorage` directly inside
`useWelliApp` (`welli_active_shares`, `welli_dark_mode`) — everything else resets on refresh.

**Logo is hand-drawn SVG, not an image asset.** `src/components/Logo.tsx` renders the brand mark
(shield + chevrons + plus) as inline SVG paths rather than loading an image file, so it can be
recolored per-theme via a `color` prop.
