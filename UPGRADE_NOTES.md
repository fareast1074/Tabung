# Broski Tabung upgrade notes

This upgraded version keeps the project as a static single-page app. You can deploy it the same way as before by hosting `index.html` and `Broski.png` together.

## What changed

- Modern glass-style responsive theme with improved spacing, gradients, cards, buttons, and mobile polish.
- Light/dark theme toggle with preference saved locally.
- Privacy mode to blur balances while screen sharing.
- Sync status indicator in the header.
- Dashboard summary cards for this month, goal progress, average deposit, and largest save.
- Local smart insight panel replacing the broken external AI API request.
- Goal forecast based on recent monthly saving pace.
- Quick-save amount chips for RM5, RM10, RM20, and RM50.
- Manual transaction date input, while preserving compatibility with old transactions.
- More deposit categories: Side Hustle, Interest, and Gift.
- Search plus sort controls for transactions.
- Enhanced stats tab with 6-month cash-flow bars and milestone cards.
- New Settings tab with profile editing, PIN change, privacy mode, JSON backup export, JSON backup import, and copyable progress summary.
- Offline/local-storage fallback if Firebase scripts are unavailable, so the app still opens locally for testing.
- CSV export now includes `DateISO` and safer filenames.

## Notes

The app still uses the existing Firebase Realtime Database configuration when Firebase loads successfully. If Firebase cannot load, it stores data locally in the browser under a separate local-storage fallback key.
