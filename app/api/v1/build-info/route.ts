import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    app: "zernflow",
    nodeEnv: process.env.NODE_ENV ?? null,
    commit:
      process.env.GIT_COMMIT_SHA ??
      process.env.SOURCE_COMMIT ??
      process.env.NEXT_PUBLIC_APP_VERSION ??
      null,
    generatedAt: new Date().toISOString(),
    marker: "growth-error-boundary-2026-06-01",
  });
}
