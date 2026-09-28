# Cloudflare Pages frontend

Deploy the existing React/Vite application without changing the backend logic.

| Setting | Value |
| --- | --- |
| Source checkout | shrey22-11/Meridian-Operational-Intelligence, `deployment/free-cloud` |
| Root directory | frontend |
| Package manager | npm (package-lock.json) |
| Local build command | `npm run build` |
| Uploaded output | `frontend/dist` |
| Public build variable | VITE_API_BASE_URL |
| Cloudflare Pages URL | https://meridian-operational-intelligence.pages.dev |

The current Pages project uses Direct Upload, not a Git-connected build. Build
from the `deployment/free-cloud` checkout. The public Pages hostname is stable, but the Vercel
Preview backend URL is immutable per redeployment. For each update, set
`VITE_API_BASE_URL` to the verified, publicly accessible Vercel Preview origin
(no trailing `/api`), build locally, then upload the contents of `frontend/dist`
as a new Pages deployment. Direct Upload does not redeploy automatically on a
Git push.

The currently verified API origin is
`https://meridian-operational-intelligence-1s9a4rjd3.vercel.app` (Vercel
Preview deployment of backend commit `d145a51`). That exact Preview domain has
a Vercel Deployment Protection exception; the project's broader protection
setting remains enabled. `ALLOWED_ORIGINS` includes the exact Pages origin for
the Preview branch. If the API target changes, check both access protection
and CORS before uploading a new frontend build.

PowerShell example from the repository root:

```powershell
$env:VITE_API_BASE_URL = "https://<verified-preview>.vercel.app"
cd frontend
npm ci
npm run build
```

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

The Cloudflare Pages project was created on the Free plan without adding a
payment method or paid services. Static frontend deployment does not provision
databases, models, or inference. The project data remains synthetic. A Pages
deployment marked successful confirms static assets were published; it does
not establish that browser-to-backend requests passed CORS or access control.
