# Security notes

## Trust boundaries

- The browser calls only same-origin Vercel `/api/*` functions.
- The Vercel function holds `MALIKZ_PROXY_SECRET` and forwards a request to the fixed HTTPS Cloudflare Worker URL. It accepts no client-supplied upstream URL, avoiding an SSRF proxy.
- The Worker rejects calls without the proxy secret, validates request origins for changes, validates and bounds user input, applies a Cloudflare rate limit, and owns password verification, session signing, feature flags and D1 access.
- Login state is a 12-hour signed token in a `Secure`, `HttpOnly`, `SameSite=Lax`, host-only cookie. JavaScript cannot read it. Mutations require the exact configured site origin.
- The owner password uses PBKDF2-HMAC-SHA256 with a random per-account salt and 600,000 derivation rounds. The Worker never returns or logs password material.
- Repair rows are scoped by the authenticated owner's email. Admin feature changes produce an audit entry.
- Firmware files are processed in 4 MB chunks in the browser; no file bytes are sent to Vercel or Cloudflare.

## Secrets

Keep `MALIKZ_PROXY_SECRET`, `MALIKZ_SESSION_SECRET`, and `MALIKZ_BOOTSTRAP_SECRET` in GitHub Actions/Cloudflare/Vercel server-side secret stores only. The proxy secret must match in GitHub Actions and Vercel. The Worker receives it as a Cloudflare secret. Never add `.env` or `.dev.vars` to Git.

After the first owner account is initialized, delete `MALIKZ_BOOTSTRAP_SECRET` from GitHub Actions and Cloudflare. The Worker also refuses setup while an owner row exists. Rotate both session and proxy secrets if exposed; the owner must sign in again after the session secret changes.

## Security limitations and recovery

- This version supports one owner account. It has no public signup, email verification, password-reset workflow, staff accounts, or role delegation. A lost owner password needs an intentional, audited Cloudflare-side recovery; do not add an unauthenticated reset route.
- Access to the private API requires control of the Vercel deployment configuration or the Cloudflare and GitHub deployment secrets. Restrict repository and Vercel project membership accordingly.
- Client-side feature switches for the USB checklist and file hash screen only control the interface. Browser-local computations cannot be made private from the person operating their own browser. Stored repair records and feature changes are checked server-side.
- Automated build checks are not proof of deployment security. Configure GitHub dependency alerts and review dependency updates before releases.
