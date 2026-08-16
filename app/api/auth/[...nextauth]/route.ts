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
  } catch (error) {
    // Every other route records why it refused; this one used to swallow it,
    // which made a failed sign-in indistinguishable from a forged request.
    return genericError(403, { route: "api/auth", error });
  }
  return handlers.POST(request);
}
