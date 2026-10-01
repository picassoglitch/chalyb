'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/primitives';

export function KitchenSinkClient() {
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Switch checked={on} onChange={setOn} label="Switch" />
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open sheet
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sheet" closeLabel="Cerrar">
        <p className="ch-muted">Traps focus, closes on Esc and on the scrim.</p>
      </Sheet>
    </div>
  );
}
