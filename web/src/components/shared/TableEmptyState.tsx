import type { LucideIcon } from 'lucide-react';

export function TableEmptyState({
  icon: Icon,
  title,
  description,
  colSpan,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold text-card-foreground">{title}</h3>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </td>
    </tr>
  );
}
