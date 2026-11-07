// What the admin inbox shows for ?t= / ?i=, and when opening it counts as reading it.

import 'server-only';
import {
  fetchThreadMessages,
  markInquiryReadForAdmin,
  markThreadReadForAdmin,
  type MessageRow,
  type PartnerInquiryRow,
  type ThreadSummary,
} from './messages-data';

export type AdminSelection =
  | { kind: 'none' }
  | { kind: 'thread'; summary: ThreadSummary; messages: MessageRow[] }
  | { kind: 'thread-error'; summary: ThreadSummary }
  | { kind: 'inquiry'; inquiry: PartnerInquiryRow };

export interface AdminInboxDeps {
  loadMessages: (threadUserId: string) => Promise<MessageRow[] | null>;
  markThreadRead: (threadUserId: string) => Promise<void>;
  markInquiryRead: (inquiryId: string) => Promise<void>;
}

const defaultDeps: AdminInboxDeps = {
  loadMessages: fetchThreadMessages,
  markThreadRead: markThreadReadForAdmin,
  markInquiryRead: markInquiryReadForAdmin,
};

/** Resolve the selected thread/inquiry; mark it read only once its data is in hand. */
export async function openAdminSelection(
  query: { threadUserId?: string; inquiryId?: string },
  threads: ThreadSummary[],
  inquiries: PartnerInquiryRow[],
  deps: AdminInboxDeps = defaultDeps,
): Promise<AdminSelection> {
  if (query.threadUserId) {
    const summary = threads.find((t) => t.threadUserId === query.threadUserId);
    if (!summary) return { kind: 'none' };
    const messages = await deps.loadMessages(summary.threadUserId);
    if (messages === null) return { kind: 'thread-error', summary };
    await deps.markThreadRead(summary.threadUserId);
    return { kind: 'thread', summary, messages };
  }
  if (query.inquiryId) {
    const inquiry = inquiries.find((i) => i.id === query.inquiryId);
    if (!inquiry) return { kind: 'none' };
    await deps.markInquiryRead(inquiry.id);
    return { kind: 'inquiry', inquiry };
  }
  return { kind: 'none' };
}
