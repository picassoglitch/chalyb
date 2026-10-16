// Clips · Ajustes loading (and its sections).
// The tool header and tabs paint on the click; the content shimmers until
// the screen is ready (ToolLoading).

import { ToolLoading } from '@/components/tools/tool-loading';

export default function Loading() {
  return <ToolLoading slug="chalybclip" tab="settings" shape="settings" />;
}
