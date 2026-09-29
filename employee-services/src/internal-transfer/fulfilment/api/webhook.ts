import type { DatabaseSync } from "node:sqlite";
import type { Express, Request, Response } from "express";
import { applyReport, signatureValid, type Report, type WebhookKeys } from "../domain/orchestrate.ts";

const hits = new Map<string, { count: number; reset: number }>();

function problem(res: Response, status: number, type: string) {
  res.status(status).type("application/problem+json").json({ type, title: type, status });
}

export function registerWebhook(app: Express, db: DatabaseSync, keys: WebhookKeys): void {
  app.post("/api/v1/internal-transfers/webhooks/stage-completion", (req: Request, res: Response) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const keyId = req.header("x-portal-webhook-key-id") ?? "";
    const timestamp = req.header("x-portal-webhook-timestamp") ?? "";
    const signature = req.header("x-portal-webhook-signature") ?? "";
    if (req.header("authorization")?.startsWith("Bearer ") && !signature) {
      return problem(res, 401, "unauthenticated");
    }
    if (!signatureValid(keys, keyId, timestamp, raw, signature)) return problem(res, 401, "unauthenticated");
    const now = Date.now();
    const bucket = hits.get(keyId);
    if (!bucket || bucket.reset < now) hits.set(keyId, { count: 1, reset: now + 3_600_000 });
    else {
      bucket.count += 1;
      if (bucket.count > 600) return problem(res, 429, "rate-limited");
    }
    let report: Report;
    try {
      report = JSON.parse(raw.toString("utf8")) as Report;
    } catch {
      return problem(res, 422, "validation-failed");
    }
    const result = applyReport(db, report, keyId);
    if (result.status === 200) res.status(200).json(result.body);
    else problem(res, result.status, String(result.body.type));
  });
}
