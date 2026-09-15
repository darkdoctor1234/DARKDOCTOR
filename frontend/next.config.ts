import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  // Disable in development — avoids stale-cache confusion while building
  disable: process.env.NODE_ENV === "development",
  // Cache all Next.js static assets + pages on first visit
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // Reload the app automatically when the user comes back online
  reloadOnOnline: true,
  // Show /offline page when the user is offline and the page isn't cached
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // Silence the "webpack config present but using Turbopack" warning in dev.
  // next-pwa adds a webpack config; Turbopack is only used for `next dev`
  // anyway — the service worker is disabled in development regardless.
  turbopack: {},
};

export default withPWA(nextConfig);
