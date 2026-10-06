# Chalyb — legacy "terminal" styled pages (2026-10-03)

User report: on some pages a "square" renders in the old page font/style, looking cheap vs. the redesign. Validated via live browser walk as the free QA account.

## Finding: 3 persistent legacy-styled panels (not FOUC, not modals/iframes)
Old style = large black rounded panel, tiny UPPERCASE monospace labels, amber accents, thin borders, dark inputs, low-contrast text. Clashes with the new light gray / purple, sans-serif UI. Persistent after hard reload.

1. `/app/subscription` — subscription panel (black terminal style). Screenshot: c79f3119…png
2. `/app/usage` — entire usage/content panel (black terminal style, monospace). Screenshot: 16ceb8e3…png
3. `/app/settings/perfil` — profile/preferences form in black panel, dark inputs, amber buttons/toggles. Screenshot: ec7a4033…png

## Checked clean (hard-reloaded, no legacy style)
home, Mis resultados, alerts, Clips, Señales, En vivo, billing, tools, messages, help. Clips launch showed a normal-styled error card ("No pudimos abrir Clips…"). No Asistente/chat engine or onboarding modal in visible nav.

## Notes for redesign
These three are already in rebuild scope:
- `/app/subscription` → Mi plan (P2, SCR-30 mockup 30)
- `/app/usage` → P0-6 (remove diagnostic strip / "revisa los logs de Vercel") and P2 credits view
- `/app/settings/perfil` → Mi cuenta redesign
The remaining old-style panels are the un-migrated legacy components that still use the old stylesheet/monospace tokens. Redesign = port these to the new design tokens/components used by the clean pages.
