<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b76222ad-cbef-4099-98d0-287a876f919d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
3. Add `FIREBASE_SERVICE_ACCOUNT_JSON` for server-side token verification, rate limits,
   and atomic video-credit transactions. Keep this value server-side only.
4. Run the app:
   `npm run dev`

Deploy `firestore.rules` together with the app. AI endpoints require a Firebase ID token;
the first video is free after Google sign-in.
