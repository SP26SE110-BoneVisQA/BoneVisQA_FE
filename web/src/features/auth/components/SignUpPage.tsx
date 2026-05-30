"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { register } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCohort, setSchoolCohort] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (fullName.trim().length < 3) {
      setError("Full name must be at least 3 characters.");
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (schoolCohort.trim().length < 2) {
      setError("School cohort must be at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const data = await register({
        fullName,
        email,
        password,
        schoolCohort,
      });

      if (data.success) {
        setSuccessMessage(
          data.message ||
            "Registration successful! Please check your email and wait for admin approval.",
        );
      } else {
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Cannot connect to server.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-center shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container/30 text-on-secondary-container">
              <CheckCircle className="h-9 w-9" />
            </div>
            <h2 className="font-headline text-xl font-bold text-text-main">
              Registration Successful
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {successMessage}
            </p>
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
              Create an account
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Enter your details to join. After registration you will receive a
              welcome email and need to wait for an admin to approve your account.
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
                htmlFor="fullName"
                className="ml-1 block text-xs font-semibold text-on-surface-variant"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jane Doe"
                required
                className="mt-1.5 w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary-container/40"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="ml-1 block text-xs font-semibold text-on-surface-variant"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@medical-school.edu"
                required
                className="mt-1.5 w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary-container/40"
              />
            </div>

            <div>
              <label
                htmlFor="cohort"
                className="ml-1 block text-xs font-semibold text-on-surface-variant"
              >
                School Cohort
              </label>
              <input
                id="cohort"
                type="text"
                value={schoolCohort}
                onChange={(e) => setSchoolCohort(e.target.value)}
                placeholder="K68 Medical"
                required
                className="mt-1.5 w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary-container/40"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="ml-1 block text-xs font-semibold text-on-surface-variant"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 pr-11 text-sm text-text-main placeholder:text-outline/50 focus:outline-none focus:ring-2 focus:ring-primary-container/40 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant transition-colors hover:text-primary"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-gradient-to-br from-primary to-primary-container shadow-lg shadow-primary/20"
              isLoading={loading}
              disabled={loading}
            >
              Sign up
            </Button>
          </form>

          <div className="mt-8 border-t border-outline-variant/10 pt-6 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link
              href="/auth/sign-in"
              className="font-bold text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
