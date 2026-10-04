This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## YouTube Research

Topic generation can attach up to three public YouTube video references to each topic. To enable API search, enable the YouTube Data API v3 in Google Cloud and set `YOUTUBE_API_KEY` in `.env.local`. Keep the key server-side; without it, topics still generate and the dashboard provides a direct YouTube search link.

YouTube references are research leads, not verified scientific sources. Topics remain pending until a human edits, approves, or rejects them.

## Video Rendering and Uploads

An approved topic can generate a script, which can then be rendered into a local MP4 using Gemini text-to-speech, animated graphics, and FFmpeg. The free-first renderer does not create AI text-to-video footage. Gemini free-tier access is limited, and free-tier content may be used to improve Google's products; check the current [Gemini pricing and terms](https://ai.google.dev/gemini-api/docs/pricing) before production use.

Rendered MP4 files are stored in `.generated-media/` on the machine running Next.js. This version requires a persistent local filesystem; serverless deployments with ephemeral storage need an object-storage backend.

To enable YouTube uploads:

1. In Google Cloud Console, enable YouTube Data API v3 and create an OAuth client with the Web application type.
2. Add `http://localhost:3000/api/youtube/callback` to its authorized redirect URIs. Add your Google account as a test user if the OAuth consent screen is in Testing.
3. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`, the YouTube OAuth client ID and client secret, the redirect URI, and a random `YOUTUBE_COOKIE_SECRET` of at least 32 characters. `YOUTUBE_API_KEY` is optional and enables topic research links.
4. Restart the development server, choose **Connect YouTube**, and grant the upload permission.

The dashboard defaults to Private and asks for confirmation before every upload. Visibility can be changed to Unlisted or Public. Google may restrict uploads from unverified API projects to Private until the project passes Google's required audit. YouTube API quota limits apply.

You can generate narration, render and download MP4s, and use YouTube's API from the dashboard after setup. Never commit real API keys, OAuth secrets, or the cookie-encryption secret.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

agents/scriptAgent.ts

config/ai.ts

providers/text/
geminiTextProvider.ts
image/
imageProvider.ts
video/
animatedImageProvider.ts
videoProvider.ts
tts/
geminiTTSProvider.ts
ttsProvider.ts

media/
animation/
animateImage.ts
captions/
createSrt.ts
renderer/
renderShort.ts
