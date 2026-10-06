"use client";
import { useEffect } from "react";
import { SettingsPanel } from "@chalito/ui";
import { env } from "@/lib/chalito/web/env";
import { useChalito } from "@/lib/chalito/provider";
import { useLocale, useTranslations } from "next-intl";
import { Link, chalitoPath } from "@/lib/chalito/navigation";
import { getPathname } from "@/i18n/routing";
import { useSettings } from "@/lib/chalito/useSettings";
import { useCompanionPick } from "@/lib/chalito/companion";
import { PushOptIn } from "./PushOptIn";
import { AccountDeletion } from "./AccountDeletion";
import { BrainKeys } from "./BrainKeys";
import { CreateCharacter } from "./CreateCharacter";
import { useRosterPickWithCustom } from "@/lib/chalito/useMyCard";

export const Settings = () => {
  const t = useTranslations("chalito.settings");
  const tw = useTranslations("chalito.live.settings");
  const ti = useTranslations("chalito.integrations");
  const { phoneVerifier } = useChalito();
  const { values, set: setValue, error, persisted } = useSettings();
  // "Crea tu personaje": picking a roster companion while wearing one's own character goes back to it.
  const { set, customCompanion } = useRosterPickWithCustom(setValue);
  const locale = useLocale();
  // A new pick shows on the companion right away.
  const setPick = useCompanionPick((p) => p.setPick);
  const pickNow = values?.avatar;
  useEffect(() => setPick(pickNow), [setPick, pickNow]);
  if (!values) return null;
  return (
    <div className="ch-chl">
      <h2 className="ch-h2">{t("title")}</h2>
      <p data-testid="persisted" data-where={persisted} className="ch-chl-small">
        {tw(persisted)}
      </p>
      {error ? (
        <p role="alert" className="ch-card ch-chl-card ch-chl-card--bad">
          {tw(`error.${error}`)}
        </p>
      ) : null}
      <PushOptIn />
      <Link href="/conexiones" className="ch-lnk ch-chl-fit">
        {tw("connectedApps")}
      </Link>
      <SettingsPanel
        shell="web"
        values={values}
        onChange={set}
        providerLabel={(p) => ti(`${p}.name`)}
        hubPlansUrl={env.hubUrl || "#"}
        usageHref={getPathname({ href: chalitoPath("/uso") as Parameters<typeof getPathname>[0]["href"], locale })}
        phoneVerifier={phoneVerifier}
        companionExtra={<CreateCharacter />}
        customCompanion={customCompanion}
      />
      <BrainKeys />
      <AccountDeletion />
    </div>
  );
};
