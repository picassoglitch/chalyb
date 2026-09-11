'use client';

import { useDashboard } from '@/lib/dashboard/store';

export function Toast() {
  const html = useDashboard((s) => s.toastHtml);
  return (
    <div className={`cc-toast${html ? ' show' : ''}`}>
      <span className="cc-td" />
      {html && <span dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}
