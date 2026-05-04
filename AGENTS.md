## Project Intent

This repository is used with OpenCode and local Ollama models.
Prefer making direct file changes with OpenCode tools instead of replying with manual shell edits.

## Project Overview

**alist** (package name: `aguslist`) is a React Native mobile app built with Expo (SDK 55) that allows users to manage personal lists with optional encryption and cloud sync.

### Tech Stack

- **Framework**: React Native 0.83 + Expo SDK 55
- **Language**: TypeScript
- **Authentication**: Firebase Auth (Google, Apple, Facebook sign-in)
- **Storage**: Firestore (primary), AsyncStorage (legacy/fallback), expo-secure-store
- **Navigation**: React Navigation (bottom tabs + native stack)
- **Testing**: Jest + React Native Testing Library + Stryker (mutation testing)
- **CI/Build**: EAS Build (Expo Application Services)
- **Validation**: Zod schemas in `component/Core/Contracts.ts`

### Project Structure

- `component/Core/` — shared data models, storage layer, security utils, contracts/validation
  - `DataModel.tsx` — core types: `AListItem`, `UserSettings`, `BackupCadence`, `MembershipType`
  - `Storage.tsx` — Firestore abstraction; primary persistence layer
  - `Security.ts` — encrypt/decrypt helpers for sensitive list values
  - `Contracts.ts` — Zod validators for runtime data validation
  - `GlobalStyles.tsx` — shared style constants
- `component/Login/` — auth screens and social login providers
- `component/` (root) — screen components: `HomeScreen`, `ProfileScreen`, `AddItemModal`, `AListItemComponent`, `ConfirmationModal`
- `App.tsx` — root component, navigation setup
- `firebase-emulator/` — local Firebase emulator config for development
- `plugins/` — Expo config plugins

### Data Model

```ts
type AListItem = {
  name: string;
  value: string;
  timestamp: number;
  userId?: string;
  encrypted?: boolean;
};
type UserSettings = { userId: string; backup: BackupCadence; membership: MembershipType };
```

## Working Style

- Make the smallest correct change that satisfies the request.
- Read relevant files before editing.
- If the user asks for code changes, modify files instead of only suggesting commands.
- Summarize the files changed and any follow-up steps after edits.

## React Native / Expo Conventions

- **TypeScript always** — this project is fully typed; never introduce untyped JS.
- Use `StyleSheet.create` or the shared `GlobalStyles` for styles; avoid inline style objects in render.
- Prefer functional components with hooks; no class components.
- Use `expo-secure-store` for sensitive values, `AsyncStorage` only for non-sensitive cache/legacy data. Prefer Firestore as the source of truth.
- Validate data at storage boundaries with Zod (`Contracts.ts`) before persisting or reading from Firestore.
- Use `Platform.OS` guards when behaviour differs between iOS and Android.
- Never call Firebase methods directly in components — go through the `Storage.tsx` abstraction layer.
- Keep navigation param types in `DataModel.tsx` (e.g. `HomeTabParamList`).
- For new screens, add them to the navigator in `App.tsx` and define their param type in `DataModel.tsx`.

## Testing Conventions

- Test files live alongside source in `__tests__/` subdirectories.
- Use `@testing-library/react-native` (`render`, `fireEvent`, `waitFor`) — no Enzyme.
- Mock Firebase modules via `__mocks__/@react-native-firebase/`.
- Run tests with `npm test`; coverage with `npm run test:coverage`.
- Mutation testing with `npm run test:mutate` (Stryker).
- Contracts/validation tests: `npm run test:contracts`.

## Safety

- Ask before destructive operations.
- Do not overwrite unrelated user changes.
- If a tool is unavailable, explain the blocker briefly and then provide the manual command.
- Never commit Google services config files (`google-services.json`, `GoogleService-Info.plist`) with real credentials.

## Formatting

- After every change run: npm run format
