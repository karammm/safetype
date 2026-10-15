import type { AsyncModerationResult } from "@safetype/core";
import type { ModerationService } from "./service";

// Minimal structural types so Express is not a dependency.
interface Req {
  body?: unknown;
  safeType?: Record<string, AsyncModerationResult>;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): unknown;
}
type Next = (error?: unknown) => void;

/**
 * Express handler for the browser's `remoteClassifier`. Mount after `express.json()`:
 * `app.post("/api/safetype/classify", express.json(), expressClassifier(service))`
 */
export function expressClassifier(service: ModerationService) {
  return async (req: Req, res: Res, next: Next) => {
    try {
      const { status, body } = await service.classify(req.body, req);
      res.status(status).json(body);
    } catch (error) {
      next(error);
    }
  };
}

export interface GuardOptions {
  /** Body fields to check. */
  fields: string[];
  /** Replace each field with its masked text before your handler runs. Default true. */
  replace?: boolean;
  /** Status for blocked content. Default 422. */
  status?: number;
}

/**
 * Enforcement middleware: rejects blocked content before your route stores it (client-side moderation can
 * be bypassed). Results are available on `req.safeType[field]`.
 * `app.post("/comments", express.json(), expressGuard(service, { fields: ["body"] }), saveComment)`
 */
export function expressGuard(service: ModerationService, options: GuardOptions) {
  const { fields, replace = true, status = 422 } = options;
  return async (req: Req, res: Res, next: Next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const results: Record<string, AsyncModerationResult> = {};
      for (const field of fields) {
        const value = body[field];
        if (typeof value !== "string" || value === "") continue;
        const result = await service.check(value);
        results[field] = result;
        if (!result.allowed) {
          res.status(status).json({
            error: "Content violates community guidelines",
            field,
            violations: result.matches
              .filter((m) => m.action !== "allow")
              .map(({ category, ruleId, start, end, label }) => ({ category, ruleId, start, end, label })),
          });
          return;
        }
        if (replace) body[field] = result.text;
      }
      req.safeType = results;
      next();
    } catch (error) {
      next(error);
    }
  };
}
