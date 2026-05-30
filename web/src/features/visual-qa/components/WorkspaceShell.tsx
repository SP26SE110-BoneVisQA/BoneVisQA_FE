'use client';

import { useState, type ReactNode } from 'react';
import { ImageIcon, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type WorkspaceShellProps = {
  /** Optional sub-header inside the shell (flow bar is often rendered above the shell). */
  header?: ReactNode;
  imagePanel: ReactNode;
  chatPanel: ReactNode;
  className?: string;
  /** On mobile, switch to chat after user sends (optional). */
  mobileTab?: 'image' | 'chat';
  onMobileTabChange?: (tab: 'image' | 'chat') => void;
};

/**
 * Desktop (lg+): split ~55% image / ~45% chat.
 * Mobile/tablet: tabbed "Hình ảnh" | "Hỏi đáp" (stacked panels, one visible).
 */
export function WorkspaceShell({
  header,
  imagePanel,
  chatPanel,
  className,
  mobileTab: controlledTab,
  onMobileTabChange,
}: WorkspaceShellProps) {
  const [internalTab, setInternalTab] = useState<'image' | 'chat'>('image');
  const activeTab = controlledTab ?? internalTab;

  const setTab = (value: string) => {
    const next = value === 'chat' ? 'chat' : 'image';
    setInternalTab(next);
    onMobileTabChange?.(next);
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-transparent',
        className,
      )}
    >
      {header ? header : null}

      {/* Desktop split */}
      <div className="hidden min-h-0 flex-1 p-3 lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-3">
        <section
          className="medical-dark-panel relative min-h-0 min-w-0 overflow-hidden"
          aria-label="Medical image viewer"
        >
          {imagePanel}
        </section>
        <section
          className="medical-bento-card flex min-h-0 min-w-0 flex-col overflow-hidden bg-white"
          aria-label="Visual QA chat"
        >
          {chatPanel}
        </section>
      </div>

      {/* Mobile / tablet tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col p-3 lg:hidden"
      >
        <div className="medical-glass-panel mb-3 shrink-0 px-3 py-2">
          <TabsList className="h-11 w-full rounded-2xl bg-slate-100/80 p-1">
            <TabsTrigger value="image" className="text-xs sm:text-sm">
              <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
              Image
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm">
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              Q&amp;A
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="image"
          className="medical-dark-panel relative mt-0 min-h-[min(42vh,380px)] flex-1 overflow-hidden bg-slate-950"
        >
          {imagePanel}
        </TabsContent>
        <TabsContent
          value="chat"
          className="medical-bento-card mt-0 flex min-h-[min(48vh,420px)] flex-1 flex-col overflow-hidden bg-white"
        >
          {chatPanel}
        </TabsContent>
      </Tabs>
    </div>
  );
}
