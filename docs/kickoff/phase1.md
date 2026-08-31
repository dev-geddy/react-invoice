# Kickoff — Phase 1

> Raw intent for phase 1. Source input, not a governed doc.
> Governed docs derive from this: L1 `/docs/constitution.md`, L2 `/docs/contracts/*`, L3 `/docs/notes/*`.

## Vision
Foundation platform. Baseline features + setup so builders bootstrap projects fast.
Tailored for AI-assisted development — non-technical people build on it via established guidelines.

## Stack
- Latest Next.js + TypeScript, App Router.
- shadcn theme from preset: https://ui.shadcn.com/create?preset=bfXl6rLN2&pointer=true&template=next-monorepo
- Monorepo (turbo, yarn 4 / corepack).

## Rendering strategy
- Public-facing pages: mostly SSR.
- Admin under `/backflip/*` route scope: driven by API endpoints (better UX with loaders).

## Admin
- Route scope: `/backflip/*`.
- Auth: Google login.

## Goal
Ready-to-extend baseline: any project can start here with guidelines already in place.
