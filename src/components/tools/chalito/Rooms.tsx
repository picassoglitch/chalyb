"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { JoinRoomForm, NewRoomForm } from "@chalito/ui";
import { Link, useRouter } from "@/lib/chalito/navigation";
import { createRoom, joinRoom, roomList, type RoomListItem, type RoomsDb } from "@chalito/rooms";
import { seenRev } from "@/lib/chalito/web/room-seen";
import { useChalito } from "@/lib/chalito/provider";

/** /salas: the rooms this companion is in, "Nueva sala" and "Unirse con código". */
export const Rooms = () => {
  const t = useTranslations("chalito.settings.rooms");
  const { rooms, readCompanion } = useChalito();
  const router = useRouter();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [list, setList] = useState<RoomListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rooms || !readCompanion) return;
    let alive = true;
    void (async () => {
      const c = await readCompanion();
      if (!alive) return;
      const id = c && c !== "error" ? c.companionId : null;
      setMe(id);
      if (id) setList(await roomList(rooms.db as RoomsDb, id, seenRev).catch(() => []));
    })();
    return () => {
      alive = false;
    };
  }, [rooms, readCompanion]);

  if (!rooms || me === undefined) return <p aria-live="polite">…</p>;
  return (
    <div className="ch-chl" data-testid="rooms">
      <header className="ch-chl-head">
        <h2 className="ch-h2">{t("title")}</h2>
        <p className="ch-sub">{t("intro")}</p>
      </header>
      {me === null ? (
        <p data-testid="room-no-companion">{t("noCompanion")}</p>
      ) : (
        <>
          {list && list.length ? (
            <ul className="ch-chl-list">
              {list.map((r) => (
                <li key={r.roomId}>
                  <Link
                    href={{ pathname: "/r/[id]", params: { id: r.roomId } }}
                    className="ch-card ch-chl-card ch-chl-strong"
                    data-testid="room-link"
                  >
                    <span className="ch-chl-row">
                      {r.name}
                      <span className="ch-chl-small">
                        {t("memberCount", { n: r.memberCount })}
                      </span>
                      {r.unread ? (
                        <span
                          data-testid="room-unread"
                          className="ch-pill ch-pill--acc ch-chl-push"
                        >
                          {t("unread")}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ch-muted">{t("none")}</p>
          )}
          <section className="ch-chl ch-chl--tight">
            <h3 className="ch-ghead">{t("create.title")}</h3>
            <NewRoomForm
              onCreate={async (name, type) => {
                const r = await createRoom(rooms.api, {
                  companionId: me,
                  name,
                  type,
                  // Epoch 1 goes to every client device of this owner, so the room opens on all of them.
                  myDevices: await rooms.myClients().catch(() => []),
                });
                if (!r.ok) return r.reason;
                router.push({ pathname: "/r/[id]", params: { id: r.roomId } });
                return null;
              }}
            />
          </section>
          <section className="ch-chl ch-chl--tight">
            <h3 className="ch-ghead">{t("joinTitle")}</h3>
            <JoinRoomForm
              onJoin={async (code) => {
                setError(null);
                const r = await joinRoom(rooms.api, me, code);
                if (r.ok) router.push({ pathname: "/r/[id]", params: { id: r.roomId } });
                else setError(t(`error.${r.reason}`));
              }}
            />
            {error ? (
              <p role="alert" data-testid="room-join-error" className="ch-err">
                {error}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
};
