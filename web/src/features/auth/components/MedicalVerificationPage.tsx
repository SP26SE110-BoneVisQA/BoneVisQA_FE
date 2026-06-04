"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  GraduationCap,
  FileText,
} from "lucide-react";
import { requestMedicalVerification } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function MedicalVerificationPage() {
  const router = useRouter();
  const toast = useToast();
  const [medicalSchool, setMedicalSchool] = useState("");
  const [medicalStudentId, setMedicalStudentId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.replace("/auth/sign-in");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!medicalSchool.trim()) {
      setError("Medical school name is required.");
      return;
    }
    if (!medicalStudentId.trim()) {
      setError("Medical student ID is required.");
      return;
    }

    setLoading(true);

    try {
      const userId = localStorage.getItem("userId");
      const data = await requestMedicalVerification(
        {
          medicalSchool: medicalSchool.trim(),
          medicalStudentId: medicalStudentId.trim(),
        },
        userId ?? undefined
      );

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || "Failed to submit verification request.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-center shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container/30 text-on-secondary-container">
              <CheckCircle className="h-9 w-9" />
            </div>
            <h2 className="font-headline text-xl font-bold text-text-main">
              Request Submitted
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {success
                ? "Your medical student verification request has been submitted. An admin will review your information and notify you via email once approved."
                : "Your medical student verification request has been submitted. An admin will review your information."}
            </p>
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
              <p className="text-xs font-semibold text-primary">What happens next?</p>
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                <li>1. An admin will review your medical school and student ID.</li>
                <li>2. You will receive an email once approved.</li>
                <li>3. Your account will be activated with the appropriate role.</li>
              </ul>
            </div>
            <Link
              href="/auth/sign-in"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-surface-container-high py-3 text-sm font-semibold text-text-main transition-colors hover:bg-surface-container-highest"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Stethoscope className="h-9 w-9" />
          </div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-text-main">
            BoneVisQA
          </h1>
          <p className="mt-1 text-sm font-medium uppercase tracking-widest text-text-muted opacity-80">
            Medical Education Platform
          </p>
        </div>

        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
          <div className="mb-8">
            <h2 className="font-headline text-xl font-bold text-text-main">
              Medical Student Verification
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Since you signed in with Google, please provide your medical school information
              to access medical education content. An admin will review and approve your request.
            </p>
          </div>

          {error ? (
            <div className="mb-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-text-main">
                    Why is this required?
                  </span>
                  <span className="block text-xs text-text-muted">
                    Medical education content is restricted to verified medical students.
                    Your information will be reviewed by an administrator.
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="medicalSchool"
                className="ml-1 block text-xs font-semibold text-on-surface-variant"
              >
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  Medical School Name
                </span>
              </label>
              <input
                id="medicalSchool"
                type="text"
                value={medicalSchool}
                onChange={(e) => setMedicalSchool(e.target.value)}
                placeholder="e.g., Hanoi Medical University"
                required
                className="mt-1.5 w-full rounded-xl border border-outline/30 bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label
                htmlFor="medicalStudentId"
                className="ml-1 flex items-center gap-1 block text-xs font-semibold text-on-surface-variant"
              >
                <FileText className="h-3 w-3" />
                Medical Student ID
              </label>
              <input
                id="medicalStudentId"
                type="text"
                value={medicalStudentId}
                onChange={(e) => setMedicalStudentId(e.target.value)}
                placeholder="e.g., MED2024001"
                required
                className="mt-1.5 w-full rounded-xl border border-outline/30 bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="rounded-lg bg-amber-500/10 p-3">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> Your information will be reviewed by an admin. You will
                receive an email once your account is approved.
              </p>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-gradient-to-br from-primary to-primary-container shadow-lg shadow-primary/20"
              isLoading={loading}
              disabled={loading}
            >
              Submit Verification Request
            </Button>
          </form>

          <div className="mt-8 border-t border-outline-variant/10 pt-6 text-center text-sm text-text-muted">
            <Link
              href="/auth/sign-in"
              className="flex items-center justify-center gap-1 font-bold text-primary underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
