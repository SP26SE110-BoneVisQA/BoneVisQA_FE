import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface QuickActionCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  iconColor?: string;
  badge?: string;
}

export default function QuickActionCard({
  title,
  icon: Icon,
  href,
  iconColor = 'bg-primary/15 text-primary',
  badge,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[7rem] flex-col justify-center overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
    >
      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconColor}`}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-headline text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {title}
            </h3>
            {badge ? (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                {badge}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
