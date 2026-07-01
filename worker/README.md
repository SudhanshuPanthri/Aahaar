# Aahaar Parser Worker

Cloudflare Worker that proxies meal-text → Groq → strict JSON `{ items, unparsed }`.
Keeps the Groq API key server-side (never in the app). Only meal text passes through.

## One-time setup

1. **Get a Groq API key** (free): https://console.groq.com → API Keys.
2. **Get a Cloudflare account** (free): https://dash.cloudflare.com.
3. From this `worker/` folder:
   ```bash
   npm init -y
   npm install -D wrangler
   npx wrangler login
   npx wrangler secret put GROQ_API_KEY      # paste the Groq key when prompted
   npx wrangler deploy
   ```
4. Deploy prints a URL like `https://aahaar-parser.<subdomain>.workers.dev`.

## Wire it into the app

In `mobile/`, create `.env` (or `.env.local`):
```
EXPO_PUBLIC_PARSER_URL=https://aahaar-parser.<subdomain>.workers.dev
```
Restart Expo (`npx expo start -c` to clear cache). The app will now use the AI
parser; without this var it falls back to the offline heuristic parser.

## Local dev (optional)
```bash
npx wrangler dev            # runs the worker locally on http://localhost:8787
```
Point `EXPO_PUBLIC_PARSER_URL` at your machine's LAN IP:8787 to test on device.

## Test it
```bash
curl -X POST https://aahaar-parser.<subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"text":"2 roti aur ek katori dal, 100g paneer"}'
```
Expect: `{"items":[{"food":"roti","quantity":2,"unit":"roti",...}, ...],"unparsed":[]}`

## Model
Defaults to `llama-3.3-70b-versatile`. Override via a `GROQ_MODEL` var in `wrangler.toml`.
Swappable to Ollama Cloud / another provider by changing the upstream `fetch` in `src/index.ts`.
