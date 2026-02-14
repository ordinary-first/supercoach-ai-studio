<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1fYsIPHnlnMZiYYIVzE6eLh8RG25ZrWvi

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Capacitor (Android)

1. Build web assets and sync Capacitor:
   `npm run build:cap`
2. Open Android Studio:
   `npm run cap:open:android`
3. (First-time only) If Android platform is missing:
   `npm run cap:add:android`
