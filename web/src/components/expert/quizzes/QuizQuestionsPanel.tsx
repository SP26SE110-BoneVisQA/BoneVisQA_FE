'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  createExpertQuizQuestion,
  deleteExpertQuizQuestion,
  fetchExpertQuizQuestions,
  updateExpertQuizQuestion,
} from '@/lib/api/expert-quiz-questions';
import { fetchExpertCasesPaged } from '@/lib/api/expert-cases';
import type { ExpertCase } from '@/lib/api/expert-cases';
import type { ExpertQuizQuestion } from '@/lib/api/expert-quiz-questions';
import { ImagePlus, X, Loader2, UploadCloud } from 'lucide-react';
import { uploadExpertWorkbenchImage } from '@/lib/supabase/upload-medical-case-image';
import ExpertQuestionImportDialog, { type ExpertParsedQuestion } from './ExpertQuestionImportDialog';
import { resolveApiAssetUrl } from '@/lib/api/client';

type QuestionModalMode = 'create' | 'edit';

const Q_PAGE_SIZE = 5;

function QuizQuestionsPanel({ quizId }: { quizId: string }) {
  const toast = useToast();

  const [questions, setQuestions] = useState<ExpertQuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [qPage, setQPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<QuestionModalMode>('create');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ q: ExpertQuizQuestion } | null>(null);

  const [cases, setCases] = useState<ExpertCase[]>([]);
  const [isCasesLoading, setIsCasesLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [form, setForm] = useState<{
    caseId: string;
    questionText: string;
    type: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    imageUrl: string;
    imagePreview: string | null;
  }>({
    caseId: '',
    questionText: '',
    type: 'selection-choice',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    imageUrl: '',
    imagePreview: null,
  });

  const loadCases = async () => {
    setIsCasesLoading(true);
    try {
      const res = await fetchExpertCasesPaged(1, 100);
      setCases(res.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load cases.';
      toast.error(msg);
    } finally {
      setIsCasesLoading(false);
    }
  };

  const loadQuestions = async (options?: { questionIdToTrack?: string | null }) => {
    setError(null);
    setIsLoading(true);
    try {
      const list = await fetchExpertQuizQuestions(quizId);
      
      // Calculate the new page if we need to preserve position of a specific question
      const questionIdToTrack = options?.questionIdToTrack;
      if (questionIdToTrack && questions.length > 0) {
        const questionIndex = list.findIndex(q => q.questionId === questionIdToTrack);
        if (questionIndex !== -1) {
          const newPage = Math.max(1, Math.ceil((questionIndex + 1) / Q_PAGE_SIZE));
          setQPage(newPage);
        }
      }
      
      setQuestions(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load questions.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [quizId]);

  const openCreate = async () => {
    setMode('create');
    setEditingQuestionId(null);
    if (cases.length === 0) await loadCases();
    setForm({
      caseId: cases[0]?.id ?? '',
      questionText: '',
      type: 'selection-choice',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: '',
      imageUrl: '',
      imagePreview: null,
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadExpertWorkbenchImage(file);
      const resolvedUrl = resolveApiAssetUrl(url);
      setForm((p) => ({ ...p, imageUrl: url, imagePreview: resolvedUrl }));
      toast.success('Image uploaded successfully.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const removeImage = () => {
    setForm((p) => ({ ...p, imageUrl: '', imagePreview: null }));
  };

  const openEdit = async (q: ExpertQuizQuestion) => {
    setMode('edit');
    setEditingQuestionId(q.questionId);
    let resolvedCases = cases;
    if (!cases.length) {
      setIsCasesLoading(true);
      try {
        const res = await fetchExpertCasesPaged(1, 100);
        resolvedCases = res.items;
        setCases(res.items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load cases.';
        toast.error(msg);
      } finally {
        setIsCasesLoading(false);
      }
    }

    const inferredCaseId =
      (q.caseTitle ? resolvedCases.find((c) => c.title === q.caseTitle)?.id : undefined) ?? '';

    setForm({
      caseId: inferredCaseId || resolvedCases[0]?.id || '',
      questionText: q.questionText ?? '',
      type: q.type ?? 'selection-choice',
      optionA: q.optionA ?? '',
      optionB: q.optionB ?? '',
      optionC: q.optionC ?? '',
      optionD: q.optionD ?? '',
      correctAnswer: q.correctAnswer ?? '',
      imageUrl: q.imageUrl ?? '',
      imagePreview: resolveApiAssetUrl(q.imageUrl) ?? null,
    });
    setIsModalOpen(true);
  };

  const canSubmit = useMemo(() => {
    return Boolean(form.questionText.trim() && form.type.trim() && form.correctAnswer.trim());
  }, [form.questionText, form.type, form.correctAnswer]);

  const qTotalPages = Math.max(1, Math.ceil(questions.length / Q_PAGE_SIZE));
  const pagedQuestions = useMemo(() => {
    const start = (qPage - 1) * Q_PAGE_SIZE;
    return questions.slice(start, start + Q_PAGE_SIZE);
  }, [questions, qPage]);

  const handleSave = async () => {
    if (!canSubmit) {
      toast.error('Please fill required fields.');
      return;
    }
    setIsSaving(true);
    const currentQuestionId = editingQuestionId; // Capture before async operations
    try {
      if (mode === 'create') {
        const resolvedCaseId = form.caseId || cases[0]?.id;
        await createExpertQuizQuestion(quizId, {
          caseId: resolvedCaseId,
          questionText: form.questionText.trim(),
          type: form.type.trim(),
          optionA: form.optionA.trim() || undefined,
          optionB: form.optionB.trim() || undefined,
          optionC: form.optionC.trim() || undefined,
          optionD: form.optionD.trim() || undefined,
          correctAnswer: form.correctAnswer.trim(),
          imageUrl: form.imageUrl || undefined,
        });
        toast.success('Question created successfully.');
      } else {
        if (!currentQuestionId) throw new Error('Missing question id.');
        await updateExpertQuizQuestion(currentQuestionId, {
          quizId,
          caseId: form.caseId,
          questionText: form.questionText.trim(),
          type: form.type.trim(),
          optionA: form.optionA.trim() || undefined,
          optionB: form.optionB.trim() || undefined,
          optionC: form.optionC.trim() || undefined,
          optionD: form.optionD.trim() || undefined,
          correctAnswer: form.correctAnswer.trim(),
          imageUrl: form.imageUrl || undefined,
        });
        toast.success('Question updated successfully.');
      }
      setIsModalOpen(false);
      // Preserve page position for edited questions, reset to page 1 for new questions
      await loadQuestions(mode === 'edit' ? { questionIdToTrack: currentQuestionId } : undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    const q = questions.find((qq) => qq.questionId === questionId) ?? null;
    if (!q) return;
    setDeleteDialog({ q });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    setIsSaving(true);
    try {
      await deleteExpertQuizQuestion(deleteDialog.q.questionId);
      toast.success('Question deleted successfully.');
      await loadQuestions();
      setDeleteDialog(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkImport = async (importedQuestions: ExpertParsedQuestion[]) => {
    if (!cases.length) await loadCases();

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const q of importedQuestions) {
      try {
        let caseId: string | undefined = undefined;
        if (q.caseTitle) {
          const matchedCase = cases.find((c) => c.title === q.caseTitle);
          caseId = matchedCase?.id;
        }
        if (!caseId && cases.length > 0) {
          caseId = cases[0].id;
        }
        if (!q.questionText || !q.correctAnswer) continue;

        await createExpertQuizQuestion(quizId, {
          caseId,
          questionText: q.questionText,
          type: q.type || 'selection-choice',
          optionA: q.optionA?.trim() || undefined,
          optionB: q.optionB?.trim() || undefined,
          optionC: q.optionC?.trim() || undefined,
          optionD: q.optionD?.trim() || undefined,
          correctAnswer: q.correctAnswer,
          imageUrl: undefined,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsImporting(false);
    if (successCount > 0) {
      toast.success(`Imported ${successCount} question(s) successfully.`);
      if (failCount > 0) {
        toast.info(`Failed to import ${failCount} question(s). Check the errors above.`);
      }
      await loadQuestions();
    } else if (failCount > 0) {
      toast.error(`Failed to import ${failCount} question(s).`);
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading questions...</div>
    );
  }

  return (
    <>
      <ExpertQuestionImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleBulkImport}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-start justify-center pt-[2vh] pb-4 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { if (!isSaving) setIsModalOpen(false); }} />
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between bg-card rounded-t-2xl">
              <h3 className="text-lg font-bold text-card-foreground">
                {mode === 'edit' ? 'Edit Quiz Question' : 'Create Quiz Question'}
              </h3>
              <button
                onClick={() => { if (!isSaving) setIsModalOpen(false); }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-card-foreground mb-2">Question Image</label>
                {form.imagePreview ? (
                  <div className="relative inline-block">
                    <img src={form.imagePreview} alt="Preview" className="max-h-48 rounded-lg border border-border object-contain" />
                    <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30">
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload image</span>
                        <span className="text-xs text-muted-foreground/70">PNG, JPG up to 10MB</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isUploading} />
                  </label>
                )}
              </div>

              {/* Case */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-card-foreground mb-1.5">Clinical Case (optional)</label>
                <select
                  value={form.caseId}
                  onChange={(e) => setForm((p) => ({ ...p, caseId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- No Case --</option>
                  {isCasesLoading ? <option disabled>Loading...</option> : null}
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} {c.categoryName ? `(${c.categoryName})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Question Text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-card-foreground mb-1.5">Question Text <span className="text-destructive">*</span></label>
                <input
                  value={form.questionText}
                  onChange={(e) => setForm((p) => ({ ...p, questionText: e.target.value }))}
                  placeholder="Enter question..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Type & Answer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Question Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="selection-choice">Multiple Choice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Correct Answer <span className="text-destructive">*</span></label>
                  <input
                    value={form.correctAnswer}
                    onChange={(e) => setForm((p) => ({ ...p, correctAnswer: e.target.value.toUpperCase() }))}
                    placeholder="A/B/C/D"
                    maxLength={1}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm uppercase text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-card-foreground mb-2">Answer Options</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-card-foreground mb-1">
                        Option {key} {key === form.correctAnswer && <span className="text-success">✓</span>}
                      </label>
                      <input
                        value={form[`option${key}` as keyof typeof form] as string}
                        onChange={(e) => setForm((p) => ({ ...p, [`option${key}`]: e.target.value }))}
                        placeholder={`Option ${key}`}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border px-6 py-4 flex gap-3 justify-end bg-muted/10 rounded-b-2xl">
              <button
                disabled={isSaving || isImporting}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isSaving || isImporting || !canSubmit}
                onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === 'edit' ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteDialog(null)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-card-foreground text-center mb-2">Delete Question</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Delete <strong className="text-card-foreground">{deleteDialog.q.questionText}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteDialog(null)}
                disabled={isSaving || isImporting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-card-foreground hover:bg-input cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isSaving || isImporting}
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors disabled:opacity-50 bg-destructive hover:bg-destructive/90"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-card-foreground">
            Questions
            {questions.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({questions.length} total)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={isSaving || isImporting}
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-xs font-medium hover:bg-secondary/20 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Import
            </button>
            <button
              disabled={isSaving || isImporting}
              onClick={openCreate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 cursor-pointer transition-colors"
            >
              + Add Question
            </button>
          </div>
        </div>

        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No questions yet.</div>
        ) : (
          <>
            <div className="space-y-2">
              {pagedQuestions.map((q, idx) => {
                const globalIdx = (qPage - 1) * Q_PAGE_SIZE + idx + 1;
                return (
                  <div key={q.questionId} className="p-3 rounded-lg border border-border bg-input/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {q.imageUrl && (
                          <img
                            src={resolveApiAssetUrl(q.imageUrl)}
                            alt="Question"
                            className="max-h-24 rounded-lg border border-border mb-2 object-contain"
                          />
                        )}
                        <div className="text-xs text-muted-foreground mb-0.5">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] mr-1.5">{globalIdx}</span>
                          Case: <span className="text-card-foreground font-medium">{q.caseTitle ?? '-'}</span>
                        </div>
                        <div className="text-sm font-medium text-card-foreground mt-1">{q.questionText}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: <span className="text-card-foreground font-medium">{q.type}</span>
                        </div>
                        {q.optionA || q.optionB || q.optionC || q.optionD ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {q.optionA ? <div>A: {q.optionA}</div> : null}
                            {q.optionB ? <div>B: {q.optionB}</div> : null}
                            {q.optionC ? <div>C: {q.optionC}</div> : null}
                            {q.optionD ? <div>D: {q.optionD}</div> : null}
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-2">
                          Correct: <span className="text-card-foreground font-medium">{q.correctAnswer}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={isSaving || isImporting}
                          onClick={() => openEdit(q)}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground hover:bg-input disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          disabled={isSaving || isImporting}
                          onClick={() => handleDelete(q.questionId)}
                          className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {qTotalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <button
                  disabled={qPage <= 1 || isSaving || isImporting}
                  onClick={() => setQPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground hover:bg-input disabled:opacity-40 cursor-pointer transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-muted-foreground">
                  Page <span className="text-card-foreground font-semibold">{qPage}</span> / {qTotalPages}
                </span>
                <button
                  disabled={qPage >= qTotalPages || isSaving || isImporting}
                  onClick={() => setQPage((p) => Math.min(qTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-card-foreground hover:bg-input disabled:opacity-40 cursor-pointer transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default QuizQuestionsPanel;
