# CV Assistant Proxy

This Cloudflare Worker protects your Ollama Cloud API key and limits each browser session to 10 messages.

## What it does

- accepts only requests from your website origin
- requires a custom header from your frontend
- uses a signed stateless session token
- limits each session to 10 messages
- stores no conversation history on the server (the client replays recent turns so the chat stays contextual)
- injects a single fixed system prompt (YIYI assistant) and CV context before calling Ollama Cloud

## Files

- `src/index.js`: Worker proxy, conversation-history sanitisation and abuse protections
- `src/cv-context.js`: single source of truth — CV context + the YIYI system prompt
- `wrangler.toml`: Cloudflare Worker configuration

## Required secrets

Set these with Wrangler:

```bash
wrangler secret put OLLAMA_API_KEY
wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` should be a long random string.

## Required vars

Edit `wrangler.toml`:

- `ALLOWED_ORIGIN`: your GitHub Pages origin
- `OLLAMA_BASE_URL`: normally `https://ollama.com`
- `OLLAMA_MODEL`: your chosen Ollama Cloud model

## Frontend hookup

Edit `/assets/config.js`:

```js
window.CV_ASSISTANT_CONFIG = {
  endpoint: "https://your-worker-subdomain.workers.dev/api/chat",
  assistantName: "YIYI",
};
```

## Deploy

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

## Notes

- The 10-message limit is enforced per signed browser session, not as a perfect identity system.
- A determined attacker can still start fresh sessions unless you add stronger controls such as Cloudflare Turnstile or Cloudflare rate limiting rules.
- No message history is persisted by the Worker.
