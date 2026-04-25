# BillMinder

BillMinder is a React Native + Expo app for tracking monthly bills, due dates, and payment status, with local reminder notifications.

## What the app does

- Add, edit, and delete bills
- Track due dates, amount, category, recurrence, and paid status
- View bill lists by status (All, Upcoming, Overdue, Paid)
- Filter by category, search by bill name, and sort bills on Home screen
- Show monthly summary totals (due, paid, remaining)
- Schedule local notifications for reminder dates (9:00 AM on reminder day)
- Handle notification actions:
  - Mark as Paid
  - Remind Me Tomorrow
- View charts/statistics in the Stats tab

## Tech stack

- Expo SDK 54
- React Native 0.81
- React 19
- React Navigation (stack + bottom tabs)
- AsyncStorage for local persistence
- expo-notifications for local reminders

## Project structure (high level)

- `App.js`: app shell, navigation, notification handler setup
- `context/`: app state providers (bills, settings, categories, notification permission)
- `screens/`: Home, Add Bill, Bill Detail, Settings, Stats, onboarding flows
- `services/`: bill persistence, reminder scheduling, notification response handling
- `utils/`: formatting, currency helpers, recurrence rules, bill status helpers
- `theme.js`: shared design tokens (colors, typography, spacing, shadows)

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start the Expo dev server:

```bash
npm run start
```

3. Run on a platform:

- Press `a` in Expo CLI for Android emulator/device
- Press `i` for iOS simulator (macOS)
- Or scan with Expo Go

## Available scripts

- `npm run start` - start Expo dev server
- `npm run android` - run Android native build
- `npm run ios` - run iOS native build
- `npm run web` - run web version
- `npm run lint` - run ESLint via Expo

## Notifications behavior

- Uses local scheduling (`expo-notifications`), not a backend push service
- Requests notification permission on supported native platforms
- Stores scheduled notification IDs with each bill so reminders can be canceled/rescheduled when bill state changes
- Category actions are registered for reminder notifications and processed on tap, including cold start handling

## Data persistence

- Bills and related metadata are stored locally in AsyncStorage
- Reminder schedule metadata is persisted with each bill record
- No server/database is required for core functionality
