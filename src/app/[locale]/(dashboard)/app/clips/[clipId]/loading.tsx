// Clips · one clip loading.
// The tool header and tabs paint on the click; the content shimmers until
// the screen is ready (ToolLoading).

import { ToolLoading } from '@/components/tools/tool-loading';

export default function Loading() {
  return <ToolLoading slug="chalybclip" tab="history" shape="panel" />;
}
