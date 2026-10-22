# Security operations and rollout

## Production status — October 21, 2026

Amplify release 27 successfully built, deployed and verified the security implementation in commit `a1feca2`. Automatic builds remain disabled; future releases require an explicit deployment. All 16 security tests and lint passed in the production build.

Live checks confirmed fresh matching CSP nonces, HSTS, private/no-store caching, anonymous member redirects, anonymous video/upload rejection, and cross-origin login/signup rejection. The login limiter successfully fetched encrypted runtime secrets and updated the private database counters. Supabase Turnstile protection is saved and rejects invalid tokens directly at its Auth endpoint. Supplied test addresses in `X-Forwarded-For` were not used as limiter identities; CloudFront appends its observed viewer address ([AWS documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html)).

Legacy S3 keys and the Supabase service key were removed from Amplify's app environment; the production branch has no private environment overrides. The new runtime configuration artifact contains only the allowed non-secret settings. Older deployments and local development credentials still require separate retirement/rotation after signed-in playback is confirmed; removing build settings does not revoke credentials already issued.

Administrator authenticator enrollment, signed-in playback/upload, and a fresh invitation email-to-password walkthrough still require user participation. Automated transaction tests cover invitation reservation, duplicate requests, interrupted completion and access restrictions; they do not replace the production recipient walkthrough.

The owner explicitly chose to retain Supabase Free. Leaked-password checks and managed daily backups remain unavailable; no paid upgrade was made. Export/restore testing and S3 version retention remain outstanding.

## Implemented protections

- Supabase validates identity; member routes require verified email and an active profile. Upload APIs also require the `admin` database role and an `aal2` session. User-editable Auth metadata never supplies authorization.
- Administrators enroll or verify a TOTP authenticator at `/security` before entering `/main`. Upload authorization is independently enforced in the API. Existing eight-character passwords still work at login; new passwords must meet the live Auth policy (12 characters).
- Signup reserves one code, email, and normalized display name in one database transaction before sending an invitation. Only its first request may send email. Retries reconcile against trusted Auth email/invitation timestamps and complete the same registration. A crash after Auth creates the user can also be recovered when the recipient opens the invitation. A code is never automatically freed after delivery is attempted.
- A private normalized-name registry blocks new case/whitespace collisions and reserves old names against impersonation. Existing conflicting display names are grandfathered without renaming their owners. This deliberately avoids creating a unique index that would fail on the current data.
- Atomic database counters apply across app instances. Signup: 30 address attempts and 10 email attempts per 15 minutes; login: 100 address attempts and 10 email attempts per 15 minutes; invitation generation: 10 attempts per user per hour, in addition to the five lifetime codes. Fixed windows can admit a burst at a boundary. Failure to reach the limiter rejects the request.
- Counter identities are HMACs, never raw IPs/emails. Expired counters are removed in bounded batches during subsequent requests. `RATE_LIMIT_SECRET` should be a dedicated server secret; the server-only service key is a fallback.
- Request bodies are capped at 16 KiB. Browser cross-site mutations are rejected. Production public authentication requires Turnstile configuration; it never silently skips CAPTCHA when credentials are missing.
- Production pages use a fresh CSP script nonce, dynamic rendering and `private, no-store` caching. Framing, MIME sniffing and device permissions are restricted. HSTS covers the app host, without forcing unrelated subdomains. Inline styles remain allowed for React/Turnstile; inline scripts and eval are blocked in production.
- Supabase/AWS privileged modules have server-only import guards. Session cookies use Secure in production and SameSite=Lax. They remain readable by the browser SDK, as required for this Supabase SSR architecture.
- Video viewing links last ten minutes and upload links five minutes. Inactive clips cannot be returned through the S3 fallback or replay endpoint. A copied signed link remains usable until it expires; logout cannot revoke a previously issued link.

## Rollout order

1. Apply the additive security migration and retire the creatorless legacy codes. These were applied to the live database on October 21, 2026 (Chicago time). Local migration versions match the remote history. Public/member execute privileges on the privileged functions were verified to be absent. Keep the private schema out of the Data API exposed schemas.
2. Disable public Auth signups and keep email confirmation enabled. This is already saved in production. The 12-character minimum and secure password-change setting were also saved. Leaked-password protection requires Supabase Pro or above and remains a paid-plan decision; do not upgrade automatically.
3. Create a Cloudflare Turnstile Managed widget allowing `www.whatsthecall.net` and `whatsthecall.net`. Add `localhost` only to a separate development widget. No DNS transfer is required. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY` in Amplify's build/runtime configuration. Never put the secret into a public variable or source control.
4. Configure `SUPABASE_CAPTCHA_ENABLED=true` for the new app build, then enable the matching Turnstile provider/secret in Supabase immediately after that build is live. This order avoids disabling sign-in on the old app, which cannot supply CAPTCHA tokens. Auth validates login tokens; the app validates signup tokens because it uses the admin invitation API. A token must not be verified twice. Do not leave the rollout between these steps: the flag assumes the provider is enforcing CAPTCHA.
5. Set `SITE_URL=https://www.whatsthecall.net` and exact redirect allowlist entries for `/accept-invite` on the intended production origin. These URL settings are saved. Use Node 22.18+ or 24 for tests and deployment tooling. The production branch has the approved `WhatsTheCallProductionSSR` compute role. Three Standard SecureString parameters under `/whatsthecall/production/` contain the Supabase service key, Turnstile secret and dedicated rate-limit secret. `SSM_PARAMETER_PREFIX` and `SSM_REGION` select them; server clients cache secrets for five minutes and pick up rotation afterwards. IAM policies are recorded under `infra/`.
6. Configure the trusted ingress to overwrite the viewer-IP header before setting `TRUSTED_CLIENT_IP_HEADER`. Do not trust an arbitrary inbound header. If unset, address limits deliberately use a shared bucket, in addition to per-email limits. This is conservative but can affect unrelated users during abuse; it is not a substitute for verifying Amplify/CloudFront forwarding behavior.
7. Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`. Deploy only once production CAPTCHA credentials are present. All pages are now dynamic to prevent nonce reuse; account for the additional SSR traffic when reviewing hosting costs.
8. With a controlled mailbox, test new-code signup, email arrival, callback, password setup and login. Repeat the same registration and confirm it does not send another email. Have an administrator enroll and verify their own authenticator and securely back up the setup key. Confirm that a password-only admin session cannot upload.
9. Verify live CSP/HSTS/cache headers, cross-user restrictions, signed video playback, admin upload and API denials after deployment. Existing API checks must remain in place even if middleware or layout behavior changes.

## Invitation recovery

For an incomplete registration, first retry the exact code/email/display name. This retries completion only. The recipient's `/accept-invite` callback also attempts completion after validating the session.

For a delivery failure, an operator must inspect the private registration and Auth/Resend logs. Do not reset the invite or delete the Auth user as a generic retry mechanism. After verifying the recipient and delivery history, send a replacement invitation to the **same reserved email** through the Supabase dashboard when appropriate, then retry completion. Do not send to a different person with the same code.

Useful read-only operator query (run only through an authorized database connection; it contains personal information):

```sql
select id, invite_id, email, display_name, state, user_id, created_at, updated_at
from app_private.signup_registrations
where state <> 'complete'
order by created_at;
```

To reconcile a known registration after checking the Auth account:

```sql
select public.finish_member_registration('REGISTRATION_UUID');
```

The invitation API does not offer exactly-once delivery across an external SMTP provider. It deliberately permits only one automatic attempt and keeps uncertain outcomes reserved for reconciliation rather than risking duplicate mail.

## Administrator recovery

Keep the authenticator setup key or a synced authenticator backup in a secure password manager. If both are lost, an authorized Supabase organization owner must verify the person's identity outside the affected account, review the Auth user/factors and recent activity, revoke the user's sessions, and remove only the lost factor through Supabase's supported administration flow. The next app login forces enrollment again. Never temporarily downgrade the user's role to bypass the MFA requirement or disable the API MFA check. Keep access to the Supabase organization account protected with MFA and a separate recovery method.

## Infrastructure verification

- DNS is AWS Route 53, the domain registrar is GoDaddy, hosting is Amplify, and outbound Auth email is Resend. The current DKIM/SPF records are verified. Two controlled delivery tests passed SPF, DKIM and DMARC over TLS 1.3; the second confirmed `p=REJECT` after the DNS update. The published policy is `v=DMARC1; p=reject; adkim=r; aspf=r; pct=100;`. Do not add a second SPF record at the same DNS name. Resend Forge uses the `send`/`rsend` CNAME records, so the lack of a root SPF TXT record is not by itself an error.
- Resend TLS is now Enforced: recipients without TLS will fail delivery instead of receiving an unencrypted authentication link. Invitation links grant temporary account access and should not be forwarded or logged.
- Verified `whatsthecall-videos` in `us-east-2`: all four public-access blocks are enabled, no bucket policy grants public access, and default encryption is AES256. The sampled object also rejected anonymous access. Versioning is disabled. Backup retention and its storage cost still require a decision before enabling it.
- `lib/aws/s3.ts` supports Amplify's SSR compute role via the SDK default credential chain when both static S3 variables are absent. Assign and verify a least-privilege role before removing/rotating existing credentials. Scope ListBucket to `clips/` and GetObject/PutObject to `BUCKET/clips/*`; no bucket-policy, IAM or deletion permission is needed by the app.
- Supabase is on the Free plan. Managed daily backup access and leaked-password protection are paid-plan features. An isolated restore drill and a reliable export/retention schedule remain outstanding; do not treat migration files as a backup of user data. No paid upgrades were made.
- The npm advisory endpoint timed out. An alternative OSV query of the lockfile identified vulnerable dependencies; unused Prisma, Amplify client SDK and react-hook-form dependencies were removed, and retained `sharp`, `ws` and `source-map-js` versions were patched. A repeat scan of all 174 unique runtime package/version pairs returned no known advisories. This is a point-in-time database check, not a guarantee that dependencies are free of vulnerabilities. The separate evidence file is saved outside the repository under `../security-review/dependency-audit.json`.

## Rollback

Prefer restoring a known-good deployment that supports the new CAPTCHA and MFA flows. A legacy deployment cannot sign in while Auth CAPTCHA is enabled; plan maintenance and a corrected security-capable build rather than silently disabling protection. Leave public signups disabled, legacy codes retired, and email confirmation enabled. The database changes are additive and retain compatibility with the old release function; leave reservations and name claims intact so sent invitations cannot be reused. Do not drop private registration tables or release codes as part of an application rollback. Retain the prior credential configuration privately until the compute-role deployment is verified, then remove it from build settings. Export affected registration records only through an approved private channel if investigation requires it.
