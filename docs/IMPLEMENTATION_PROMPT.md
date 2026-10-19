# Implementation prompt, Cotejo (Week 10)

Build the app described in `docs/PACKET.md`. Do not start coding before reading it.

## Product
A first-year university student in Mexico signs in with Google, picks the software her degree needs (AutoCAD 2026, MATLAB R2026b, SOLIDWORKS 2026-2027, Adobe Premiere 26.x, Visual Studio 2022), optionally a budget, and declares the specs of the laptop she is looking at (OS, 24H2 for Windows 11, macOS version, processor type, RAM, total storage, graphics kind, dedicated VRAM, listing price). She gets each manufacturer requirement with the vendor's own words, the link and the retrieval date. She may save a check, report a wrong requirement, delete one check or all her data.

## Hard rules (the shadow clause)
1. Every requirement is `meets`, `does_not_meet` or `cannot_decide`; `below_recommended` is information only. Unknown input is never a failure. No overall score, grade, ranking or "good laptop" label, anywhere: schema, UI or AI output.
2. "No evidence loaded" must read differently from "does not meet".
3. No store, price comparison, purchase link, affiliate link or commission. `lib/wording.ts` scans for pressure language and purchase links; `scripts/verify.ts` scans the source tree and schema.
4. Every catalog entry has the vendor quote, URL and retrieval date or the build fails (`lib/validate.ts`). The catalog is versioned; every saved check stores the version.
5. The verdict comes from code only. The LLM and the vision model only propose form fields; the student must tick the confirmation box (server-checked) before a check runs. Screenshots and free text are never stored. The app must work with no AI.
6. Log per saved check whether AI was used and how many proposed fields she changed.

## Stack
Next.js 16 App Router, Tailwind v4, Supabase (Google auth, Postgres, RLS on `checks`, `corrections`, `consents`), Vercel Hobby, Gemini REST API server-side only (text and inline image). Secrets only in Vercel environment variables. `NEXT_PUBLIC_*` values must be Config, not Secret, and need a redeploy after any change.

## Security floor
No secrets in code or repo; Google auth; RLS on every table; server-side validation and size limits (text 1,500 chars, image 4 MB PNG/JPG/WebP); the report is re-computed on the server at save time; AI use is opt-in with its own consent and a daily limit of 30.

## Done when
`npx tsc --noEmit`, `next build` and `npx tsx scripts/verify.ts` pass; the live URL completes the success definition in the PACKET end to end.
