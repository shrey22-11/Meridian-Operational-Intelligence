# Cloudflare Pages frontend

Deploy the existing React/Vite application without changing the backend logic.

| Setting | Value |
| --- | --- |
| Repository | shrey22-11/Meridian-Operational-Intelligence |
| Deployment branch | deployment/free-cloud |
| Root directory | frontend |
| Package manager | npm (package-lock.json) |
| Build command | npm run build |
| Output directory | dist |
| Public build variable | VITE_API_BASE_URL |

Set VITE_API_BASE_URL to the verified backend origin (no trailing /api).
The requested initial target is
https://meridian-operational-intelligence-ivoe3wvdm.vercel.app.
This variable is public and included in browser JavaScript. Never add Groq keys,
database URLs, or Vercel protection bypass secrets to frontend variables.

Local development retains the relative /api URL and existing Vite proxy when the
variable is empty. Both requests and export links use the configured origin.
The app uses hash navigation, so routes do not require server-side rewriting.

Before end-to-end release, confirm the backend accepts unauthenticated browser
requests: a Vercel login redirect cannot be fixed with CORS. Any protection change
requires an explicit, scoped access decision. Once Pages has assigned an origin,
set ALLOWED_ORIGINS on Preview only to include that exact HTTPS origin and redeploy
the backend. Environment changes create a new immutable Preview URL; rebuild Pages
with the newly verified backend URL if necessary. Do not promote Vercel Production.

Use Cloudflare Pages Free without adding a payment method or paid services.
Static frontend deployment does not provision databases, models, or inference.
The project data remains synthetic. Deployment success and end-to-end testing
must be recorded separately; this guide alone does not establish either.
