import type { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  actions,
  icon: Icon,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  icon?: React.ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className}`.trim()}>
      {title || description || actions || Icon ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="rounded-xl bg-primary/10 p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              {title ? (
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
