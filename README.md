# Aura

Private face-photo workspace app built with Next.js, Prisma, pgvector, and Cloudinary.

## Core rules

- Guests do not get a public gallery.
- Guests only access photos through selfie search.
- Raw guest selfies stay in the browser.
- Original uploads keep their original quality.

## Stack

- Next.js 16
- Prisma + Postgres + pgvector
- Cloudinary
- `face-api.js` running in the browser with local model files in `public/models`

## Local run

```bash
npm install
npm run dev
```

## Deploy

This version is designed to stay Vercel-friendly:

- no Python sidecar
- no native face-engine service
- no server-only local model runtime requirement

Face descriptors are generated in the browser, then matched on the server against stored embeddings.
