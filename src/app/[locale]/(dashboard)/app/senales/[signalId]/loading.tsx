// Señales · one signal loading.
// The tool header, tabs and legal strip paint on the click; the content
// shimmers until the screen is ready (ToolLoading).

import { ToolLoading } from '@/components/tools/tool-loading';
import { SignalsDisclaimer } from '@/components/tools/senales/common';
import '@/styles/tools-senales.css';

export default function Loading() {
  return <ToolLoading slug="chalybcrypto" tab="main" shape="panel" after={<SignalsDisclaimer />} />;
}
