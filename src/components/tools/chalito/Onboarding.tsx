"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CompanionNameField, CompanionPicker, DEFAULT_COMPANION, SETTINGS, type SettingContext } from "@chalito/ui";
import { Link, useRouter } from "@/lib/chalito/navigation";
// Legal pages are the hub's (Chalito's own site, with its /terminos and /privacidad, is gone).
import { Link as HubLink } from "@/i18n/routing";
import { env } from "@/lib/chalito/web/env";
import { sessionTier, useSession } from "@/lib/chalito/web/session";
import { DEV_BACKEND } from "@/lib/chalito/web/env";
import { useChalito } from "@/lib/chalito/provider";
import { onboardingActivity, useCompanionPick, useCompanionStep } from "@/lib/chalito/companion";
import { PasskeyEnroll } from "./PasskeyEnroll";
import { CreateCharacter } from "./CreateCharacter";
import { ConnectProviders } from "./ConnectProviders";
import { useSettings } from "@/lib/chalito/useSettings";
import type { AgentOption } from "@/lib/chalito/web/providers";

// One entry per coding agent in providers.yaml (AgentOption lives with agentOptions() in providers.ts).
export type { AgentOption };

const STEPS = ["signIn", "companion", "name", "connect", "billing", "phone", "pair", "passkey"] as const;
type Step = (typeof STEPS)[number];
type BillingMode = "byo" | "energy" | "both";

export const Onboarding = ({ agents }: { agents: AgentOption[] }) => {
  const t = useTranslations("chalito.onboarding");
  const tl = useTranslations("chalito.legal");
  const tc = useTranslations("chalito.common");
  const ti = useTranslations("chalito.integrations");
  const router = useRouter();
  const session = useSession();
  const { phoneVerifier, status } = useChalito();
  const { values, set, finishOnboarding, saveCompanionNow } = useSettings();
  // Once a photo creation has started, "Saltar" mustn't reset the avatar: a roster change clears the card.
  const [photoStarted, setPhotoStarted] = useState(false);
  const [i, setI] = useState(0);
  const [billing, setBilling] = useState<BillingMode>("byo");
  const [path, setPath] = useState<"guided" | "expert">("guided");
  // The companion on screen follows the pick right away and does something for each step.
  const setPick = useCompanionPick((s) => s.setPick);
  const setCompanionStep = useCompanionStep((s) => s.setStep);
  const pickNow = values?.avatar;
  const onStep = STEPS[i]!;
  const signedInNow = session.status === "signed_in" || (DEV_BACKEND && status === "ready");
  useEffect(() => setPick(pickNow), [setPick, pickNow]);
  useEffect(() => {
    setCompanionStep(onboardingActivity(onStep, signedInNow));
    return () => setCompanionStep(null);
  }, [setCompanionStep, onStep, signedInNow]);
  if (!values) return <p>{tc("loading")}</p>;

  const step: Step = STEPS[i]!;
  const next = async () => {
    if (i < STEPS.length - 1) return setI(i + 1);
    await finishOnboarding(values);
    router.push("/inicio");
  };
  // The dev/test backend stands in for a signed-in session.
  const signedIn = session.status === "signed_in" || (DEV_BACKEND && status === "ready");
  const tier = values.planCredits.tier ?? (session.status === "signed_in" ? sessionTier(session.session) : null);
  const ctx: SettingContext = {
    values,
    set,
    shell: "web",
    providerLabel: (p) => ti(`${p}.name`),
    hubPlansUrl: env.hubUrl || "#",
    phoneVerifier,
  };

  return (
    <div className="ch-chl" data-step={step}>
      <p className="ch-chl-small">{t("progress", { step: i + 1, total: STEPS.length })}</p>
      <h2 className="ch-h2">{t(`${step}.title`)}</h2>

      {step === "signIn" ? (
        signedIn ? (
          <p data-testid="signed-in">{t("signIn.signedIn")}</p>
        ) : (
          <div className="ch-chl ch-chl--tight">
            <p>{t("signIn.body")}</p>
            <p className="ch-chl-small" data-testid="legal-consent">
              {tl.rich("onboarding", {
                terms: (chunks) => (
                  <HubLink href="/legal/terms" className="ch-lnk">
                    {chunks}
                  </HubLink>
                ),
                privacy: (chunks) => (
                  <HubLink href="/legal/privacy" className="ch-lnk">
                    {chunks}
                  </HubLink>
                ),
              })}
            </p>
          </div>
        )
      ) : null}

      {step === "companion" ? (
        <div className="ch-chl ch-chl--tight">
          <p>{t("companion.body")}</p>
          <CompanionPicker value={values.avatar} onChange={(c) => set("avatar", c)} />
          {/* Photo → own companion. The companion is saved first with the avatar picked so far, and the
              card is put on it server-side when ready (useWhenReady), so the wizard can carry on. */}
          <CreateCharacter onboarding={{ ensureCompanion: saveCompanionNow, onStarted: () => setPhotoStarted(true) }} />
        </div>
      ) : null}

      {step === "name" ? (
        <div className="ch-chl ch-chl--tight">
          <p>{t("name.body")}</p>
          <CompanionNameField value={values.companionName} onChange={(v) => set("companionName", v)} />
        </div>
      ) : null}

      {step === "connect" ? (
        <div className="ch-chl">
          <p>{t("connect.body")}</p>
          <div role="tablist" className="ch-chl-row">
            {(["guided", "expert"] as const).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={path === p}
                className={`ch-chip ch-chip--sm${path === p ? " ch-chip--on" : ""}`}
                onClick={() => setPath(p)}
              >
                {t(`connect.${p}`)}
              </button>
            ))}
          </div>
          {path === "guided" ? (
            <ConnectProviders compact />
          ) : (
            <p>{t("connect.expertBody")}</p>
          )}
          <p className="ch-chl-small">{t("connect.later")}</p>
        </div>
      ) : null}

      {step === "billing" ? (
        <div className="ch-chl ch-chl--tight">
          <p>{t("billing.body")}</p>
          <p>{tier ? t("billing.tier", { tier }) : t("billing.tierUnknown")}</p>
          <fieldset className="ch-chl ch-chl--tight ch-chl-fieldset">
            {(["byo", "energy", "both"] as const).map((m) => (
              <label key={m} className="ch-card ch-opt">
                <input type="radio" name="billing" checked={billing === m} onChange={() => setBilling(m)} />
                <span>{t(`billing.${m}`)}</span>
              </label>
            ))}
          </fieldset>
          {env.hubUrl ? (
            <a className="ch-lnk ch-chl-fit" href={env.hubUrl} rel="noopener">
              {t("billing.manage")}
            </a>
          ) : null}
        </div>
      ) : null}

      {step === "phone" ? (
        <div className="ch-chl">
          <p>{t("phone.body")}</p>
          {/* The same registry entries as Ajustes, charges notice included. */}
          {SETTINGS.filter((s) => ["phone", "chargesAck", "whatsapp", "calls"].includes(s.key)).map((s) => (
            <div key={s.key} data-setting-key={s.key}>
              {s.render(ctx)}
            </div>
          ))}
        </div>
      ) : null}

      {step === "passkey" ? (
        <div className="ch-chl ch-chl--tight">
          <p>{t("passkey.body")}</p>
          <PasskeyEnroll />
        </div>
      ) : null}

      {step === "pair" ? (
        <div className="ch-chl ch-chl--tight">
          <p>{t("pair.body")}</p>
          <Link href="/descargar" className="ch-btn ch-btn--secondary ch-chl-fit">
            {t("pair.download")}
          </Link>
          <p className="ch-chl-small">{t("pair.later")}</p>
        </div>
      ) : null}

      <div className="ch-chl-row">
        {i > 0 ? (
          <button className="ch-btn ch-btn--secondary" onClick={() => setI(i - 1)}>
            {tc("back")}
          </button>
        ) : null}
        {step === "companion" ? (
          <button
            className="ch-btn ch-btn--secondary"
            onClick={() => {
              if (!photoStarted) set("avatar", DEFAULT_COMPANION);
              setI(i + 1);
            }}
          >
            {tc("skip")}
          </button>
        ) : null}
        <button
          className="ch-btn ch-btn--primary"
          disabled={step === "signIn" && !signedIn}
          onClick={() => void next()}
        >
          {i === STEPS.length - 1 ? tc("finish") : tc("continue")}
        </button>
      </div>
    </div>
  );
};
