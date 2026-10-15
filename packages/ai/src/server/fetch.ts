import type { ModerationService } from "./service";

/**
 * Web-standard handler (Next.js route handlers, Cloudflare Workers, Deno, Bun, Hono):
 * `export const POST = createFetchHandler(service);`
 */
export function createFetchHandler(service: ModerationService) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { allow: "POST" } });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { status, body: json } = await service.classify(body, request);
    return Response.json(json, { status });
  };
}
