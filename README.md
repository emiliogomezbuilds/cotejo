# Cotejo

Spanish-language, source-cited laptop compatibility checker for Mexican university students.
Week 10 ship (Team 8, role Technologist). Packet: `docs/PACKET.md` (written before any code).

- The engine (`lib/engine.ts`) is deterministic: no AI. Every requirement in `lib/catalog.ts` carries the vendor's exact words, URL and retrieval date.
- The model (Gemini) is optional and only proposes form fields from free text or a listing screenshot; the student confirms each one.
- Unknown input is never a failure. There is no overall grade. No store links, no commissions.

## Run

```
npm ci
npm run verify   # 500+ regression checks (catalog validator, engine, wording scan, schema)
npm run dev
```

Environment (Vercel > Settings > Environment Variables; see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` (server only, optional).
Database: run `supabase/schema.sql` once in the Supabase SQL editor.
