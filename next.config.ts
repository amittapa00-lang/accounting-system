import type { NextConfig } from "next";

// Same value as PHASE_DEVELOPMENT_SERVER from "next/constants"; importing that module
// fails here when Next.js loads this config as ESM (it falls back to WASM bindings on this machine).
const PHASE_DEVELOPMENT_SERVER = "phase-development-server";

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

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;

  // Local fallback for `next dev --webpack` (e.g. when the OS blocks Turbopack's native
  // binary): run the same Tailwind loader on CSS. Only added for the dev server, because
  // `next build` uses Turbopack and fails if a `webpack` config is present.
  return {
    ...nextConfig,
    webpack(webpackConfig) {
      // `resource` rather than `test`: a top-level `test` matching CSS makes Next.js treat it
      // as a replacement CSS setup and disable its built-in CSS handling. This rule only
      // pre-processes the file before Next's own CSS loaders.
      webpackConfig.module.rules.push({
        resource: /\.css$/,
        enforce: "pre",
        use: [{ loader: "@tailwindcss/turbopack" }],
      });
      return webpackConfig;
    },
  };
}
