'use client';

import { BookOpen, History, MessageSquarePlus, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VisualQaFlow } from '@/features/visual-qa/store/visual-qa-store';

type WorkspaceFlowBarProps = {
  flow: VisualQaFlow | null;
  turnLabel?: string | null;
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  historyOpen?: boolean;
};

export function WorkspaceFlowBar({
  flow,
  turnLabel,
  onNewChat,
  onOpenHistory,
  historyOpen = false,
}: WorkspaceFlowBarProps) {
  const flowBadge =
    flow === 'personal' ? (
      <Badge className="border-amber-300/60 bg-amber-500/15 text-amber-900">
        <Upload className="mr-1 h-3 w-3" aria-hidden />
        Personal DICOM
      </Badge>
    ) : flow === 'catalog' ? (
      <Badge className="border-primary/30 bg-primary/10 text-primary">
        <BookOpen className="mr-1 h-3 w-3" aria-hidden />
        Case library
      </Badge>
    ) : null;

  return (
    <div className="px-3 pt-3 sm:px-4">
      <div className="medical-glass-panel flex min-h-14 shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
        {flowBadge}
        {turnLabel ? (
          <span className="rounded-full border border-slate-200/70 bg-white/85 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600 shadow-sm">
            {turnLabel}
          </span>
        ) : null}
        </div>
        <div className="flex items-center gap-2">
        {onOpenHistory ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-2xl border-slate-200/70 bg-white/85 text-xs shadow-sm hover:bg-slate-50 lg:hidden"
            onClick={onOpenHistory}
            aria-expanded={historyOpen}
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
        ) : null}
        {onNewChat ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-2xl border-slate-200/70 bg-white/85 text-xs shadow-sm hover:bg-slate-50"
            onClick={onNewChat}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </Button>
        ) : null}
        </div>
      </div>
    </div>
  );
}
