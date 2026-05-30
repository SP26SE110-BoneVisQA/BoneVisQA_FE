"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, ArrowLeft } from "lucide-react";
import { forgotPassword } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      if (data.success) {
        setDone(true);
      } else {
        setError(data.message || "Request failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection error.";
      setError(msg.includes("Cannot reach the API") ? msg : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen w-full bg-background px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-border-color bg-surface px-8 py-10 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
            <h1 className="font-headline text-xl font-bold text-text-main">
              Check your inbox
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              If that email exists in our system, you will receive password
              reset instructions. Please also check your spam folder.
            </p>
            <Link
              href="/auth/sign-in"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-text-main">
            BoneVisQA
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-text-muted opacity-80">
            Medical Education Platform
          </p>
        </div>

        <div className="rounded-[28px] border border-border-color bg-surface-container-lowest p-8 shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
          <div className="mb-8">
            <h2 className="font-headline text-xl font-bold text-text-main">
              Forgot your password?
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Enter your registered email — we will send a password reset link.
            </p>
          </div>

          {error ? (
            <div className="mb-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.edu"
                required
                className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              isLoading={loading}
              disabled={loading}
            >
              Send reset link
            </Button>
          </form>

          <div className="mt-8 border-t border-outline-variant/10 pt-6 text-center text-sm text-text-muted">
            <Link href="/auth/sign-in" className="font-bold text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
