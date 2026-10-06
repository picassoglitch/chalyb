"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SettingContext, SettingsValues } from "@chalito/ui";
import { isOnboarded, loadSettings, markOnboarded, saveSettings } from "@/lib/chalito/web/local";
import { SettingsError, type SettingsErrorCode } from "@/lib/chalito/web/settings-store";
import { useChalito } from "./provider";

export type SaveError = Exclude<SettingsErrorCode, "companion_exists"> | null;

/**
 * Settings from the server (get/update_my_settings) when signed in, else on this device.
 * Changes are applied optimistically, then re-read: the server is the source of truth, so a
 * refused change (e.g. calls without a verified phone) snaps back and reports `rejected`.
 */
export const useSettings = () => {
  const { settings: serverStore, status } = useChalito();
  // If the server can't be reached, fall back to this device rather than a stuck screen.
  const [unreachable, setUnreachable] = useState(false);
  const store = unreachable ? null : serverStore;
  const [values, setValues] = useState<SettingsValues | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [error, setError] = useState<SaveError>(null);
  const companionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<SettingsValues | null>(null);
  latest.current = values;

  const reload = useCallback(async () => {
    if (!store) return;
    const r = await store.load();
    setValues(r.values);
    setOnboarded(r.onboarded);
  }, [store]);

  useEffect(() => {
    if (status === "loading") return;
    if (store)
      void reload().catch(() => {
        setUnreachable(true);
        setError("failed");
      });
    else {
      setValues(loadSettings());
      setOnboarded(isOnboarded());
    }
  }, [store, status, reload]);

  // Leaving the screen (or reloading) inside the debounce must not drop the rename: save it now.
  useEffect(() => {
    if (!store) return;
    const flush = () => {
      if (!companionTimer.current) return;
      clearTimeout(companionTimer.current);
      companionTimer.current = null;
      const cur = latest.current;
      if (cur) void store.saveCompanion(cur).catch(() => undefined);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [store]);

  const set: SettingContext["set"] = (k, v) => {
    setError(null);
    setValues((cur) => {
      if (!cur) return cur;
      const next = { ...cur, [k]: v };
      if (!store) saveSettings(next);
      return next;
    });
    if (!store) return;
    if (k === "avatar" || k === "companionName") {
      // Typing a name shouldn't be one RPC per keystroke.
      if (companionTimer.current) clearTimeout(companionTimer.current);
      companionTimer.current = setTimeout(() => {
        companionTimer.current = null;
        const cur = latest.current;
        if (cur) void store.saveCompanion(cur).catch(() => setError("failed"));
      }, 500);
      return;
    }
    void store
      .save(k, v)
      .catch((err: unknown) =>
        setError(err instanceof SettingsError && err.code !== "companion_exists" ? err.code : "failed"),
      )
      .finally(() => void reload().catch(() => undefined));
  };

  const finishOnboarding = async (v: SettingsValues) => {
    if (!store) {
      saveSettings(v);
      markOnboarded();
      return;
    }
    if (companionTimer.current) clearTimeout(companionTimer.current);
    companionTimer.current = null;
    await store.saveCompanion(v);
    await store.markOnboarded();
  };

  return {
    values,
    set,
    error,
    onboarded,
    finishOnboarding,
    persisted: store ? ("server" as const) : ("device" as const),
  };
};
