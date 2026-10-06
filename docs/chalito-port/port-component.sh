#!/usr/bin/env bash
# Copy Chalito web components into the hub and re-path their imports (PLAN.md contract).
#   docs/chalito-port/port-component.sh Approvals StepUpHost ...
# Source: ~/chalito-golive/apps/web/src/components/<Name>.tsx → src/components/tools/chalito/<Name>.tsx
set -euo pipefail
SRC=${CHALITO_WEB:-$HOME/chalito-golive/apps/web/src}
DST=src/components/tools/chalito
mkdir -p "$DST"
for name in "$@"; do
  f="$SRC/components/$name.tsx"; [ -f "$f" ] || f="$SRC/components/$name.ts"
  out="$DST/$(basename "$f")"
  cp "$f" "$out"
  sed -i -E \
    -e 's#"@/lib/([^"]+)"#"@/lib/chalito/web/\1"#g' \
    -e 's#"@/i18n/navigation"#"@/lib/chalito/navigation"#g' \
    -e 's#import type \{ AppLocale \} from "@/i18n/routing"#import type { AppLocale } from "@/i18n/locales"#g' \
    -e 's#"(\./|@/components/)ChalitoProvider"#"@/lib/chalito/provider"#g' \
    -e 's#"(\./|@/components/)useSettings"#"@/lib/chalito/useSettings"#g' \
    -e 's#"@/components/([^"]+)"#"@/components/tools/chalito/\1"#g' \
    -e 's#(useTranslations|getTranslations)\("([^"]+)"\)#\1("chalito.\2")#g' \
    -e 's#(useTranslations|getTranslations)\(\)#\1("chalito")#g' \
    "$out"
  echo "ported $out"
done
