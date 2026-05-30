"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Stethoscope, Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token.trim()) {
      setError(
        "Missing token. Open the link from your email or paste the token below.",
      );
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword(token.trim(), password);
      if (data.success) {
        router.push("/auth/sign-in");
        return;
      }
      setError(data.message || "Could not reset password.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection error.";
      setError(msg.includes("Cannot reach the API") ? msg : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        </div>

        <div className="rounded-[28px] border border-border-color bg-surface-container-lowest p-8 shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
          <h2 className="font-headline text-xl font-bold text-text-main">
            Reset Password
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Enter your new password below.
          </p>

          {error ? (
            <div className="mt-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {!tokenFromUrl ? (
              <div>
                <label
                  htmlFor="token"
                  className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                >
                  Token (from email link)
                </label>
                <input
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token if link did not redirect automatically"
                  className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ) : null}

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 pr-11 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
              >
                Confirm Password
              </label>
              <input
                id="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={loading}
              disabled={loading}
            >
              Update Password
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-text-muted">
            <Link href="/auth/sign-in" className="font-bold text-primary hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-text-muted">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
