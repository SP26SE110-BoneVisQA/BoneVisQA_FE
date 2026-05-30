'use client';

import { LayoutGroup, motion } from 'framer-motion';
import { Send, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onChooseFile?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  canAttachFile?: boolean;
  placeholder?: string;
};

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onChooseFile,
  disabled = false,
  isLoading = false,
  canAttachFile = false,
  placeholder = 'What would you like to ask about this image?',
}: Props) {
  const isDisabled = disabled || isLoading;

  return (
    <LayoutGroup>
      <motion.div layout className="flex w-full min-w-0 flex-1 items-center gap-2">
        {canAttachFile ? (
          <motion.div layout>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 w-11 shrink-0 rounded-2xl border-slate-200/80 bg-white p-0 shadow-sm"
              disabled={isDisabled}
              aria-label="Attach imaging file"
              onClick={onChooseFile}
            >
              <UploadCloud className="h-5 w-5" />
            </Button>
          </motion.div>
        ) : null}

        <motion.input
          layout
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:outline-none focus:ring-2 focus:ring-cyan-accent/60 disabled:cursor-not-allowed disabled:opacity-70"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!isDisabled) onSubmit();
            }
          }}
        />

        <motion.div layout>
          <Button
            type="button"
            className="h-12 w-12 shrink-0 rounded-[1.35rem] px-0 transition-all hover:opacity-90 active:scale-95"
            disabled={isDisabled}
            aria-label={isDisabled ? 'Sending message' : 'Send message'}
            aria-busy={isLoading}
            onClick={onSubmit}
          >
            {isLoading ? (
              <span
                aria-hidden
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only" aria-live="polite">
              {isLoading ? 'Sending message' : 'Send message'}
            </span>
          </Button>
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}
