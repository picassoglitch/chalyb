"use client";
import type { ReactNode } from "react";
import { Link } from "@/lib/chalito/navigation";

/** A friendly empty screen: what goes here, and the one next step if there is one. */
export const Empty = ({
  icon,
  title,
  body,
  action,
  testId,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: { href: string; label: string };
  testId?: string;
}) => (
  <div className="ch-card ch-state" role="status" data-testid={testId}>
    <span className="ch-state__ic" aria-hidden="true">
      {icon}
    </span>
    <p className="ch-chl-h3">{title}</p>
    {body ? <p className="ch-muted">{body}</p> : null}
    {action ? (
      <Link href={action.href} className="ch-btn ch-btn--primary">
        {action.label}
      </Link>
    ) : null}
  </div>
);
