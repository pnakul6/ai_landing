# Quill AI

A small landing page with a live AI demo: ask questions, summarize text, rewrite in a better tone and explain code.

## How it works

- `index.html` is the page. It sends the user's text to `/api/ai`.
- `api/ai.js` is a Vercel serverless function. It picks an instruction for the chosen tool and calls the Gemini API.
- The API key is stored in the Vercel environment variable `GEMINI_API_KEY`, so it is never exposed in the browser.
- Input is limited to 4000 characters and output is capped to keep usage low.
- Optional: set `GEMINI_MODEL` in Vercel to switch models without changing code.

## Run it (free)

1. Get a free API key at https://aistudio.google.com (no billing needed).
2. Import this repo into Vercel.
3. In **Settings → Environment Variables**, add `GEMINI_API_KEY`.
4. Redeploy.

**Live demo:**  https://ailanding-idxyh7v3h-pnakul6s-projects.vercel.app


Built with AI, then reviewed and edited by hand.
