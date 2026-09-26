# Malikz Tool — GeloTech Technician Workspace

A responsive technician workspace inspired by the real workflows in the private [GeloTech-Tool desktop app](https://github.com/usermalik5/GeloTech-Tool). This is a separate web application; it does not bundle Windows desktop code or pretend a browser can run ADB, Fastboot, system drivers, or iOS restore tools.

## What works in this first web release

- **Private owner sign-in:** one admin account is bootstrapped once; there is no public registration or shared browser password.
- **USB checkup:** with the technician's permission, supported desktop browsers can show USB product/manufacturer descriptors. It does not send commands to a phone.
- **Preparation checklist:** clear, customer-friendly checks before a repair begins.
- **Repair records:** private service notes stored in Cloudflare D1 and scoped to the signed-in owner.
- **Firmware file check:** calculates SHA-256 in 4 MB chunks in the browser. The selected file is never uploaded.
- **Admin controls:** the owner can enable or disable website tools. The repair-record API also checks its setting on the server.
- **Light and dark appearance:** saved in the current browser.

## Hosting layout

- **Website and same-origin API gateway:** Vercel. `api/[...path].ts` keeps the session token in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie and forwards requests to Cloudflare.
- **Private API, account verification, feature settings, and repair data:** Cloudflare Worker + D1.
- **Data boundary:** the Worker accepts API requests only when they include the private proxy key held by Vercel. The browser never receives that key or the signed session token.

## Online deployment setup

The GitHub project builds automatically on Vercel after the repo is imported. Import `usermalik5/Malikz-Tool` as a **new Vercel project** named `malikz-tool`, with the root directory, framework preset **Vite**, build command `npm run build`, and output directory `dist`. Add these Production environment variables:

| Variable | Value |
|---|---|
| `MALIKZ_API_URL` | The Worker URL, for example `https://malikz-tool-api.<your-workers-subdomain>.workers.dev` |
| `MALIKZ_PROXY_SECRET` | The same random secret as the Cloudflare Worker secret; use at least 32 random characters |
| `MALIKZ_SITE_ORIGIN` | The exact production origin, for example `https://malikz-tool.vercel.app` |

Create a Cloudflare D1 database named `malikz-tool`. In the GitHub repository's **Settings → Secrets and variables → Actions**, add these repository secrets:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token limited to Workers Scripts edit and D1 edit for this account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Worker and database |
| `CF_D1_DATABASE_ID` | ID of the `malikz-tool` D1 database |
| `MALIKZ_ADMIN_EMAIL` | The single owner email allowed to create the first account |
| `MALIKZ_SITE_ORIGIN` | Exact HTTPS Vercel production origin |
| `MALIKZ_BOOTSTRAP_SECRET` | A one-time setup code with at least 32 random characters |
| `MALIKZ_SESSION_SECRET` | A different random secret with at least 32 characters |
| `MALIKZ_PROXY_SECRET` | A third random secret with at least 32 characters; also add this to Vercel |

Set the Actions repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true`, then run **Actions → Deploy private Cloudflare service → Run workflow**. The workflow applies the D1 migration, creates the Worker, installs its secrets, and deploys it again with those secrets active. Until the secrets are in place, the Worker rejects application API requests. Set `MALIKZ_API_URL` in Vercel to the deployed Worker address and redeploy the Vercel project. Remove `MALIKZ_BOOTSTRAP_SECRET` from GitHub Actions secrets and delete the Worker secret after the first owner account is created. Keep `MALIKZ_SESSION_SECRET` and `MALIKZ_PROXY_SECRET` private and different from one another.

The frontend is deployed at https://malikz-tool.vercel.app. The Vercel build and website are live, but the Cloudflare Worker and D1 backend are not connected yet. Until the Cloudflare deployment and Vercel production secrets below are configured, the website will show that the private service is unavailable; owner sign-in and saved repair records are not ready for real use.

## First sign-in

Open the production website. Enter the configured owner email, choose a password of at least 14 characters, and enter the one-time setup code. The Worker accepts initial setup only while no owner account exists. Sign in with the same email and password afterward. Do not share the owner account with technicians; invitation-based team accounts are not part of this initial release.

## Local build checks

```sh
npm install
npm run build
cd worker
npm install
npm run typecheck
```

## Product boundary

See [the porting map](docs/PORTING_MAP.md) for what can safely move to a browser, what is implemented here, and what remains a desktop-only or later-phase item. This workspace does not offer FRP, Activation Lock, passcode, bootloader, account, or MDM security bypasses. A matching file hash does not prove the firmware source is trustworthy or that the file is compatible with a device.
