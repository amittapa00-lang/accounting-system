import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // pdfkit reads its font metric files from its own folder at runtime, so it must not be bundled
  serverExternalPackages: ["pdfkit"],
  // These routes read files from templates/ at runtime (fs.readFile), which file tracing
  // cannot see. Without this, Vercel deploys the functions without the files.
  outputFileTracingIncludes: {
    "/api/invoices/*/pdf": ["./templates/forms/**/*", "./templates/fonts/**/*"],
    "/api/invoices/*/excel": ["./templates/invoice-template.xlsx"],
  },
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
