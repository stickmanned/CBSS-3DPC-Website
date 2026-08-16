import { z } from "zod";
import { getQueueSecrets } from "@/app/lib/config/queue";
import { consumeRawRateLimit } from "@/app/lib/queue/rate-limit";
import { createQueueRepository } from "@/app/lib/queue/repository";
import { QueueService } from "@/app/lib/queue/service";
import {
  STATUS_SESSION_SECONDS,
  statusCookieName,
  statusRoutePath,
} from "@/app/lib/queue/status-access";
import {
  clientIp,
  genericError,
  readJsonBody,
  requireJsonRequest,
  requireSameOrigin,
  UnsafeRequestError,
} from "@/app/lib/security/request-security";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  ref: z.string().trim().toUpperCase().regex(/^CBSS-[0-9]{4}$/),
  token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    requireJsonRequest(request);
    const input = exchangeSchema.parse(await readJsonBody(request, 8 * 1024));
    const secrets = getQueueSecrets();
    const ip = clientIp(request);
    const rateLimit = await consumeRawRateLimit({
      scope: "status-exchange-ip",
      rawIdentifier: ip,
      hmacSecret: secrets.identifierHmacSecret,
      limit: 60,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) {
      const response = genericError(429);
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return response;
    }

    const queue = new QueueService(createQueueRepository(), secrets);
    const found = await queue.findForRequester(input.ref, input.token);
    if (!found) return genericError(404);

    const response = new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
      },
    });
    const secure = process.env.NODE_ENV === "production";
    response.headers.append(
      "Set-Cookie",
      `${statusCookieName(input.ref)}=${input.token}; Path=${statusRoutePath(input.ref)}; Max-Age=${STATUS_SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    const cause = { route: "status/exchange", error };
    if (error instanceof z.ZodError || error instanceof UnsafeRequestError) {
      return genericError(400, cause);
    }
    return genericError(503, cause);
  }
}
