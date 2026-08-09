/** @type {import('next').NextConfig} */

// NEXT_PUBLIC_* values are inlined into the client bundle at build time, not
// read at runtime. A production build without the Supabase keys therefore
// ships a site permanently stuck in demo mode, and adding the variables to the
// host afterwards changes nothing until it is rebuilt — which is a confusing
// thing to discover from the live site. Say it in the build log instead.
if (process.env.NODE_ENV === "production") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn(
      [
        "",
        "  ⚠  Supabase keys are missing from this production build.",
        "     The deployed site will run in demo mode: no real accounts,",
        "     no Google sign-in, no teacher/student links.",
        "",
        "     Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "     in the hosting provider's environment variables, then REDEPLOY —",
        "     these are baked in at build time, so a restart is not enough.",
        "",
      ].join("\n")
    );
  }
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

module.exports = nextConfig;
