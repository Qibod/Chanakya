import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@grc/ui"],
  experimental: {
    clientTraceMetadata: ["sentry-trace", "baggage"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env["SENTRY_ORG"],
  project: process.env["SENTRY_PROJECT"],
  silent: !process.env["CI"],
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: {
    reactComponentAnnotation: { enabled: true },
    treeshake: { removeDebugLogging: true },
  },
});
