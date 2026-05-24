'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Image as ImageIcon, Tag, PencilLine } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import {
  createExpertAnnotation,
  createExpertCaseTag,
  createExpertImage,
  DB_IMAGE_MODALITIES,
  fetchExpertAnnotations,
  fetchExpertImages,
  fetchExpertTags,
  type ExpertAnnotationDto,
  type ExpertImageDto,
  type ExpertTag,
} from '@/lib/api/expert-cases';
import { resolveApiAssetUrl } from '@/lib/api/client';
import { cornersNormalizedToBox, cornersNormalizedToDraftBox, normalizeClientPointFromRect, serializeNormalizedBoundingBox } from '@/lib/utils/annotations';
import { RectangleAnnotationOverlay } from '@/components/shared/RectangleAnnotationOverlay';

type Mode = 'tags' | 'upload-image' | 'add-annotation' | 'images' | 'annotations';

interface CaseAssetsDialogProps {
  caseId: string;
  mode: Mode;
  onClose: () => void;
  allowModeSwitch?: boolean;
}

function modeLabel(mode: Mode): string {
  if (mode === 'tags') return 'Tags';
  if (mode === 'upload-image') return 'Upload image';
  if (mode === 'add-annotation') return 'Add annotation';
  if (mode === 'images') return 'Images';
  return 'Annotations';
}

export default function CaseAssetsDialog({ caseId, mode, onClose, allowModeSwitch }: CaseAssetsDialogProps) {
  const toast = useToast();
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<ExpertTag[]>([]);
  const [images, setImages] = useState<ExpertImageDto[]>([]);
  const [annotations, setAnnotations] = useState<ExpertAnnotationDto[]>([]);

  const [tagId, setTagId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [modality, setModality] = useState<string>(DB_IMAGE_MODALITIES[0] ?? 'Other');
  const [uploadedImageId, setUploadedImageId] = useState('');

  const [annotImageId, setAnnotImageId] = useState('');
  const [label, setLabel] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [drawCommitted, setDrawCommitted] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const drawLayerRef = useRef<HTMLDivElement | null>(null);

  const effectiveMode = allowModeSwitch ? activeMode : mode;
  const drawDraft = drawStart && drawEnd ? cornersNormalizedToDraftBox(drawStart, drawEnd) : null;
  const selectedImage = useMemo(
    () => images.find((img) => img.id === annotImageId),
    [images, annotImageId],
  );
  const selectedImageUrl = selectedImage?.imageUrl ? resolveApiAssetUrl(selectedImage.imageUrl) : '';

  useEffect(() => {
    setActiveMode(mode);
  }, [mode, caseId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (effectiveMode === 'tags') {
          const tagsRes = await fetchExpertTags(1, 200);
          setTags(tagsRes);
          return;
        }

        const [imagesRes, annotationsRes] = await Promise.all([
          fetchExpertImages(1, 200, caseId),
          fetchExpertAnnotations(1, 200),
        ]);
        setImages(imagesRes.items ?? []);
        setAnnotations((annotationsRes.items ?? []).filter((a) => (imagesRes.items ?? []).some((img) => img.id === a.imageId)));
        if (!annotImageId && imagesRes.items.length > 0) {
          setAnnotImageId(imagesRes.items[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load case assets.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [caseId, effectiveMode, toast]);

  const handleAddTag = async () => {
    if (!tagId) {
      toast.error('Please select a tag.');
      return;
    }
    setBusy(true);
    try {
      await createExpertCaseTag({ medicalCaseId: caseId, tagId });
      toast.success('Tag added successfully.');
      setTagId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag.');
    } finally {
      setBusy(false);
    }
  };

  const reloadImages = async () => {
    const res = await fetchExpertImages(1, 200, caseId);
    setImages(res.items ?? []);
  };

  const handleUploadImage = async () => {
    if (!imageFile) {
      toast.error('Please choose an image file.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('CaseId', caseId);
      form.append('Image', imageFile);
      form.append('Modality', modality);
      const created = await createExpertImage(form);
      setUploadedImageId(created.id ?? '');
      setImageFile(null);
      await reloadImages();
      toast.success('Image uploaded successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setBusy(false);
    }
  };

  const handleDrawMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = drawLayerRef.current;
    if (!el) return;
    e.preventDefault();
    const start = normalizeClientPointFromRect(e.clientX, e.clientY, el.getBoundingClientRect());
    if (!start) return;

    setDrawCommitted(null);
    setCoordinates('');
    setDrawStart(start);
    setDrawEnd(start);

    const onMove = (ev: MouseEvent) => {
      const p = normalizeClientPointFromRect(ev.clientX, ev.clientY, el.getBoundingClientRect());
      if (p) setDrawEnd(p);
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const end = normalizeClientPointFromRect(ev.clientX, ev.clientY, el.getBoundingClientRect()) ?? start;
      setDrawStart(null);
      setDrawEnd(null);
      const box = cornersNormalizedToBox(start, end);
      if (!box) return;
      setDrawCommitted(box);
      const s = serializeNormalizedBoundingBox(box);
      if (s) setCoordinates(s);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSaveAnnotation = async () => {
    if (!annotImageId) {
      toast.error('Please select an image.');
      return;
    }
    if (!coordinates.trim()) {
      toast.error('Draw ROI on image first.');
      return;
    }
    setBusy(true);
    try {
      await createExpertAnnotation({
        imageId: annotImageId,
        coordinates: coordinates.trim(),
        label: label.trim() || undefined,
      });
      setLabel('');
      setCoordinates('');
      setDrawCommitted(null);
      const annRes = await fetchExpertAnnotations(1, 200, annotImageId);
      setAnnotations((prev) => {
        const others = prev.filter((a) => a.imageId !== annotImageId);
        return [...others, ...(annRes.items ?? [])];
      });
      toast.success('Annotation saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save annotation.');
    } finally {
      setBusy(false);
    }
  };

  const visibleAnnotations = useMemo(() => {
    if (effectiveMode !== 'annotations') return annotations;
    if (!annotImageId) return annotations;
    return annotations.filter((a) => a.imageId === annotImageId);
  }, [annotations, annotImageId, effectiveMode]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-card-foreground">{modeLabel(effectiveMode)}</h3>

        {allowModeSwitch ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(['tags', 'upload-image', 'add-annotation', 'images', 'annotations'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMode(m)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  effectiveMode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {modeLabel(m)}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : null}

        {!loading && effectiveMode === 'tags' ? (
          <div className="mt-4 rounded-xl border border-border bg-input/20 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />
              Add case tag
            </h4>
            <div className="flex gap-3">
              <select
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm"
              >
                <option value="">Select tag...</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddTag}
                disabled={busy || !tagId}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        ) : null}

        {!loading && effectiveMode === 'upload-image' ? (
          <div className="mt-4 rounded-xl border border-border bg-input/20 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" />
              Upload image
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
              >
                {DB_IMAGE_MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={busy || !imageFile}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Upload
              </button>
              {uploadedImageId ? (
                <p className="text-xs text-muted-foreground">
                  Uploaded ID: <span className="font-mono">{uploadedImageId}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!loading && effectiveMode === 'add-annotation' ? (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-input/20 p-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <PencilLine className="h-4 w-4" />
              Add annotation
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={annotImageId}
                onChange={(e) => {
                  setAnnotImageId(e.target.value);
                  setCoordinates('');
                  setDrawCommitted(null);
                }}
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
              >
                <option value="">Select image...</option>
                {images.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.fileName || img.id}
                  </option>
                ))}
              </select>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional)"
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
              />
            </div>
            {selectedImageUrl ? (
              <div>
                <div
                  ref={drawLayerRef}
                  role="presentation"
                  onMouseDown={handleDrawMouseDown}
                  className="relative overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedImageUrl} alt="Annotation target" className="pointer-events-none block h-auto w-full" />
                  <RectangleAnnotationOverlay closed={drawCommitted} draft={drawDraft} label="ROI" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Click and drag to draw ROI.</p>
              </div>
            ) : null}
            <input
              value={coordinates}
              readOnly
              placeholder='{"x":0.1,"y":0.2,"width":0.3,"height":0.4}'
              className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={handleSaveAnnotation}
              disabled={busy || !annotImageId || !coordinates}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Save annotation
            </button>
          </div>
        ) : null}

        {!loading && effectiveMode === 'images' ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">No images found for this case.</p>
            ) : (
              images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-xl border border-border bg-input/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveApiAssetUrl(img.imageUrl)} alt={img.fileName} className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs font-medium">{img.fileName}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {!loading && effectiveMode === 'annotations' ? (
          <div className="mt-4 space-y-3">
            <select
              value={annotImageId}
              onChange={(e) => setAnnotImageId(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              <option value="">All images</option>
              {images.map((img) => (
                <option key={img.id} value={img.id}>
                  {img.fileName || img.id}
                </option>
              ))}
            </select>
            {visibleAnnotations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No annotations found.</p>
            ) : (
              <div className="space-y-2">
                {visibleAnnotations.map((ann) => (
                  <div key={ann.id} className="rounded-lg border border-border bg-input/10 p-3">
                    <p className="text-sm font-medium">{ann.label || 'Annotation'}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{ann.coordinates}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-input"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
