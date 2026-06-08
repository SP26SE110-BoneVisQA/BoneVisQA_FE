'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type FlagRagChunkDialogProps = {
  open: boolean;
  chunkLabel: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};

export function FlagRagChunkDialog({
  open,
  chunkLabel,
  saving = false,
  onClose,
  onSubmit,
}: FlagRagChunkDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed || saving) return;
    await onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Flag RAG chunk</DialogTitle>
          <DialogDescription>
            Flag <span className="font-medium text-foreground">{chunkLabel}</span> when the retrieved
            evidence is inaccurate or misleading. Admins are notified on the flagged-chunks page.
          </DialogDescription>
        </DialogHeader>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-800">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            disabled={saving}
            placeholder="e.g. Outdated fracture classification, wrong anatomy region, contradicts current guideline…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
          />
        </label>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={saving || !reason.trim()}
            onClick={() => void handleSubmit()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Flag chunk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
