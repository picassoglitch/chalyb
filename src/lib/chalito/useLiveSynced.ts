"use client";
import { useEffect, useState } from "react";
import { useChalito, useLive } from "./provider";

/** Live stores that have finished one full pull since they went live (data present, or truly empty). */
const synced = new WeakSet<object>();

/**
 * True once the live store has pulled every table at least once. The store reports "live" on
 * SUBSCRIBED, before its first pull lands, so screens that read an empty list or a missing row as
 * "nothing here" / "not found" must wait for this instead of the status alone. The extra resync
 * joins the running pulls (they're coalesced) and happens once per store.
 */
export const useLiveSynced = (): boolean => {
  const { client } = useChalito();
  const { status } = useLive();
  const store = client?.live ?? null;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!store || status !== "live" || synced.has(store)) return;
    let alive = true;
    void store
      .resync()
      .catch(() => undefined)
      .then(() => {
        synced.add(store);
        if (alive) bump((n) => n + 1);
      });
    return () => {
      alive = false;
    };
  }, [store, status]);
  return !!store && synced.has(store);
};
