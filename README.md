This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Full URL of the site (e.g. `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key for payment processing |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `STRIPE_BASIC_PRICE_ID` | ✅ | Stripe price ID for the Basic plan |
| `STRIPE_PRO_PRICE_ID` | ✅ | Stripe price ID for the Pro plan |
| `RESEND_API_KEY` | ⚠️ | Resend API key for sending confirmation emails. Not required when `ALLOW_DISPOSABLE_EMAILS=true`. |
| `ALLOW_DISPOSABLE_EMAILS` | — | Set to `"true"` to enable full end-to-end email confirmation testing with temporary/disposable addresses (e.g. Mailinator). When `"true"`, Supabase sends a **real** confirmation email to the provided address via its built-in SMTP (no Resend API key needed), **and** the confirmation URL is also returned directly in the API response so the on-screen test-mode banner shows a direct clickable link as a backup. **Never enable in production.** |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
Test deploy
