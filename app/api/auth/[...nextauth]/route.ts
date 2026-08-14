import { handlers, isAuthConfigured } from "@/auth";
import {
  genericError,
  requireSameOrigin,
} from "@/app/lib/security/request-security";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function unavailable() {
  return Response.json(
    { error: "Authentication is unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) return unavailable();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) return unavailable();
  try {
    requireSameOrigin(request);
  } catch {
    return genericError(403);
  }
  return handlers.POST(request);
}
