# Peer-to-Peer Micro-Scholarship Hub

A Next.js 15 App Router application connecting students in Sri Lanka with micro-scholarship
support and skill mentorship.

## Requirements

- Node.js 20.9 or later
- npm 10 or later
- A Supabase project

## Local development

1. Copy `.env.example` to `.env.local` and fill in the required values.
2. Install the project dependencies:

   ```sh
   npm install
   ```

3. Apply `schema.sql` to your Supabase project. For an existing database, create and apply an
   incremental migration instead of rerunning the whole schema.
4. Configure Supabase Auth redirect URLs to include `http://localhost:3000/auth/callback` and
   your production callback URL.
5. Start the development server:

   ```sh
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

- `npm run dev` — start the development server.
- `npm run build` — create a production build.
- `npm run start` — serve the production build.
- `npm run typecheck` — run the TypeScript compiler without emitting files.

Students can manage requests and post campaign milestones from `/dashboard`.

## Payment provider setup

- Set `PAYHERE_MODE=sandbox` while testing and configure the PayHere notification URL as
  `/api/donations/payhere-notify`.
- Configure a Stripe webhook for `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, and `checkout.session.expired`, targeting
  `/api/donations/stripe-webhook`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and all payment secrets server-side. Do not expose them as
  `NEXT_PUBLIC_*` environment variables.
