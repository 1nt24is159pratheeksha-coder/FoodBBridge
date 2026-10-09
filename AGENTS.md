<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep ResQFood's design tokens and global visual treatments in `src/styles.css`, and use reusable UI components for dashboard surfaces so later features extend the same system.
- The initial login is demo-only and uses no authentication or persistence; role selection passes through the dashboard URL until a real identity system is requested.
- Keep the nine planned application sections in one dashboard shell for now; only the Kitchen dashboard has demo content, avoiding premature page workflows.
- Surplus records and NGO requests live in a browser-storage store (surplus-store.ts) shared by all roles until a real backend is requested.
- WhatsApp food-photo assessment runs server-side in src/lib/whatsapp/pipeline.server.ts (Twilio webhook at /api/public/twilio/whatsapp, TwiML replies, AI vision via Lovable AI); falls back to a labelled Demo / Simulation only when AI/media fails. Why: real integration with graceful degradation.

- Web app has only Admin and Driver roles; Kitchen/NGO act via a future WhatsApp assistant, so their screens are reused inside Admin (Surplus, Assessments, Allocations) as stand-ins. Why: WhatsApp-first product decision.
- Core entity types and lifecycle states live in src/components/resq/entities.ts; deliveries live in the shared browser store with demo OTP. Why: one data model for web and WhatsApp.
- WhatsApp tables (kitchens, whatsapp_messages, food_assessments, surplus_food) have RLS with no client policies; the Admin site reads them only via server functions returning non-PII columns. Why: admin has no auth yet.
