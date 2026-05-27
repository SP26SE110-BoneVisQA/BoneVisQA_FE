"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  Activity,
  Cpu,
  Eye,
  EyeOff,
  ScanSearch,
  Stethoscope,
} from "lucide-react";

/** Hand X-ray art inside hero (same as clinical mock) */
const AUTH_HERO_HAND_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAiGfyZ6N39coIC7rt9DV9aTzXRG6RQ_nWQrUfzvseTJTzVHZoXBwSIv12MmBhmdXCKbWX0yOvO1cYV7PD9UfLA4HJ5LJYbR5a7WCRZcFGuxPOQFKKtjmvoRikeflzrb1pXA0mbuqokEkhF31OBtOpjFP3RpC7nRzCvmcywMrtx7pTIWOhPMdPOVWxuysyjObpLWjp8rLnbU0NHM3ZEABxi3ERbJ1OOoVoLkfdOfqi-tAhLVrWIPi3aK0AnSjh9PsC7a76wlp81auU";
import { login } from "@/lib/api/auth";
import {
  http,
  getPublicAuthErrorMessage,
  sanitizeUserFacingLoginMessage,
} from "@/lib/api/client";
import type { LoginResponse } from "@/lib/api/types";
import { useToast } from "@/components/ui/toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const motionEase = [0.22, 1, 0.36, 1] as const;

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            locale?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
          prompt?: () => void;
        };
      };
    };
  }
}

function getRouteForRole(role: string | null | undefined) {
  switch (role?.trim().toLowerCase()) {
    case "student":
      return { activeRole: "student", route: "/student/dashboard" };
    case "lecturer":
      return { activeRole: "lecturer", route: "/lecturer/dashboard" };
    case "expert":
      return { activeRole: "expert", route: "/expert/dashboard" };
    case "admin":
      return { activeRole: "admin", route: "/admin/dashboard" };
    case "guest":
      return { activeRole: null, route: "/pending-approval" };
    default:
      return { activeRole: null, route: "/" };
  }
}

function isGuestOrUnassignedUser(payload: {
  roles?: string[] | null;
  status?: string | null;
  userStatus?: string | null;
}) {
  const normalizedStatus = (payload.status ?? payload.userStatus ?? '').trim().toLowerCase();
  if (normalizedStatus === 'guest') {
    return true;
  }

  const roles = Array.isArray(payload.roles)
    ? payload.roles.map((r) => r.trim().toLowerCase()).filter(Boolean)
    : [];
  if (roles.length === 0) {
    return true;
  }
  if (roles.includes('none') || roles.includes('unassigned') || roles.includes('guest')) {
    return true;
  }
  return false;
}

type LoginPageInnerProps = {
  googleEnabled: boolean;
  googleClientId: string;
};

/** Renders the full login UI. Google Sign-In uses the GSI script and `/api/auths/google-login`. */
function LoginPageInner({ googleEnabled, googleClientId }: LoginPageInnerProps) {
  const router = useRouter();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gsiScriptReady, setGsiScriptReady] = useState(false);
  const [gsiError, setGsiError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const isGsiInitialized = useRef(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Listen for GSI timeout event
  useEffect(() => {
    if (!googleEnabled) return;

    const handleGsiTimeout = () => {
      setGsiError("Google Sign-In failed to load. Please check your internet connection and disable any ad blockers, then refresh the page.");
    };

    document.addEventListener("gsi-timeout", handleGsiTimeout);
    return () => document.removeEventListener("gsi-timeout", handleGsiTimeout);
  }, [googleEnabled]);

  useEffect(() => {
    // Fallback: if GSI doesn't load after 3 seconds and there's no error, try to proceed
    const timeout = setTimeout(() => {
      if (window.google?.accounts?.id) {
        setGsiScriptReady(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  const handleLoginSuccess = useCallback(
    (data: LoginResponse) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("fullName", data.fullName);
      localStorage.setItem("email", data.email);
      localStorage.setItem("roles", JSON.stringify(data.roles));
      const resolvedStatus = data.status ?? data.userStatus ?? null;
      if (resolvedStatus) {
        localStorage.setItem("userStatus", resolvedStatus);
      } else {
        localStorage.removeItem("userStatus");
      }

      if (isGuestOrUnassignedUser(data)) {
        localStorage.removeItem("activeRole");
        router.push("/pending-approval");
        return;
      }

      const primaryRole = Array.isArray(data.roles)
        ? data.roles.find((role: string) => getRouteForRole(role).activeRole)
        : null;
      const { activeRole, route } = getRouteForRole(primaryRole);

      if (activeRole) {
        localStorage.setItem("activeRole", activeRole);
      } else {
        localStorage.removeItem("activeRole");
      }

      router.push(route);
    },
    [router],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.success && data.token && data.roles) {
        handleLoginSuccess(data);
        return;
      }

      const msg = sanitizeUserFacingLoginMessage(
        data.message,
        "Invalid email or password.",
      );
      setError(msg);
      toast.error(msg);
    } catch (err: unknown) {
      const message = getPublicAuthErrorMessage(err, "credentials");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginSuccess = useCallback(async (
    credentialResponse: GoogleCredentialResponse,
  ) => {
    setError("");
    setLoading(true);

    try {
      if (!credentialResponse.credential) {
        throw new Error("Google did not return a credential token.");
      }

      const { data } = await http.post("/api/auths/google-login", {
        idToken: credentialResponse.credential,
      });

      if (data.success && data.token && data.roles) {
        handleLoginSuccess(data);
      } else if (data.success && data.requiresMedicalVerification) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId ?? "");
        localStorage.setItem("fullName", data.fullName ?? "");
        localStorage.setItem("email", data.email ?? "");
        toast.success(data.message || "Please confirm your medical information to complete registration.");
        router.push("/auth/medical-verification");
      } else {
        const message = sanitizeUserFacingLoginMessage(
          data.message,
          "Google sign-in was not accepted. Please try again or use email and password.",
        );
        setError(message);
        toast.error(message);
      }
    } catch (err: unknown) {
      const message = getPublicAuthErrorMessage(err, "google");
      if (process.env.NODE_ENV === "development") {
        console.warn("[Google sign-in]", err);
      }
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [handleLoginSuccess, router, toast]);

  const triggerGoogleSignIn = useCallback(() => {
    // If GSI is ready, use it
    if (window.google?.accounts?.id) {
      const tryClick = (attempt: number) => {
        const root = googleButtonRef.current;
        if (!root) {
          toast.error("Google sign-in is still loading. Please try again.");
          return;
        }
        const el = root.querySelector<HTMLElement>('[role="button"]');
        if (el) {
          el.click();
          return;
        }
        if (attempt < 15) {
          window.setTimeout(() => tryClick(attempt + 1), 50);
          return;
        }
        toast.error("Google sign-in is still loading. Please try again.");
      };
      tryClick(0);
    } else {
      // Fallback: Open Google OAuth in a new tab/redirect
      const clientId = googleClientId;
      const redirectUri = `${window.location.origin}/auth/sign-in`;
      const scope = encodeURIComponent("openid email profile");
      const responseType = "id_token";
      const nonce = Math.random().toString(36).substring(2, 15);

      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&nonce=${nonce}&prompt=select_account`;

      // Try to open in current window (redirect)
      window.location.href = oauthUrl;
    }
  }, [googleClientId, toast]);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGsiScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || isGsiInitialized.current) return;
    const gsi = window.google?.accounts?.id;
    const target = googleButtonRef.current;
    if (!gsiScriptReady || !gsi || !target) return;

    target.innerHTML = "";
    gsi.initialize({
      client_id: googleClientId,
      callback: (response) => {
        void handleGoogleLoginSuccess(response);
      },
      locale: "en",
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    gsi.renderButton(target, {
      theme: "outline",
      size: "large",
      shape: "pill",
      type: "standard",
      text: "signin_with",
      logo_alignment: "left",
      width: 300,
      ux_mode: "redirect",
    });

    isGsiInitialized.current = true;
  }, [googleEnabled, googleClientId, gsiScriptReady, handleGoogleLoginSuccess]);

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950">
      {googleEnabled ? (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onLoad={() => {
              setGsiScriptReady(true);
            }}
            onError={() => {
              console.error("Failed to load GSI script");
              setError("Failed to load Google Sign-In. Please check your internet connection.");
            }}
          />
          <Script id="gsi-timeout-check" strategy="afterInteractive">{`
            setTimeout(function() {
              if (!window.google || !window.google.accounts || !window.google.accounts.id) {
                console.warn("GSI script did not load in time");
                document.dispatchEvent(new CustomEvent("gsi-timeout"));
              }
            }, 10000);
          `}</Script>
        </>
      ) : null}
      {/*
        dir="ltr" keeps hero on the left and form on the right regardless of browser locale.
        max-lg:hidden avoids Tailwind hidden/lg:flex ordering quirks; flex-col keeps content stacked.
        Background uses z-0 + isolate so it cannot paint over text/icons (z-10).
      */}
      <div
        dir="ltr"
        className="grid min-h-[100dvh] w-full grid-cols-1 items-stretch lg:grid-cols-[1.22fr_1fr]"
      >
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: motionEase }}
          className="relative isolate max-lg:hidden min-h-[100dvh] w-full min-w-0 overflow-hidden bg-[#0A0A14] lg:flex lg:min-h-0 lg:flex-col"
        >
          {/* Animated mesh — soft drifting blobs + grid (no heavy JS). */}
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            <div className="absolute -left-[10%] top-[8%] h-[min(52vw,420px)] w-[min(52vw,420px)] rounded-full bg-blue-500/25 blur-3xl animate-blob" />
            <div className="absolute right-[-8%] top-[22%] h-[min(48vw,380px)] w-[min(48vw,380px)] rounded-full bg-cyan-400/20 blur-3xl animate-blob-slow" />
            <div className="absolute bottom-[5%] left-[18%] h-[min(44vw,340px)] w-[min(44vw,340px)] rounded-full bg-indigo-500/20 blur-3xl animate-blob-delayed" />
            <div className="absolute right-[12%] top-[55%] h-[min(36vw,280px)] w-[min(36vw,280px)] rounded-full bg-sky-400/15 blur-3xl animate-blob" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.12),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(0,123,255,0.18),transparent_28%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:auto,auto,32px_32px,32px_32px]"
            aria-hidden
          />
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col justify-between px-10 py-12 xl:px-16 xl:py-14">
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-accent/30 bg-cyan-accent/10">
                <Stethoscope className="h-7 w-7 text-cyan-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-white">BoneVisQA</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-accent/70">
                  Radiology Education
                </p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center py-8">
              <div className="relative flex aspect-square w-full max-w-[420px] items-center justify-center rounded-[40px] border border-cyan-accent/10 bg-white/[0.02]">
                <div className="absolute inset-8 rounded-[32px] border border-cyan-accent/15" />
                <div className="absolute inset-x-[10%] top-[12%] bottom-[28%] rounded-[28px] border border-cyan-accent/25 bg-cyan-accent/[0.02] shadow-[0_0_45px_rgba(0,229,255,0.08)]" />
                <div className="absolute inset-x-[14%] top-[16%] bottom-[32%] overflow-hidden rounded-2xl border-2 border-cyan-accent/80 shadow-[0_0_30px_rgba(0,229,255,0.26)]">
                  <img
                    src={AUTH_HERO_HAND_IMAGE}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-[0.12]"
                  />
                  <span className="absolute left-4 top-3 rounded-full border border-cyan-accent/60 bg-[#0A0A14]/90 px-3 py-1 text-[10px] font-semibold tracking-[0.28em] text-cyan-accent backdrop-blur-sm">
                    AI BONE ANALYSIS
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center gap-6 text-cyan-accent/90">
                    <ScanSearch className="h-10 w-10 shrink-0" />
                    <Cpu className="h-10 w-10 shrink-0" />
                    <Activity className="h-10 w-10 shrink-0" />
                  </div>
                </div>
                <div className="absolute bottom-10 left-10 right-10 grid grid-cols-3 gap-2 text-[10px] text-slate-300 sm:gap-3 sm:text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 sm:px-3">
                    Lesion localization
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 sm:px-3">
                    Multimodal retrieval
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 sm:px-3">
                    Explainable report
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              className="max-w-xl shrink-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: motionEase }}
            >
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                BoneVisQA
              </h1>
              <p className="mt-3 text-base font-medium leading-relaxed text-cyan-accent/90 xl:text-lg">
                AI-Powered Interactive Visual Question Answering for Radiology
              </p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
                A medical imaging workspace for students, lecturers, experts, and administrators to
                analyze radiographs, validate AI reasoning, and accelerate radiology education.
              </p>
            </motion.div>
          </div>
        </motion.section>

        <section className="flex min-h-[100dvh] min-w-0 items-center justify-center bg-surface px-6 py-10 lg:min-h-0">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: motionEase }}
          >
            <div className="mb-8 text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Secure access
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-main">
                Sign in to BoneVisQA
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Continue to your clinical workspace with your institutional account.
              </p>
            </div>

            <motion.div
              className="rounded-[28px] border border-border-color bg-surface p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18, ease: motionEase }}
            >
              {error ? (
                <div className="mb-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-text-main"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.edu"
                    required
                    className="w-full rounded-xl border border-border-color bg-background px-4 py-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between px-0.5">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-text-main"
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full rounded-xl border border-border-color bg-background px-4 py-3 pr-11 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary [&::-ms-clear]:hidden [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" isLoading={loading} disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-color" />
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                  Or continue with
                </span>
                <div className="h-px flex-1 bg-border-color" />
              </div>

              {!googleEnabled ? (
                <div className="w-full rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Google sign-in is disabled: set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment file.
                </div>
              ) : (
                <div className="rounded-xl border border-border-color bg-background p-3">
                  <div className="mb-3 flex items-center gap-3 text-sm text-text-muted">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                      <span className="text-sm font-bold text-[#4285F4]">G</span>
                    </div>
                    <span>Google Login</span>
                  </div>
                  <a
                    href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/auth/sign-in' : '')}&response_type=id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(2, 15)}&prompt=select_account`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </a>
                </div>
              )}

              <p className="mt-8 text-center text-sm text-text-muted">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/sign-up"
                  className="font-bold text-primary hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const hasGoogleClientId = googleClientId.length > 0;
  return <LoginPageInner googleEnabled={hasGoogleClientId} googleClientId={googleClientId} />;
}
