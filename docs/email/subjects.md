# Supabase Auth — email subject lines

Copy/paste these into each template's **Subject** field on the Supabase
Dashboard → Authentication → Emails screen.

Supabase auto-substitutes `{{ .SiteURL }}` and other Go template variables
in the subject too (rarely useful, but legal).

| Template | Subject |
|---|---|
| Confirm signup | `Confirma tu cuenta en Chalyb` |
| Invite user | `Te invitaron a Chalyb` |
| Magic link | `Tu link de acceso a Chalyb` |
| Change email address | `Confirma tu nuevo correo en Chalyb` |
| Reset password | `Restablece tu contraseña en Chalyb` |
| Reauthentication | `Tu código de verificación de Chalyb` |

The subject ↔ HTML body pairing is what the recipient sees first in their
inbox preview. The HTML templates assume these subjects and don't repeat
them as h1 inside the body.
