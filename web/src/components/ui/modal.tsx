'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
  /** When false, overlay click and Escape do not close the dialog. */
  dismissible?: boolean;
  /** Keep dialog content mounted while closed (preserves nested form state). */
  forceMount?: boolean;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = 'md',
  dismissible = true,
  forceMount = false,
}: ModalProps) {
  const maxW =
    size === 'lg'
      ? 'max-w-2xl'
      : size === 'xl'
        ? 'max-w-4xl'
        : size === '2xl'
          ? 'max-w-5xl'
          : 'max-w-md';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[150] bg-slate-950/45 backdrop-blur-md',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          forceMount={forceMount || undefined}
          onInteractOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[151] flex max-h-[min(92vh,880px)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            maxW,
          )}
        >
          <Dialog.Description className="sr-only">Dialog: {title}</Dialog.Description>
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <Dialog.Title className="text-lg font-semibold text-card-foreground">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" className="!h-9 !w-9 shrink-0 !p-0" aria-label="Close">
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </Dialog.Close>
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-6 py-4',
              'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50 hover:scrollbar-thumb-border',
            )}
          >
            {children}
          </div>
          {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
