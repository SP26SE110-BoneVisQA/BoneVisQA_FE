'use client';

import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA (button or link) — optional. */
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center transition-colors sm:min-h-[320px] sm:py-14">
      <div className="mb-4 rounded-full border border-border/80 bg-muted/50 p-4 text-muted-foreground shadow-sm">
        {icon ?? <Inbox className="h-7 w-7 opacity-80" />}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-card-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
