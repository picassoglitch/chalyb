"use client";
import { SettingsPanel } from "@chalito/ui";
import { env } from "@/lib/chalito/web/env";
import { useChalito } from "@/lib/chalito/provider";
import { useLocale, useTranslations } from "next-intl";
import { Link, chalitoPath } from "@/lib/chalito/navigation";
import { getPathname } from "@/i18n/routing";
import { useSettings } from "@/lib/chalito/useSettings";
import { PushOptIn } from "./PushOptIn";
import { AccountDeletion } from "./AccountDeletion";
import { BrainKeys } from "./BrainKeys";

export const Settings = () => {
  const t = useTranslations("chalito.settings");
  const tw = useTranslations("chalito.live.settings");
  const ti = useTranslations("chalito.integrations");
  const { phoneVerifier } = useChalito();
  const { values, set, error, persisted } = useSettings();
  const locale = useLocale();
  if (!values) return null;
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p data-testid="persisted" data-where={persisted} className="text-sm text-neutral-600">
        {tw(persisted)}
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          {tw(`error.${error}`)}
        </p>
      ) : null}
      <PushOptIn />
      <Link href="/conexiones" className="w-fit text-emerald-700 underline">
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
      />
      <BrainKeys />
      <AccountDeletion />
    </div>
  );
};
