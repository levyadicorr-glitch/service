# sherut

Multi-tenant service-management app (Next.js App Router + MongoDB Atlas), with a
WhatsApp customer-service bot per tenant.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every route is
tenant-scoped: `/<tenantId>/admin`, `/<tenantId>/portal/<id>`, and so on.

## Deployment — Netlify

This project deploys to **Netlify only**.

- Project: `sherut` — https://sherut.netlify.app
- Admin: https://app.netlify.com/projects/sherut
- Next.js runs through Netlify's Next runtime; every `app/api/**` route becomes a
  Netlify Function.

```bash
npm run build
npx netlify deploy --build --prod
```

### Required environment variables

Set these on the Netlify project (Site configuration → Environment variables),
not just in `.env.local` — API routes read them at runtime.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SESSION_SECRET` | Signs admin/customer session cookies |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | `/supadmin` login |
| `OPENROUTER_API_KEY` | AI bot inference (OpenRouter free tier) |
| `WHATSAPP_WEBHOOK_SECRET` | Optional. When set, Green API must send it as the `x-webhook-token` header |
| `WEBHOOK_DEBUG` | Optional. `1` logs the raw Green API payload |

Netlify Functions time out at 10s on the default plan. The webhook handler holds
itself to an 8s budget (`BUDGET_MS`) for that reason — Green API redelivers a
webhook it considers slow.

## WhatsApp bot

Each tenant stores its own Green API instance ID and token, plus an
`aiBotConfig`, on its tenant document. The inbound webhook URL is per tenant:

```
https://sherut.netlify.app/api/<tenantId>/whatsapp/webhook
```

Register that as the `webhookUrl` on the matching Green API instance. Only
`incomingMessageReceived` is acted on; duplicates are rejected by a unique index
on `idMessage`, and any AI failure falls through to the keyword-approval path.

AI inference is routed through OpenRouter's free tier with a fallback chain of
models (`src/lib/gemini.ts`). To re-verify or re-rank that chain against the
bot's real prompt:

```bash
node scratch/check-models.mjs
```
