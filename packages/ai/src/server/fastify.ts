import type { AsyncModerationResult } from "@safetype/core";
import type { GuardOptions } from "./express";
import type { ModerationService } from "./service";

// Minimal structural types so Fastify is not a dependency.
interface FastifyRequestLike {
  body?: unknown;
  safeType?: Record<string, AsyncModerationResult>;
}
interface FastifyReplyLike {
  code(status: number): FastifyReplyLike;
  send(body: unknown): unknown;
}
interface FastifyLike {
  post(path: string, handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => Promise<unknown>): unknown;
}

export interface FastifySafeTypeOptions {
  service: ModerationService;
  /** Route for the browser's `remoteClassifier`. Default "/api/safetype/classify". */
  route?: string;
}

/** Fastify plugin registering the classify route: `app.register(fastifySafeType, { service })`. */
export async function fastifySafeType(fastify: FastifyLike, options: FastifySafeTypeOptions): Promise<void> {
  const { service, route = "/api/safetype/classify" } = options;
  fastify.post(route, async (request, reply) => {
    const { status, body } = await service.classify(request.body, request);
    return reply.code(status).send(body);
  });
}

/** `preHandler` hook that rejects blocked content: `{ preHandler: fastifyGuard(service, { fields: ["body"] }) }`. */
export function fastifyGuard(service: ModerationService, options: GuardOptions) {
  const { fields, replace = true, status = 422 } = options;
  return async (request: FastifyRequestLike, reply: FastifyReplyLike) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const results: Record<string, AsyncModerationResult> = {};
    for (const field of fields) {
      const value = body[field];
      if (typeof value !== "string" || value === "") continue;
      const result = await service.check(value);
      results[field] = result;
      if (!result.allowed) {
        return reply.code(status).send({
          error: "Content violates community guidelines",
          field,
          violations: result.matches
            .filter((m) => m.action !== "allow")
            .map(({ category, ruleId, start, end, label }) => ({ category, ruleId, start, end, label })),
        });
      }
      if (replace) body[field] = result.text;
    }
    request.safeType = results;
  };
}
