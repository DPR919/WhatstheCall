This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

For new UI work, follow the [Editorial design guide](DESIGN.md).

## Invitation signup release

Each verified, active member can generate five codes over their lifetime. A code can be claimed once. Signup sends a Supabase **Invite user** email; the recipient opens the link and sets a password. The sender is recorded on the new profile.

The [invitation functions migration](supabase/migrations/20260929054949_invitation_signup.sql) is already applied to the live Supabase project, so local code generation can be tested. At launch, apply the separate [legacy code retirement migration](supabase/migrations/20260929060000_retire_legacy_invite_codes.sql). It deactivates creatorless codes, including the remaining multi-use seed code. The new signup flow rejects creatorless codes even before that retirement migration is applied.

In the Supabase dashboard, complete these launch settings:

1. Under **Authentication → URL Configuration**, set Supabase's Site URL to `https://whatsthecall.net` and allow both `https://whatsthecall.net/accept-invite` and `http://localhost:3000/accept-invite` as exact redirect URLs. Supabase's Site URL is separate from the app's `SITE_URL` setting.
2. Under **Authentication → Sign In / Providers**, disable public user signups when deploying this flow. Admin invitations still create users. Keep email confirmation enabled.
3. Under **Authentication → Emails → Templates**, check the **Invite user** template. Its link must use `{{ .ConfirmationURL }}` so the invited user reaches `/accept-invite` after verification. If the email body names the destination, use `{{ .RedirectTo }}` rather than `{{ .SiteURL }}` so local and production invitations show their respective URLs. This is separate from the password recovery template.
4. Signup defaults to `https://whatsthecall.net` in production and `http://localhost:3000` locally. Set `SITE_URL` in the Amplify environment only if the deployment uses a different origin. A configured production value must be an HTTPS origin, and its `/accept-invite` URL must be allowed in Supabase.
5. Test a fresh code with a new email address: the second claim should fail, the invite email should arrive, the link should open the password form, and login should work after setting a password. Check that the inviter has four codes remaining and one redemption.

The Supabase project has working custom SMTP, and the Invite user email and redirect have passed a local end-to-end registration test. Repeat the test on the deployed app at launch.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
