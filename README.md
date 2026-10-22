# What's The Call?

**One action. Many calls.** An invitation-only fencing community where members watch an action, make their own call, and compare it with the community response. Results represent members' decisions, not an official ruling.

Live site: [www.whatsthecall.net](https://www.whatsthecall.net)

## Features

- Watch clips, submit Left / No touch / Right decisions, and view community results after making a call.
- Revisit recent clips and browse uploaded videos.
- Invite new members: each verified, active member can generate five single-use codes over their lifetime.
- Join through an invitation email, verify the address, and set a password.
- Recover a forgotten password through email while retaining existing authenticator protection.
- Upload videos as an administrator after authenticator verification.

## Stack and services

| Area | Technology |
| --- | --- |
| Application | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Database and authentication | Supabase Postgres, Auth, row-level security, and server-side session integration |
| Video storage | Private Amazon S3 objects with short-lived signed viewing and upload URLs |
| Hosting and runtime secrets | AWS Amplify SSR, a restricted compute role, and encrypted AWS Systems Manager Parameter Store values |
| Authentication email | Resend through Supabase custom SMTP |
| Bot protection | Cloudflare Turnstile |
| DNS | Amazon Route 53 |

## Local development

Use **Node.js 22.18 or newer** and npm. Amplify builds use Node 22.

```powershell
npm ci
Copy-Item .env.example .env.local
```

If `.env.local` already exists, edit it instead of overwriting it. Fill in real development settings from [.env.example](.env.example); the placeholder values are not usable credentials.

| Setting | Local configuration |
| --- | --- |
| `SITE_URL` | `http://localhost:3000`; use that exact origin in the browser. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | URL and public key for the development Supabase project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key for that same project. |
| `S3_REGION`, `S3_BUCKET_NAME` | Region and private development video bucket. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Supply both for local credentials, or remove both to use the AWS SDK default credential chain. |
| `RATE_LIMIT_SECRET` | A dedicated random server-only secret for hashing limiter identities. |
| `SSM_REGION`, `SSM_PARAMETER_PREFIX` | Leave unset when using local secret variables. A configured prefix makes the server fetch its secrets from Parameter Store instead. |
| `TRUSTED_CLIENT_IP_HEADER` | Leave unset locally. Address limits then share a bucket, alongside per-email limits. |

Never commit credentials or put privileged keys in `NEXT_PUBLIC_` variables. Environment files are ignored, except for `.env.example`.

### Development database and email

Use a separate development Supabase project with the application's base schema and apply the [migrations](supabase/migrations) in order. **These migrations are incremental:** the earliest migration expects existing `profiles`, `invite_codes`, `invite_redemptions`, `clips`, and `clip_responses` tables. This repository does not yet provide a complete empty-database bootstrap.

Keep public Auth signups disabled and email confirmation enabled. Configure development SMTP, the local Site URL, and exact invitation/recovery callback URLs for that project. Email templates are described below. A working member flow also needs a verified Auth user with an active profile; production user data should not be copied into development.

### Development CAPTCHA

For realistic authentication testing, use a separate Turnstile widget that allows `localhost`. Configure both Turnstile keys and enable the matching secret in the development project's Supabase Auth settings with `SUPABASE_CAPTCHA_ENABLED=true`.

For development without CAPTCHA, remove **both** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and set `SUPABASE_CAPTCHA_ENABLED=false`. This requires a separate development Supabase project with Auth CAPTCHA disabled. Changing the app flag cannot bypass a provider's CAPTCHA requirement. Keep production protection enabled.

Start the app and open [localhost:3000](http://localhost:3000):

```powershell
npm run dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm test` | Run security, registration, and password-recovery regression tests. |
| `npm run lint` | Run ESLint. |
| `npx tsc --noEmit` | Check TypeScript types. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build; requires production configuration. |

The automated tests use Node's test runner and isolated PGlite databases; they do not require a live Supabase project. Live email delivery, CAPTCHA, and signed-in playback still need integration checks. Production authentication requires an HTTPS `SITE_URL` and valid CAPTCHA settings, so use `npm run dev` for the HTTP localhost setup above.

## Authentication and security

Member pages require verified email and an active database profile. Administrators must enroll or verify a TOTP authenticator at `/security` before entering the member desk; upload APIs independently require administrator access and an authenticated MFA session.

Invitation signup reserves the code, email, and normalized display name together. The invitation email opens `/accept-invite`, where the recipient sets a password. Creatorless legacy codes are retired. The Supabase **Invite user** email template must retain `{{ .ConfirmationURL }}`.

Forgot Password starts at `/forgot-password` and gives the same confirmation for known and unknown addresses. Turnstile, persistent quotas, and a cooldown protect requests. The email opens `/reset-password/confirm`; the recipient clicks Continue before verification, then chooses a matching 12–128 character password. Existing verified MFA factors still require authenticator verification. Successful recovery revokes refresh sessions globally; already-issued access tokens can remain valid until expiry.

The **Reset password** email template source is [infra/password-recovery-email.html](infra/password-recovery-email.html). It uses `/reset-password/confirm#token_hash=...`, keeping the token out of server request URLs. Initiate recovery through the app: dashboard/API-generated reset links without an app-recorded reset intent are intentionally rejected.

Production Supabase URL settings use `https://www.whatsthecall.net` as the Site URL and include these exact redirect URLs:

```text
https://www.whatsthecall.net/accept-invite
https://www.whatsthecall.net/reset-password/confirm
```

Use the equivalent localhost URLs only in the development project's configuration. The apex domain redirects to `www`; the app's production `SITE_URL` must match the canonical browser origin.

Additional protections include database access restrictions, server-side authorization, origin checks, bounded request bodies, hashed rate-limit identities, CSP nonces, private/no-store page caching, and private S3 access. See [SECURITY.md](SECURITY.md) for verified production status, limits, recovery procedures, and rollback instructions.

## Deployment

Production runs on **AWS Amplify**, using [amplify.yml](amplify.yml). The pipeline installs dependencies with `npm ci`, writes the allowed runtime configuration, and runs tests, lint, and the production build.

[scripts/write-runtime-config.mjs](scripts/write-runtime-config.mjs) writes only approved public/non-secret settings into the deployed `.env.production` artifact. Production requires `SITE_URL=https://www.whatsthecall.net`, both Supabase public settings, the Turnstile site key, S3 settings, `SSM_REGION`, `SSM_PARAMETER_PREFIX`, and `SUPABASE_CAPTCHA_ENABLED=true`. Supabase Auth must enforce the matching Turnstile secret.

The production SSR compute role reads `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, and `RATE_LIMIT_SECRET` from encrypted parameters under `/whatsthecall/production/`. It also has restricted video access under the S3 `clips/` prefix. Policy sources are [infra/compute-trust.json](infra/compute-trust.json) and [infra/compute-permissions.json](infra/compute-permissions.json). Runtime secrets and long-lived AWS keys must not be added to deployment artifacts.

**Automatic Amplify builds are disabled.** Pushing to `main` alone does not deploy; release the intended commit explicitly through Amplify. Follow the verification and rollback procedures in [SECURITY.md](SECURITY.md) for application releases.

## Repository guide

| Path | Contents |
| --- | --- |
| [app/](app) | Pages, shared UI, and API route handlers. |
| [lib/](lib) | Supabase/AWS clients, access checks, CAPTCHA, rate limiting, and recovery logic. |
| [supabase/migrations/](supabase/migrations) | Incremental database and authorization migrations. |
| [tests/](tests) | Automated security, invitation, and recovery regression tests. |
| [infra/](infra) | IAM policy sources and the recovery email template. |
| [DESIGN.md](DESIGN.md) | Editorial design and interaction guide for UI changes. |
| [SECURITY.md](SECURITY.md) | Security operations, production verification, remaining work, and recovery procedures. |

Supabase remains on the Free plan by choice. Leaked-password checks and managed daily backup access are unavailable; export/restore testing and S3 retention remain outstanding. Legacy credential retirement and the remaining signed-in production walkthroughs are tracked in [SECURITY.md](SECURITY.md). Migrations are not a backup of member data.
