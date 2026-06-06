'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ChevronRight, UploadCloud } from 'lucide-react';
import { WorkspacePersonalUpload } from '@/features/visual-qa/components/WorkspacePersonalUpload';
import { useStudentCatalog } from '@/features/student/queries/use-student-catalog';
import type { VisualQaUploadPersonalResponse } from '@/lib/api/visual-qa';
import type { StudentCaseCatalogItem } from '@/lib/api/types';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { isNextImageRemoteOptimized } from '@/lib/images/remote-image';
import { SkeletonBlock } from '@/components/shared/DashboardSkeletons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  onUploaded: (result: VisualQaUploadPersonalResponse, file?: File) => void;
};

function FeaturedCaseTile({ item, onSelect }: { item: StudentCaseCatalogItem; onSelect: (id: string) => void }) {
  const img = item.imageUrl?.trim() ? resolveApiAssetUrl(item.imageUrl) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="group medical-bento-card flex w-full flex-col overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_18px_36px_rgba(37,99,235,0.10)]"
    >
      <div className="relative h-36 bg-muted">
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            sizes="220px"
            className="object-cover"
            unoptimized={!isNextImageRemoteOptimized(img)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-cyan-accent/10">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
          {item.title}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {item.location}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {item.difficultyLabel}
          </Badge>
        </div>
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
          Open in workspace
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export function WorkspaceEmptyState({ onUploaded }: Props) {
  const router = useRouter();
  const catalogQuery = useStudentCatalog({ location: '', lesionType: '', difficulty: '' });
  const featured = (catalogQuery.data ?? []).slice(0, 4);

  const startCatalogCase = (caseId: string) => {
    router.push(`/student/visual-qa/workspace?caseId=${encodeURIComponent(caseId)}&flow=catalog`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))]">
      <section className="px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
          <div className="medical-bento-card w-full p-5 sm:p-6 lg:p-7">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <UploadCloud className="h-4 w-4" aria-hidden />
                Upload DICOM
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
                Start from your own DICOM archive or open a curated teaching case.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Upload a study archive to begin a private Visual QA session, or pick a featured case below.
              </p>
            </div>
            <div className="mx-auto mt-5 w-full max-w-xl">
              <WorkspacePersonalUpload onUploaded={onUploaded} className="w-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Featured case library</h2>
              <p className="mt-1 text-sm text-slate-500">
                Open a curated teaching case in the workspace with no upload required.
              </p>
            </div>
            <Link
              href="/student/catalog"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/90 px-3 py-1.5 text-sm font-medium text-primary shadow-sm hover:bg-slate-50"
            >
              Browse all cases
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {catalogQuery.isPending ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-52 rounded-[1.5rem]" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="medical-bento-card px-6 py-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No catalog cases yet</p>
              <Link href="/student/catalog" className="mt-2 inline-block text-sm text-primary hover:underline">
                Open case library
              </Link>
            </div>
          ) : (
            <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-4')}>
              {featured.map((item) => (
                <FeaturedCaseTile key={item.id} item={item} onSelect={startCatalogCase} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
