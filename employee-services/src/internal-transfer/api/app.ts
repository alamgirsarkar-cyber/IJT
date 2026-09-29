import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  HrisClient,
  openFillablePositions,
  type Employment,
  type HrisContract,
  type ReferenceData,
} from "../integration/hris/client.ts";
import { allowListPayload } from "../outbox/relay.ts";
import { registerApproval } from "../approval/api/routes.ts";
import { registerWebhook } from "../fulfilment/api/webhook.ts";
import type { WebhookKeys } from "../fulfilment/domain/orchestrate.ts";
import { migrate, nextReference } from "../persistence/schema.ts";
import { br8, br9Advisory, evaluate, type EligibilityInput } from "../rules/evaluate.ts";

const TTL_MS = 900_000;
const STAGES = [
  ["MANAGER_RELEASE", 1, "LINE_MANAGER"],
  ["MANAGER_ACCEPT", 2, "RECEIVING_MANAGER"],
  ["HR_VALIDATION", 3, "HR_BUSINESS_PARTNER"],
  ["ORG_DATA_UPDATE", 4, "HR_OPERATIONS"],
  ["PAYROLL_UPDATE", 5, "PAYROLL"],
  ["IT_ACCESS", 6, "IT_SERVICE_DESK"],
  ["FACILITIES", 7, "FACILITIES"],
  ["EMPLOYEE_CONFIRMATION", 8, "PORTAL"],
] as const;

type Row = Record<string, unknown>;

function problem(res: Response, status: number, type: string, extra: Record<string, unknown> = {}) {
  res.status(status).type("application/problem+json").json({
    type,
    title: type,
    status,
    ...extra,
  });
}

const APPROVER_ROLES = new Set(["LINE_MANAGER", "RECEIVING_MANAGER", "HR_BUSINESS_PARTNER"]);

function caller(req: Request): { id: string; role?: string } | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token === "invalid") return undefined;
  const [id, role] = token.split("|");
  if (!id) return undefined;
  return { id, role: role || undefined };
}

function employeeCaller(req: Request, res: Response): string | undefined {
  const who = caller(req);
  if (!who) {
    problem(res, 401, "unauthenticated");
    return undefined;
  }
  if (who.role && APPROVER_ROLES.has(who.role)) {
    problem(res, 403, "forbidden");
    return undefined;
  }
  return who.id;
}

export function createApp(db: DatabaseSync, hris: HrisContract, webhookKeys: WebhookKeys = {}) {
  migrate(db);
  const client = new HrisClient(hris);
  const app = express();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, Idempotency-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use("/api/v1/internal-transfers/webhooks/stage-completion", express.raw({ type: () => true, limit: "32kb" }));
  registerWebhook(app, db, webhookKeys);
  app.use(express.json({ limit: "32kb" }));
  registerApproval(app, db);

  app.get("/api/v1/internal-transfers/reference-data", async (req, res, next) => {
    try {
      if (!employeeCaller(req, res)) return;
      const cached = readCache(db);
      try {
        const fresh = await client.referenceData();
        writeCache(db, fresh);
        return res.json(referenceBody(fresh, false, dbNow(db)));
      } catch {
        if (!cached) {
          res.set("Retry-After", "30");
          return problem(res, 503, "reference-data-unavailable");
        }
        const age = Date.parse(dbNow(db)) - Date.parse(cached.fetchedAt);
        return res.json(referenceBody(cached.data, age > TTL_MS, cached.fetchedAt));
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/internal-transfers", async (req, res, next) => {
    try {
      const employeeId = employeeCaller(req, res);
      if (!employeeId) return;
      if (req.body && typeof req.body === "object" && "reason" in req.body) {
        const reason = req.body.reason;
        if (typeof reason === "string" && reason.length > 2000) {
          return problem(res, 422, "validation-failed", { violations: [{ field: "reason" }] });
        }
      }
      let employment: Employment;
      try {
        employment = await client.employment(employeeId);
      } catch {
        res.set("Retry-After", "30");
        return problem(res, 503, "reference-data-unavailable");
      }
      const existing = activeRequest(db, employeeId);
      if (existing) {
        return problem(res, 409, "active-request-exists", {
          violations: [{ ruleId: "internal-transfer-request.BR3" }],
          existingRequestId: existing.id,
          existingReferenceNo: existing.reference_no,
        });
      }
      const id = randomUUID();
      const now = dbNow(db);
      const year = Number(now.slice(0, 4));
      const body = req.body ?? {};
      try {
        db.exec("BEGIN IMMEDIATE");
        const referenceNo = nextReference(db, year);
        db.prepare(
          `INSERT INTO transfer_request (
            id, reference_no, employee_id, status,
            current_department_id, current_location_id, current_position_id,
            current_grade, current_cost_centre, current_department_name,
            current_location_name, current_position_title, line_manager_ref,
            target_department_id, target_location_id, target_position_id,
            requested_effective_date, reason_ciphertext, version, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
        ).run(
          id,
          referenceNo,
          employeeId,
          "DRAFT",
          employment.departmentId,
          employment.locationId,
          employment.positionId,
          employment.grade,
          employment.costCentre,
          employment.departmentName,
          employment.locationName,
          employment.positionTitle,
          employment.lineManagerRef,
          body.targetDepartmentId ?? null,
          body.targetLocationId ?? null,
          body.targetPositionId ?? null,
          body.requestedEffectiveDate ?? null,
          body.reason ? Buffer.from(String(body.reason)) : null,
          now,
          now,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        const again = activeRequest(db, employeeId);
        if (again) {
          return problem(res, 409, "active-request-exists", {
            violations: [{ ruleId: "internal-transfer-request.BR3" }],
            existingRequestId: again.id,
            existingReferenceNo: again.reference_no,
          });
        }
        throw error;
      }
      const row = requestById(db, id);
      res.status(201).json(draftBody(row, employment));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/v1/internal-transfers/:requestId", (req, res) => {
    const employeeId = employeeCaller(req, res);
    if (!employeeId) return;
    const row = requestById(db, req.params.requestId);
    if (!row || row.employee_id !== employeeId) return problem(res, 404, "request-not-found");
    const match = req.header("if-match");
    if (!match) return problem(res, 400, "precondition-required");
    if (match.replaceAll('"', "") !== String(row.version)) {
      return problem(res, 409, "version-conflict", { currentVersion: row.version });
    }
    const body = req.body ?? {};
    const updated = db
      .prepare(
        `UPDATE transfer_request SET
          target_department_id = ?, target_location_id = ?, target_position_id = ?,
          requested_effective_date = ?, reason_ciphertext = ?,
          version = version + 1, updated_at = ?
         WHERE id = ? AND version = ? AND employee_id = ?`,
      )
      .run(
        body.targetDepartmentId ?? row.target_department_id,
        body.targetLocationId ?? row.target_location_id,
        body.targetPositionId ?? row.target_position_id,
        body.requestedEffectiveDate ?? row.requested_effective_date,
        body.reason ? Buffer.from(String(body.reason)) : row.reason_ciphertext,
        dbNow(db),
        row.id,
        row.version,
        employeeId,
      );
    if (updated.changes === 0) {
      const current = requestById(db, row.id as string);
      return problem(res, 409, "version-conflict", { currentVersion: current?.version });
    }
    res.json(draftBody(requestById(db, row.id as string)));
  });

  app.post("/api/v1/internal-transfers/:requestId/submit", async (req, res, next) => {
    try {
      const employeeId = employeeCaller(req, res);
      if (!employeeId) return;
      const key = req.header("idempotency-key");
      if (!key) return problem(res, 400, "idempotency-key-required");
      const stored = db
        .prepare("SELECT * FROM idempotency_record WHERE idempotency_key = ?")
        .get(key) as Row | undefined;
      if (stored && stored.request_id !== req.params.requestId) {
        return problem(res, 409, "idempotency-key-conflict");
      }
      if (stored && stored.request_id === req.params.requestId) {
        return res.status(stored.response_status as number).json(JSON.parse(String(stored.response_body)));
      }
      const row = requestById(db, req.params.requestId);
      if (!row || row.employee_id !== employeeId) return problem(res, 404, "request-not-found");
      if (row.status !== "DRAFT") return problem(res, 409, "invalid-state-transition", { currentStatus: row.status });
      let employment: Employment;
      let reference: ReferenceData;
      try {
        employment = await client.employment(employeeId);
        reference = await client.referenceData();
      } catch {
        res.set("Retry-After", "30");
        return problem(res, 503, "reference-data-unavailable");
      }
      const position = reference.positions.find((item) => item.id === row.target_position_id);
      const asOf = dbNow(db).slice(0, 10);
      const input: EligibilityInput = {
        employmentStatus: employment.employmentStatus,
        probation: employment.probation,
        positionStartDate: employment.positionStartDate,
        requestedEffectiveDate: String(row.requested_effective_date ?? ""),
        resignationActive: employment.resignationActive,
        currentDepartmentId: employment.departmentId,
        currentLocationId: employment.locationId,
        currentPositionId: employment.positionId,
        targetDepartmentId: String(row.target_department_id ?? ""),
        targetLocationId: String(row.target_location_id ?? ""),
        targetPositionId: String(row.target_position_id ?? ""),
        positionOpen: Boolean(position?.open),
        internallyFillable: Boolean(position?.internallyFillable),
        asOf,
      };
      const result = evaluate(input);
      if (result.violations.length > 0) {
        return problem(res, 422, "validation-failed", { violations: result.violations });
      }
      const releaseRef = employment.lineManagerRef;
      const acceptRef = position?.receivingManagerRef ?? null;
      if (!releaseRef || !acceptRef) {
        return problem(res, 422, "assignee-unresolved");
      }
      const now = dbNow(db);
      const correlationId = randomUUID();
      const applicable = new Set<string>(["MANAGER_RELEASE", "MANAGER_ACCEPT", "HR_VALIDATION", "ORG_DATA_UPDATE", "EMPLOYEE_CONFIRMATION"]);
      if (position && (position.costCentre !== employment.costCentre || position.grade !== employment.grade)) {
        applicable.add("PAYROLL_UPDATE");
      }
      if (row.target_department_id !== employment.departmentId) applicable.add("IT_ACCESS");
      if (row.target_location_id !== employment.locationId) applicable.add("FACILITIES");
      const payload = allowListPayload({
        requestId: row.id,
        referenceNo: row.reference_no,
        employeeId,
        currentDepartmentId: employment.departmentId,
        currentLocationId: employment.locationId,
        currentPositionId: employment.positionId,
        currentGrade: employment.grade,
        currentCostCentre: employment.costCentre,
        targetDepartmentId: row.target_department_id,
        targetLocationId: row.target_location_id,
        targetPositionId: row.target_position_id,
        targetGrade: position?.grade ?? null,
        targetCostCentre: position?.costCentre ?? null,
        requestedEffectiveDate: row.requested_effective_date,
        applicableStageCodes: [...applicable],
        submittedAt: now,
        correlationId,
        reason: "must-not-pass",
      });
      try {
        db.exec("BEGIN IMMEDIATE");
        db.prepare(
          `UPDATE transfer_request SET status = 'MANAGER_REVIEW',
            current_department_id = ?, current_location_id = ?, current_position_id = ?,
            current_grade = ?, current_cost_centre = ?, line_manager_ref = ?,
            target_grade = ?, target_cost_centre = ?, submitted_at = ?, updated_at = ?,
            version = version + 1
           WHERE id = ? AND status = 'DRAFT'`,
        ).run(
          employment.departmentId,
          employment.locationId,
          employment.positionId,
          employment.grade,
          employment.costCentre,
          releaseRef,
          position?.grade ?? null,
          position?.costCentre ?? null,
          now,
          now,
          row.id,
        );
        for (const [code, sequence, role] of STAGES) {
          const party =
            code === "MANAGER_RELEASE" ? releaseRef : code === "MANAGER_ACCEPT" ? acceptRef : null;
          db.prepare(
            `INSERT INTO transfer_request_stage (
              id, transfer_request_id, stage_code, sequence_no, status, assigned_role,
              assigned_party_ref, applicable, sla_due_at, started_at, completed_at
            ) VALUES (?,?,?,?,?,?,?,?,NULL,?,NULL)`,
          ).run(
            randomUUID(),
            row.id,
            code,
            sequence,
            code === "MANAGER_RELEASE" ? "IN_PROGRESS" : "NOT_STARTED",
            role,
            party,
            applicable.has(code) ? 1 : 0,
            code === "MANAGER_RELEASE" ? now : null,
          );
        }
        db.prepare(
          `INSERT INTO transfer_request_audit (
            id, transfer_request_id, actor_employee_id, actor_role, event_type,
            from_status, to_status, occurred_at, correlation_id, metadata
          ) VALUES (?,?,?,?, 'SUBMITTED', 'DRAFT', 'MANAGER_REVIEW', ?, ?, NULL)`,
        ).run(randomUUID(), row.id, employeeId, "EMPLOYEE", now, correlationId);
        if (process.env.OUTBOX_FAIL === "1") {
          throw new Error("outbox failed");
        }
        db.prepare(
          `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
           VALUES (?,?,?,?,?,0)`,
        ).run(randomUUID(), row.id, "employee.transfer.requested.v1", JSON.stringify({
          eventId: randomUUID(),
          eventType: "employee.transfer.requested.v1",
          eventVersion: 1,
          occurredAt: now,
          correlationId,
          requestId: row.id,
          payload,
        }), now);
        const responseBody = { requestId: row.id, status: "MANAGER_REVIEW", advisories: result.advisories };
        db.prepare(
          `INSERT INTO idempotency_record (idempotency_key, request_id, body_hash, response_status, response_body, created_at)
           VALUES (?,?,?,?,?,?)`,
        ).run(key, row.id, "submit", 200, JSON.stringify(responseBody), now);
        db.exec("COMMIT");
        res.json(responseBody);
      } catch (error) {
        db.exec("ROLLBACK");
        if (process.env.OUTBOX_FAIL === "1") {
          return problem(res, 500, "submit-failed");
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/internal-transfers/:requestId", (req, res) => {
    const employeeId = employeeCaller(req, res);
    if (!employeeId) return;
    const row = requestById(db, req.params.requestId);
    if (!row || row.employee_id !== employeeId) return problem(res, 404, "request-not-found");
    res.json(detailBody(db, row));
  });

  app.get("/api/v1/internal-transfers", (req, res) => {
    const employeeId = employeeCaller(req, res);
    if (!employeeId) return;
    const rows = db
      .prepare("SELECT * FROM transfer_request WHERE employee_id = ? ORDER BY created_at DESC")
      .all(employeeId) as Row[];
    res.json({
      items: rows.map((row) => {
        const stages = db
          .prepare("SELECT * FROM transfer_request_stage WHERE transfer_request_id = ? ORDER BY sequence_no")
          .all(row.id) as Row[];
        const failed = stages.some((stage) =>
          ["FAILED", "COMPENSATION_REQUESTED", "COMPENSATED", "COMPENSATION_FAILED"].includes(String(stage.status)),
        );
        const who = failed ? { partyName: null, role: "HR_OPERATIONS" } : pending(row, stages);
        return {
          requestId: row.id,
          referenceNo: row.reference_no,
          status: row.status,
          statusDisplay: display(db, row),
          requestedEffectiveDate: row.requested_effective_date,
          effectiveDateStatus: row.confirmed_effective_date ? "CONFIRMED" : row.requested_effective_date ? "REQUESTED" : null,
          pendingWith: who?.partyName ?? who?.role ?? null,
        };
      }),
    });
  });

  app.post("/api/v1/internal-transfers/:requestId/withdraw", (req, res) => {
    const employeeId = employeeCaller(req, res);
    if (!employeeId) return;
    const row = requestById(db, req.params.requestId);
    if (!row || row.employee_id !== employeeId) return problem(res, 404, "request-not-found");
    if (row.status === "WITHDRAWN") {
      return res.json({ requestId: row.id, status: "WITHDRAWN" });
    }
    const match = req.header("if-match");
    if (!match) return problem(res, 400, "precondition-required");
    if (match.replaceAll('"', "") !== String(row.version)) {
      if (row.status === "FULFILMENT") return problem(res, 409, "withdrawal-window-closed");
      return problem(res, 409, "version-conflict", { currentVersion: row.version });
    }
    if (row.status === "DRAFT") return problem(res, 409, "invalid-state-transition", { currentStatus: "DRAFT" });
    if (row.status === "FULFILMENT") return problem(res, 409, "withdrawal-window-closed");
    if (row.status !== "MANAGER_REVIEW" && row.status !== "HR_VALIDATION") {
      return problem(res, 409, "invalid-state-transition", { currentStatus: row.status });
    }
    const now = dbNow(db);
    const reason = typeof req.body?.withdrawalReason === "string" ? req.body.withdrawalReason : null;
    db.exec("BEGIN IMMEDIATE");
    const locked = requestById(db, row.id as string);
    if (!locked || locked.status === "FULFILMENT") {
      db.exec("ROLLBACK");
      return problem(res, 409, "withdrawal-window-closed");
    }
    db.prepare(
      `UPDATE transfer_request SET status = 'WITHDRAWN', withdrawal_reason_ciphertext = ?,
        version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
    ).run(reason ? Buffer.from(reason) : null, now, row.id, row.version);
    db.prepare(
      `UPDATE transfer_request_stage SET status = 'CANCELLED', completed_at = ?
       WHERE transfer_request_id = ? AND status NOT IN ('COMPLETED','CANCELLED')`,
    ).run(now, row.id);
    const correlationId = randomUUID();
    db.prepare(
      `INSERT INTO transfer_request_audit (
        id, transfer_request_id, actor_employee_id, actor_role, event_type,
        from_status, to_status, occurred_at, correlation_id, metadata
      ) VALUES (?,?,?,?, 'WITHDRAWN', ?, 'WITHDRAWN', ?, ?, NULL)`,
    ).run(randomUUID(), row.id, employeeId, "EMPLOYEE", row.status, now, correlationId);
    const payload = allowListPayload({
      requestId: row.id,
      referenceNo: row.reference_no,
      employeeId,
      withdrawnAt: now,
      correlationId,
      withdrawalReason: reason,
    });
    db.prepare(
      `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
       VALUES (?,?,?,?,?,0)`,
    ).run(
      randomUUID(),
      row.id,
      "employee.transfer.withdrawn.v1",
      JSON.stringify({ eventType: "employee.transfer.withdrawn.v1", payload }),
      now,
    );
    db.exec("COMMIT");
    res.json({ requestId: row.id, status: "WITHDRAWN" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "error";
    problem(res, 500, "internal-error", { detail: message });
  });

  return app;
}

function dbNow(db: DatabaseSync): string {
  const row = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now') AS now").get() as { now: string };
  return row.now;
}

function requestById(db: DatabaseSync, id: string): Row | undefined {
  return db.prepare("SELECT * FROM transfer_request WHERE id = ?").get(id) as Row | undefined;
}

function activeRequest(db: DatabaseSync, employeeId: string): Row | undefined {
  return db
    .prepare(
      `SELECT id, reference_no FROM transfer_request
       WHERE employee_id = ? AND status IN ('DRAFT','MANAGER_REVIEW','HR_VALIDATION','FULFILMENT')`,
    )
    .get(employeeId) as Row | undefined;
}

function draftBody(row: Row | undefined, employment?: Employment) {
  if (!row) return {};
  return {
    requestId: row.id,
    referenceNo: row.reference_no,
    status: row.status,
    version: row.version,
    currentAssignment: {
      departmentId: row.current_department_id,
      departmentName: employment?.departmentName ?? row.current_department_name,
      locationId: row.current_location_id,
      locationName: employment?.locationName ?? row.current_location_name,
      positionId: row.current_position_id,
      positionTitle: employment?.positionTitle ?? row.current_position_title,
      serviceInPositionMonths: employment?.serviceInPositionMonths ?? row.service_in_position_months,
    },
    target: {
      departmentId: row.target_department_id,
      locationId: row.target_location_id,
      positionId: row.target_position_id,
    },
    requestedEffectiveDate: row.requested_effective_date,
    createdAt: row.created_at,
  };
}

function display(db: DatabaseSync, row: Row): string {
  if (row.status !== "FULFILMENT") {
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      MANAGER_REVIEW: "With your manager",
      HR_VALIDATION: "With HR",
      COMPLETED: "Completed",
      REJECTED: "Declined",
      WITHDRAWN: "Withdrawn",
    };
    return labels[String(row.status)] ?? String(row.status);
  }
  const failed = db
    .prepare(
      `SELECT 1 AS hit FROM transfer_request_stage
       WHERE transfer_request_id = ? AND status IN ('FAILED','COMPENSATION_REQUESTED','COMPENSATED','COMPENSATION_FAILED')`,
    )
    .get(row.id) as { hit: number } | undefined;
  return failed ? "HR is completing this" : "Being actioned";
}

function detailBody(db: DatabaseSync, row: Row) {
  const stages = db
    .prepare(
      `SELECT * FROM transfer_request_stage WHERE transfer_request_id = ? ORDER BY sequence_no`,
    )
    .all(row.id) as Row[];
  const failed = stages.some((stage) =>
    ["FAILED", "COMPENSATION_REQUESTED", "COMPENSATED", "COMPENSATION_FAILED"].includes(String(stage.status)),
  );
  return {
    requestId: row.id,
    referenceNo: row.reference_no,
    status: row.status,
    statusDisplay: display(db, row),
    version: row.version,
    effectiveDateStatus: row.confirmed_effective_date ? "CONFIRMED" : "REQUESTED",
    requestedEffectiveDate: row.requested_effective_date,
    currentAssignment: {
      departmentName: row.current_department_name,
      locationName: row.current_location_name,
      positionTitle: row.current_position_title,
    },
    target: {
      departmentId: row.target_department_id,
      locationId: row.target_location_id,
      positionId: row.target_position_id,
    },
    reason: row.reason_ciphertext ? Buffer.from(row.reason_ciphertext as Uint8Array).toString() : null,
    advisories: advisoriesFor(row),
    pendingWith: failed
      ? { role: "HR_OPERATIONS", partyName: null }
      : pending(row, stages),
    stages: stages.map((stage) => ({
      stageCode: stage.stage_code,
      sequence: stage.sequence_no,
      status: stage.status,
      applicable: stage.applicable === 1,
      assignedRole: stage.assigned_role,
      assignedPartyName:
        stage.assigned_party_ref && stage.assigned_party_ref === row.line_manager_ref
          ? "Line manager"
          : null,
    })),
  };
}

function advisoriesFor(row: Row) {
  if (!row.requested_effective_date || row.status === "DRAFT") return [];
  const input: EligibilityInput = {
    employmentStatus: "ACTIVE",
    probation: false,
    positionStartDate: "2020-01-01",
    requestedEffectiveDate: String(row.requested_effective_date),
    resignationActive: false,
    currentDepartmentId: "current",
    currentLocationId: "current",
    currentPositionId: "current",
    targetDepartmentId: String(row.target_department_id ?? ""),
    targetLocationId: String(row.target_location_id ?? ""),
    targetPositionId: String(row.target_position_id ?? ""),
    positionOpen: true,
    internallyFillable: true,
    asOf: String(row.requested_effective_date),
  };
  const payroll = br8(input);
  return payroll ? [br9Advisory(), payroll] : [br9Advisory()];
}

function pending(row: Row, stages: Row[]) {
  const current = stages.find((stage) => stage.status === "IN_PROGRESS");
  if (!current) return null;
  const named = current.assigned_party_ref === row.line_manager_ref;
  return {
    role: current.assigned_role,
    partyName: named ? "Line manager" : null,
  };
}

function readCache(db: DatabaseSync): { data: ReferenceData; fetchedAt: string } | undefined {
  const row = db.prepare("SELECT payload, fetched_at FROM reference_data_cache WHERE cache_key = 'ref'").get() as
    | { payload: string; fetched_at: string }
    | undefined;
  if (!row) return undefined;
  return { data: JSON.parse(row.payload) as ReferenceData, fetchedAt: row.fetched_at };
}

function writeCache(db: DatabaseSync, data: ReferenceData): void {
  db.prepare(
    `INSERT INTO reference_data_cache (cache_key, payload, fetched_at) VALUES ('ref', ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
  ).run(JSON.stringify(data), new Date().toISOString());
}

function referenceBody(data: ReferenceData, stale: boolean, asOf: string) {
  const today = asOf.slice(0, 10);
  return {
    departments: data.departments,
    locations: data.locations,
    positions: openFillablePositions(data).map((position) => ({
      id: position.id,
      title: position.title,
      departmentId: position.departmentId,
      locationId: position.locationId,
      grade: position.grade,
      openFrom: position.openFrom,
    })),
    dateWindow: { earliest: today, latest: today },
    asOf,
    stale,
  };
}

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}
