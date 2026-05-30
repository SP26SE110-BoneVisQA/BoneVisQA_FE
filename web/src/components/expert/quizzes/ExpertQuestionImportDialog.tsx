'use client';

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileText,
  ClipboardPaste,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Trash2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ExpertParsedQuestion {
  questionText: string;
  type: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  caseTitle?: string;
}

interface ExpertQuestionImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: ExpertParsedQuestion[]) => void;
}

type ImportMode = 'paste' | 'csv' | 'json' | 'excel';

const SAMPLE_CSV = `questionText,type,optionA,optionB,optionC,optionD,correctAnswer,caseTitle
"What is the fracture type shown in the X-ray?","selection-choice","Transverse","Oblique","Spiral","Comminuted","A","Case 1: Femur Fracture"
"Identify the affected bone.","selection-choice","Femur","Tibia","Fibula","Humerus","B","Case 1: Femur Fracture"`;

const SAMPLE_JSON = `[
  {
    "questionText": "What is the fracture type shown in the X-ray?",
    "type": "selection-choice",
    "optionA": "Transverse",
    "optionB": "Oblique",
    "optionC": "Spiral",
    "optionD": "Comminuted",
    "correctAnswer": "A",
    "caseTitle": "Case 1: Femur Fracture"
  },
  {
    "questionText": "Identify the affected bone.",
    "type": "selection-choice",
    "optionA": "Femur",
    "optionB": "Tibia",
    "optionC": "Fibula",
    "optionD": "Humerus",
    "correctAnswer": "B",
    "caseTitle": "Case 1: Femur Fracture"
  }
]`;

const SAMPLE_PASTE = `1. What is the fracture type shown in the X-ray?
A) Transverse  B) Oblique  C) Spiral  D) Comminuted
Answer: A
Case: Case 1: Femur Fracture

2. Identify the affected bone.
A) Femur  B) Tibia  C) Fibula  D) Humerus
Answer: B
Case: Case 1: Femur Fracture`;

/** Split pasted text into one block per question (numbered "Q1", "1.", "Question 1", etc.). */
function splitPasteBlocks(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .split(/\n(?=\s*(?:Q\s*\d+\b|Question\s*\d+\b|\d+\.[\s\)]))/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePaste(raw: string): ExpertParsedQuestion[] {
  const questions: ExpertParsedQuestion[] = [];
  const blocks = splitPasteBlocks(raw);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    while (lines.length && /^Q\s*\d+\s*$/i.test(lines[0])) {
      lines.shift();
    }
    if (lines.length < 2) continue;

    const firstLine = lines[0].replace(/^[\d.]+\s*[\.\)]\s*/i, '').trim();

    const questionText = firstLine;
    let optionA = '',
      optionB = '',
      optionC = '',
      optionD = '';
    let correctAnswer = '';
    let caseTitle = '';

    for (const line of lines) {
      if (/^answer\s*[:\)]/i.test(line)) {
        const val = line.replace(/^answer\s*[:\)\-]+\s*/i, '').trim();
        correctAnswer = val.charAt(0).toUpperCase();
      }
      if (/^case\s*[:\)]/i.test(line) || /^ca\s*[:\)]/i.test(line)) {
        caseTitle = line.replace(/^case\s*[:\)\-]+\s*/i, '').replace(/^ca\s*[:\)\-]+\s*/i, '').trim();
      }
      if (/^[A-D][\)\.\-\:]\s*/.test(line)) {
        const match = line.match(/^([A-D])[\)\.\-\:]\s*(.+)/);
        if (match) {
          const key = match[1] as 'A' | 'B' | 'C' | 'D';
          const val = match[2].trim();
          if (key === 'A') optionA = val;
          if (key === 'B') optionB = val;
          if (key === 'C') optionC = val;
          if (key === 'D') optionD = val;
        }
      }
    }

    if (!questionText || !correctAnswer) continue;

    questions.push({
      questionText,
      type: 'selection-choice',
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      caseTitle: caseTitle || undefined,
    });
  }

  return questions;
}

function parseCSV(raw: string): { ok: true; questions: ExpertParsedQuestion[] } | { ok: false; error: string } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: 'CSV must have at least a header row and one data row.' };

  const header = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const qIdx = header.indexOf('questiontext');
  const typeIdx = header.indexOf('type');
  const aIdx = header.indexOf('optiona');
  const bIdx = header.indexOf('optionb');
  const cIdx = header.indexOf('optionc');
  const dIdx = header.indexOf('optiond');
  const ansIdx = header.indexOf('correctanswer');
  const caseIdx = header.indexOf('casetitle');

  if (qIdx === -1 || ansIdx === -1) {
    return { ok: false, error: 'CSV must have "questionText" and "correctAnswer" columns.' };
  }

  const questions: ExpertParsedQuestion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const qText = cells[qIdx] ?? '';
    if (!qText) continue;
    const correct = (cells[ansIdx] ?? 'A').charAt(0).toUpperCase();
    const typeVal = cells[typeIdx] ?? 'selection-choice';
    const caseTitle = cells[caseIdx] ?? '';

    questions.push({
      questionText: qText,
      type: typeVal,
      optionA: cells[aIdx] || undefined,
      optionB: cells[bIdx] || undefined,
      optionC: cells[cIdx] || undefined,
      optionD: cells[dIdx] || undefined,
      correctAnswer: correct,
      caseTitle: caseTitle || undefined,
    });
  }

  return { ok: true, questions };
}

function parseJSON(raw: string): { ok: true; questions: ExpertParsedQuestion[] } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [data];
    const questions: ExpertParsedQuestion[] = [];
    for (const item of arr) {
      const qText = item.questionText ?? item.question ?? item.text ?? '';
      const correct = (item.correctAnswer ?? item.answer ?? item.correct ?? 'A').toString().charAt(0).toUpperCase();
      if (!qText) continue;
      questions.push({
        questionText: qText,
        type: item.type ?? 'selection-choice',
        optionA: item.optionA ?? item.option_a ?? item.A ?? undefined,
        optionB: item.optionB ?? item.option_b ?? item.B ?? undefined,
        optionC: item.optionC ?? item.option_c ?? item.C ?? undefined,
        optionD: item.optionD ?? item.option_d ?? item.D ?? undefined,
        correctAnswer: correct,
        caseTitle: item.caseTitle ?? item.case ?? undefined,
      });
    }
    return { ok: true, questions };
  } catch {
    return { ok: false, error: 'Invalid JSON format.' };
  }
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseExcel(workbook: XLSX.WorkBook): { ok: true; questions: ExpertParsedQuestion[] } | { ok: false; error: string } {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { ok: false, error: 'No sheet found in Excel file.' };

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, string | undefined>[] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as Record<string, string | undefined>[];

  if (rows.length < 2) return { ok: false, error: 'Excel must have at least a header row and one data row.' };

  const headerRow = rows[0] as unknown as string[];
  const headers = headerRow.map((h) => (h ?? '').toLowerCase().trim());

  const qIdx = headers.findIndex((h) => normalizeHeader(h).includes('question'));
  const typeIdx = headers.findIndex((h) => normalizeHeader(h).includes('type'));
  const aIdx = headers.findIndex((h) => normalizeHeader(h).includes('optiona'));
  const bIdx = headers.findIndex((h) => normalizeHeader(h).includes('optionb'));
  const cIdx = headers.findIndex((h) => normalizeHeader(h).includes('optionc'));
  const dIdx = headers.findIndex((h) => normalizeHeader(h).includes('optiond'));
  const ansIdx = headers.findIndex((h) => normalizeHeader(h).includes('correct'));
  const caseIdx = headers.findIndex((h) => normalizeHeader(h).includes('case'));

  if (qIdx === -1 || ansIdx === -1) {
    return { ok: false, error: 'Excel must have "questionText" and "correctAnswer" columns.' };
  }

  const questions: ExpertParsedQuestion[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] as unknown as string[];
    const qText = (cells[qIdx] ?? '').toString().trim();
    if (!qText) continue;

    const correct = (cells[ansIdx] ?? 'A').toString().charAt(0).toUpperCase();
    const typeVal = cells[typeIdx] ?? 'selection-choice';
    const caseTitle = (cells[caseIdx] ?? '').toString().trim();

    questions.push({
      questionText: qText,
      type: typeVal,
      optionA: (cells[aIdx] ?? '').toString().trim() || undefined,
      optionB: (cells[bIdx] ?? '').toString().trim() || undefined,
      optionC: (cells[cIdx] ?? '').toString().trim() || undefined,
      optionD: (cells[dIdx] ?? '').toString().trim() || undefined,
      correctAnswer: correct,
      caseTitle: caseTitle || undefined,
    });
  }

  return { ok: true, questions };
}

function downloadSample(type: 'csv' | 'json' | 'paste') {
  const content = type === 'csv' ? SAMPLE_CSV : type === 'json' ? SAMPLE_JSON : SAMPLE_PASTE;
  const ext = type === 'csv' ? 'csv' : type === 'json' ? 'json' : 'txt';
  const mime = type === 'json' ? 'application/json' : type === 'csv' ? 'text/csv' : 'text/plain';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expert_sample_questions.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExpertQuestionImportDialog({ open, onClose, onImport }: ExpertQuestionImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>('paste');
  const [pasteText, setPasteText] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<{ ok: true; questions: ExpertParsedQuestion[] } | { ok: false; error: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parse = useCallback(() => {
    if (mode === 'paste') {
      if (!pasteText.trim()) return;
      const questions = parsePaste(pasteText);
      setParseResult({ ok: true, questions });
    } else if (mode === 'csv') {
      if (!fileContent.trim()) return;
      setParseResult(parseCSV(fileContent));
    } else if (mode === 'json') {
      if (!fileContent.trim()) return;
      setParseResult(parseJSON(fileContent));
    } else if (mode === 'excel') {
      // Excel is parsed in handleFile, so nothing to do here
      return;
    }
  }, [mode, pasteText, fileContent]);

  const reset = () => {
    setPasteText('');
    setFileContent('');
    setFileName('');
    setParseResult(null);
  };

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      setMode('excel');
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const result = parseExcel(workbook);
          setParseResult(result);
          setFileContent('');
        } catch {
          setParseResult({ ok: false, error: 'Cannot read Excel file.' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
      setMode('csv');
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target?.result as string ?? '');
      reader.readAsText(file);
    } else if (ext === 'json') {
      setMode('json');
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target?.result as string ?? '');
      reader.readAsText(file);
    } else if (ext === 'txt') {
      setMode('paste');
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target?.result as string ?? '');
      reader.readAsText(file);
    } else {
      toast.error('Unsupported file type. Please use Excel (.xlsx/.xls), CSV, JSON, or TXT.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!parseResult?.ok || parseResult.questions.length === 0) return;
    setImporting(true);
    await new Promise((r) => setTimeout(r, 300));
    onImport(parseResult.questions);
    setImporting(false);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-md"
      role="presentation"
      onClick={onClose}
    >
      <div className="flex min-h-[100dvh] items-center justify-center p-4 pb-8 sm:p-6 sm:pb-10">
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex w-full max-h-[min(90dvh,calc(100dvh-4rem))] min-h-0 max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-8 py-6">
            <div>
              <h2 className="font-['Manrope',sans-serif] text-2xl font-extrabold text-card-foreground">
                Import Questions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Import from Excel (.xlsx/.xls), CSV, JSON files or paste directly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
            {/* Mode Tabs */}
            <div className="mb-6 flex gap-2 rounded-2xl bg-muted p-1">
              {(
                [
                  { key: 'paste', label: 'Paste Text', icon: ClipboardPaste },
                  { key: 'csv', label: 'CSV / Excel', icon: FileText },
                  { key: 'json', label: 'JSON File', icon: FileText },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    reset();
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
                    mode === key
                      ? 'bg-card text-card-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-card-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Sample Download */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Download sample files:</span>
              <button type="button" onClick={() => downloadSample('csv')} className="text-primary hover:underline cursor-pointer">
                CSV
              </button>
              <span>·</span>
              <button type="button" onClick={() => downloadSample('json')} className="text-primary hover:underline cursor-pointer">
                JSON
              </button>
              <span>·</span>
              <button type="button" onClick={() => downloadSample('paste')} className="text-primary hover:underline cursor-pointer">
                TXT
              </button>
              <span className="ml-2">
                (Columns: questionText, type, optionA, optionB, optionC, optionD, correctAnswer, caseTitle)
              </span>
            </div>

            {/* Input Area */}
            {mode === 'paste' ? (
              <div className="space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={SAMPLE_PASTE}
                  className="h-64 w-full resize-none rounded-2xl border border-border bg-muted/50 p-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Supports free-form format: separate questions with &quot;Q1&quot;, &quot;1.&quot; or &quot;Question 1&quot;;
                  answers with &quot;Answer: X&quot; (A–D); case with &quot;Case: Case name&quot;.
                </p>
              </div>
            ) : (
              <div
                className={`relative flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
                {fileName ? (
                  <>
                    <CheckCircle2 className="mb-2 h-8 w-8 text-green-600" />
                    <p className="font-bold text-card-foreground">{fileName}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="mt-2 flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-semibold text-card-foreground">Drag and drop file here</p>
                    <p className="mt-1 text-xs text-muted-foreground">or click to select file (.xlsx, .xls, .csv, .json, .txt)</p>
                  </>
                )}
              </div>
            )}

            {/* Parse Error */}
            {parseResult && !parseResult.ok && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {parseResult.error}
              </div>
            )}

            {/* Preview */}
            {parseResult?.ok && parseResult.questions.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-card-foreground">
                    Preview — {parseResult.questions.length} questions detected
                  </h3>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Clear &amp; reimport
                  </button>
                </div>
                <div className="max-h-[min(16rem,35svh)] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
                  {parseResult.questions.slice(0, 10).map((q, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-card p-3">
                      <p className="text-xs font-semibold text-card-foreground line-clamp-1">
                        {i + 1}. {q.questionText}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {q.type}
                        </span>
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                          Answer: {q.correctAnswer}
                        </span>
                        {q.caseTitle && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            Case: {q.caseTitle}
                          </span>
                        )}
                        {q.optionA && (
                          <span className="text-[10px] text-muted-foreground">A: {q.optionA}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {parseResult.questions.length > 10 && (
                    <p className="text-center text-xs text-muted-foreground">
                      … and {parseResult.questions.length - 10} more questions
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col items-stretch gap-3 border-t border-border px-8 py-6 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
            <div className="flex items-start justify-end gap-2 text-right text-xs text-muted-foreground sm:max-w-[55%]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {mode === 'paste'
                  ? 'Auto-parse from text. Check the preview before importing.'
                  : 'Supports standard CSV/JSON/Excel format. Check the preview before importing.'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {parseResult?.ok ? (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || parseResult.questions.length === 0}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Import {parseResult.questions.length} questions
                </button>
              ) : (
                <button
                  type="button"
                  onClick={parse}
                  disabled={
                    importing ||
                    (mode === 'paste' ? !pasteText.trim() : !fileName)
                  }
                  className="rounded-full bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Parse &amp; Preview
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
