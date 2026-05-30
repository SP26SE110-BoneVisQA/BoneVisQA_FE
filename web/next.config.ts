import type { NextConfig } from "next";

function getSupabaseHostnameFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = getSupabaseHostnameFromEnv();

/**
 * Google Identity Services uses postMessage across origins. A strict COOP breaks the flow;
 * relax COOP only on auth routes (not site-wide).
 * @see https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
 */
const authPagesCoopHeaders = [
  {
    key: "Cross-Origin-Opener-Policy",
    value: "unsafe-none",
  },
] as const;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/**",
          },
        ]
      : [],
  },
  async redirects() {
    return [
      { source: "/login", destination: "/auth/sign-in", permanent: false },
      { source: "/register", destination: "/auth/sign-up", permanent: false },
      { source: "/forgot-password", destination: "/auth/forgot-password", permanent: false },
      { source: "/reset-password", destination: "/auth/reset-password", permanent: false },
      { source: "/student/qa", destination: "/student/visual-qa/workspace", permanent: false },
      { source: "/student/qa/topic", destination: "/student/visual-qa/workspace", permanent: false },
      { source: "/student/qa/topic/:topicId", destination: "/student/visual-qa/workspace", permanent: false },
      { source: "/student/visual-qa/upload", destination: "/student/visual-qa/workspace", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/auth/sign-in",
        headers: [...authPagesCoopHeaders],
      },
      {
        source: "/auth/sign-up",
        headers: [...authPagesCoopHeaders],
      },
    ];
  },
};

export default nextConfig;
