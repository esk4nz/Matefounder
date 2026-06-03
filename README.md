# Matefounder

A web app for finding roommates: listings, requests, profiles, reviews, and an admin console. Stack: **Next.js** (frontend) + **Supabase** (auth, database, storage) + **OpenAI** (embeddings for interest-based matching).

## Requirements

- [Node.js](https://nodejs.org) 20+
- A [Supabase](https://supabase.com) project
- An [OpenAI API](https://platform.openai.com) key (embeddings model: `text-embedding-3-small`)

## Quick start

### 1. Clone

```bash
git clone https://github.com/esk4nz/Matefounder.git
```

### 2. Database (Supabase)

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. In **SQL Editor**, run the script from this repo:

   `supabase/migrations/schema_for_db.sql`

   It creates tables, RLS policies, storage buckets (`profile-images`, `listing-images`), and required extensions (`pgcrypto`, `vector`).

3. In **Project Settings -> API**, copy:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon** or **publishable** key -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **service_role** key -> `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose in client code)

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your values. Files containing real secrets (`.env`, `.env.local`, etc.) are not committed to git.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for server-side operations |
| `OPENAI_API_KEY` | OpenAI key for profile embedding generation |

### 4. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start after `build` |
| `npm run lint` | ESLint |

## OAuth (optional)

In Supabase: **Authentication -> Providers**, enable **Google** and/or **LinkedIn**, and add redirect URLs for your domain (locally, use the URL from `npm run dev`). Sign-in pages use providers `google` and `linkedin_oidc`.

## First admin user

After registering, in Supabase **Table Editor** -> `profiles`, set `is_admin = true` on your row.

## Deployment

On a host such as [Vercel](https://vercel.com/), set the same environment variables as in `.env.local`. Do not store secrets in the repo—only. The template is in `frontend/.env.example`.

## Security

- Do not commit `.env`, `.env.local`, or any file with real API keys.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` on the server only.
- `NEXT_PUBLIC_*` variables are exposed in the browser; use only Supabase public keys with RLS enabled.
