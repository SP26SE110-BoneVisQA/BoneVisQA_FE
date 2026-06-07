'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Upload,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { UserRole } from '../UserManagementTable';
import { CreateUserPayload, bulkCreateUsers, type BulkImportUserItem, type BulkImportResult } from '@/lib/api/admin-users';

interface CreateUserDialogProps {
  onCancel: () => void;
  onConfirm: (payload: CreateUserPayload) => Promise<void>;
}

interface EditUserDialogProps {
  userId: string;
  initialFullName: string;
  initialCohort: string | undefined;
  onCancel: () => void;
  onConfirm: (userId: string, fullName: string, cohort: string | undefined) => Promise<void>;
}

interface DeleteConfirmDialogProps {
  userId: string;
  userName: string;
  onCancel: () => void;
  onConfirm: (userId: string) => Promise<void>;
}

interface ImportUsersDialogProps {
  onCancel: () => void;
  onSuccess: () => void;
}

// ── Create User Dialog ──────────────────────────────────────────────────────

export function CreateUserDialog({ onCancel, onConfirm }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cohort, setCohort] = useState('');
  const [role, setRole] = useState<UserRole>('Student');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onConfirm({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        schoolCohort: cohort.trim() || undefined,
        role,
        sendWelcomeEmail: sendEmail,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg animate-in rounded-2xl bg-white p-6 shadow-2xl duration-200 fade-in zoom-in-95">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <UserPlus className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Create new user</h3>
            <p className="text-sm text-slate-500">Fill in the details to create a new account.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Nguyen Van A"
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.fullName ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'
                }`}
              />
            </div>
            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.edu"
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.email ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'
                }`}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-12 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.password ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Cohort + Role row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cohort</label>
              <input
                type="text"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="e.g. VNU"
                className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-slate-800 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-slate-800 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Student">Student</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Expert">Expert</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Send welcome email toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            <span className="text-sm font-medium text-slate-700">
              Send welcome email with account credentials
            </span>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create user
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit User Dialog ─────────────────────────────────────────────────────────

export function EditUserDialog({
  userId,
  initialFullName,
  initialCohort,
  onCancel,
  onConfirm,
}: EditUserDialogProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [cohort, setCohort] = useState(initialCohort ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onConfirm(userId, fullName.trim(), cohort.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md animate-in rounded-2xl bg-white p-6 shadow-2xl duration-200 fade-in zoom-in-95">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <UserCog className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Edit user</h3>
            <p className="text-sm text-slate-500">Update name and cohort information.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.fullName ? 'border-red-400' : 'border-border focus:border-primary'
                }`}
              />
            </div>
            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cohort</label>
            <input
              type="text"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              placeholder="e.g. VNU"
              className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-slate-800 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <p className="rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            <strong>Note:</strong> To change the user&apos;s role, use the &ldquo;Change role&rdquo; button in the user row. Email cannot be changed.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Dialog ──────────────────────────────────────────────

export function DeleteConfirmDialog({
  userId,
  userName,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(userId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md animate-in rounded-2xl bg-white p-8 shadow-2xl duration-200 fade-in zoom-in-95">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>

        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-8 border-rose-100/60 bg-rose-50">
          <User className="h-8 w-8 text-rose-600" />
        </div>

        <h3 className="mb-2 text-center text-2xl font-bold text-slate-800">Delete user?</h3>
        <p className="mb-6 px-2 text-center text-sm text-slate-500">
          Are you sure you want to permanently delete{' '}
          <strong className="font-bold text-slate-800">{userName}</strong>? This action cannot be undone and will remove all their data from the system.
        </p>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-700">
            Warning: All associated data — learning progress, quiz attempts, expert reviews, and more — will be permanently lost.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yes, delete user
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Users Dialog ────────────────────────────────────────────────────────

const SAMPLE_CSV = `Email,FullName,Password,SchoolCohort,Role
student1@example.edu,Nguyen Van A,Pass123456,Class 2025-A,Student
student2@example.edu,Tran Thi B,Pass123456,Class 2025-A,Student
lecturer1@example.edu,Dr. John Smith,Pass123456,,Lecturer
expert1@example.edu,Dr. Jane Doe,Pass123456,,Expert`;

const ROLES: UserRole[] = ['Student', 'Lecturer', 'Expert', 'Admin'];
const REQUIRED_COLUMNS = ['Email', 'FullName', 'Password', 'SchoolCohort', 'Role'];

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function ImportUsersDialog({ onCancel, onSuccess }: ImportUsersDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<BulkImportUserItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setParseErrors([]);
    parseFile(selectedFile);
  };

  const parseFile = async (f: File) => {
    const text = await f.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      setParseErrors(['File must have a header row and at least one data row.']);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const missingCols = REQUIRED_COLUMNS.filter(
      (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()),
    );
    if (missingCols.length > 0) {
      setParseErrors([
        `Missing required columns: ${missingCols.join(', ')}.`,
        `Required columns: ${REQUIRED_COLUMNS.join(', ')}.`,
      ]);
      return;
    }

    const emailIdx = headers.findIndex((h) => h.toLowerCase() === 'email');
    const fullNameIdx = headers.findIndex((h) => h.toLowerCase() === 'fullname');
    const passwordIdx = headers.findIndex((h) => h.toLowerCase() === 'password');
    const cohortIdx = headers.findIndex((h) => h.toLowerCase() === 'schoolcohort');
    const roleIdx = headers.findIndex((h) => h.toLowerCase() === 'role');

    const users: BulkImportUserItem[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(lines[i]);
      const row = i + 1;

      const email = values[emailIdx]?.trim() ?? '';
      const fullName = values[fullNameIdx]?.trim() ?? '';
      const password = values[passwordIdx]?.trim() ?? '';
      const cohort = values[cohortIdx]?.trim() || undefined;
      const role = values[roleIdx]?.trim() ?? '';

      if (!email) {
        errors.push(`Row ${row}: Email is required.`);
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Row ${row}: Invalid email format "${email}".`);
        continue;
      }
      if (!fullName || fullName.length < 2) {
        errors.push(`Row ${row}: Full name must be at least 2 characters.`);
        continue;
      }
      if (!password || password.length < 6) {
        errors.push(`Row ${row}: Password must be at least 6 characters.`);
        continue;
      }
      if (!ROLES.includes(role as UserRole)) {
        errors.push(`Row ${row}: Invalid role "${role}". Valid roles: ${ROLES.join(', ')}.`);
        continue;
      }

      users.push({
        email,
        fullName,
        password,
        schoolCohort: cohort,
        role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
        sendWelcomeEmail: sendEmail,
      });
    }

    if (errors.length > 0 && users.length === 0) {
      setParseErrors(errors);
      return;
    }

    setParseErrors(errors);
    setParsedUsers(users);
    setStep('preview');
  };

  const handleImport = async () => {
    if (parsedUsers.length === 0) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const payload = parsedUsers.map((u) => ({
        ...u,
        sendWelcomeEmail: sendEmail,
      }));
      const importResult = await bulkCreateUsers(payload);
      setResult(importResult);
      setStep('result');
      if (importResult.successCount > 0) {
        onSuccess();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_users_import.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderUploadStep = () => (
    <div className="space-y-5">
      <div
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h4 className="mb-1 text-base font-bold text-slate-800">Upload CSV file</h4>
        <p className="mb-3 text-sm text-slate-500">
          Click or drag a CSV file here to import users in bulk.
        </p>
        <p className="text-xs text-slate-400">
          Supported format: CSV with columns{' '}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px]">
            {REQUIRED_COLUMNS.join(', ')}
          </code>
        </p>
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3">
          <FileSpreadsheet className="h-5 w-5 flex-shrink-0 text-primary" />
          <span className="flex-1 truncate text-sm font-medium text-slate-700">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setParsedUsers([]);
              setParseErrors([]);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">Parse errors</span>
          </div>
          <ul className="space-y-1">
            {parseErrors.slice(0, 5).map((err, idx) => (
              <li key={idx} className="text-xs text-red-600">
                {err}
              </li>
            ))}
            {parseErrors.length > 5 && (
              <li className="text-xs text-red-500">
                ...and {parseErrors.length - 5} more errors.
              </li>
            )}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={downloadSample}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        <Download className="h-4 w-4" />
        Download sample CSV
      </button>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="text-xs font-medium text-amber-700">
          Review the data below before importing. {parsedUsers.length} user(s) ready to be created.
          {parseErrors.length > 0 && (
            <span className="ml-1 text-amber-800">
              ({parseErrors.length} row(s) skipped due to errors.)
            </span>
          )}
        </p>
      </div>

      <div className="max-h-64 overflow-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-xs">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Cohort</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Role</th>
            </tr>
          </thead>
          <tbody>
            {parsedUsers.map((user, idx) => (
              <tr key={idx} className="border-t border-border/60 even:bg-slate-50/50">
                <td className="px-3 py-2 truncate font-mono text-slate-700">{user.email}</td>
                <td className="px-3 py-2 truncate font-medium text-slate-800">{user.fullName}</td>
                <td className="px-3 py-2 truncate text-slate-600">{user.schoolCohort ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {user.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="h-4 w-4 rounded accent-emerald-600"
        />
        <span className="text-sm font-medium text-slate-700">
          Send welcome email to all imported users
        </span>
      </label>
    </div>
  );

  const renderResultStep = () => {
    if (!result) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {result.failureCount === 0 ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
          )}
          <div>
            <h4 className="text-lg font-bold text-slate-800">
              Import {result.failureCount === 0 ? 'Complete' : 'Finished with Errors'}
            </h4>
            <p className="text-sm text-slate-500">
              {result.successCount} user(s) created, {result.failureCount} failed
            </p>
          </div>
        </div>

        {result.successes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-emerald-700">
              Successfully imported ({result.successes.length}):
            </p>
            <div className="max-h-32 overflow-auto rounded-xl border border-emerald-200 bg-emerald-50/50">
              <ul className="space-y-1 p-3">
                {result.successes.map((s, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                    <span className="font-medium">{s.fullName}</span>
                    <span className="text-emerald-500">({s.email})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {result.errors.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-red-700">
              Failed ({result.errors.length}):
            </p>
            <div className="max-h-48 overflow-auto rounded-xl border border-red-200 bg-red-50/50">
              <ul className="space-y-1 p-3">
                {result.errors.map((e, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      <span className="font-medium">{e.email || `Row ${e.row}`}</span>
                      {' — '}
                      {e.error}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-2xl animate-in rounded-2xl bg-white p-6 shadow-2xl duration-200 fade-in zoom-in-95">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <Upload className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Import users from file</h3>
            <p className="text-sm text-slate-500">
              {step === 'upload' && 'Upload a CSV file to create multiple accounts at once.'}
              {step === 'preview' && 'Review and confirm the users to import.'}
              {step === 'result' && 'Review the import results.'}
            </p>
          </div>
        </div>

        <div className="mb-5 flex gap-2">
          {(['upload', 'preview', 'result'] as const).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : s === 'upload' ||
                        (s === 'preview' && step !== 'upload') ||
                        (s === 'result' && step === 'result')
                      ? 'bg-primary/20 text-primary'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {idx + 1}
              </div>
              <span
                className={`text-xs font-semibold ${
                  step === s ? 'text-primary' : 'text-slate-400'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {idx < 2 && <div className="h-px w-6 bg-slate-200" />}
            </div>
          ))}
        </div>

        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'result' && renderResultStep()}

        {submitError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-medium text-red-700">{submitError}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={
              step === 'upload'
                ? onCancel
                : step === 'preview'
                  ? () => {
                      setStep('upload');
                      setParsedUsers([]);
                      setParseErrors([]);
                    }
                  : onCancel
            }
            disabled={loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {step === 'result' ? 'Close' : 'Cancel'}
          </button>
          {step === 'preview' && (
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || parsedUsers.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-95 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Import {parsedUsers.length} user(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
