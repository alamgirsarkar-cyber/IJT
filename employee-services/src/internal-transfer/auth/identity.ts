import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// G2-F02 (re-review 2026-10-13): production identity is a gateway HMAC assertion, not a
// bare Bearer subject. Roles come from the signed claims. Unsigned Bearer is honoured only
// when `allowUnsignedIdentity` is set (tests). `trustTokenRole` remains a test seam and
// must never be turned on by the running server.

export type RoleSource = (employeeId: string) => readonly string[];

export type LocalDevIdentity = {
  secret: string;
  roles: Record<string, readonly string[]>;
};

export type IdentityOptions = {
  roles?: RoleSource;
  trustTokenRole?: boolean;
  allowUnsignedIdentity?: boolean;
  gatewayHmacSecret?: string;
};

export type Identity = {
  employeeId: string;
  roles: Set<string>;
};

export const APPROVER_ROLES = new Set(["LINE_MANAGER", "RECEIVING_MANAGER", "HR_BUSINESS_PARTNER"]);

const WINDOW_MS = 300_000;

export function signGatewayAssertion(
  secret: string,
  subject: string,
  roles: readonly string[],
  timestamp: string,
): string {
  const material = [subject, [...roles].sort().join(","), timestamp].join("\n");
  return `sha256=${createHmac("sha256", secret).update(material).digest("hex")}`;
}

export function gatewayAssertionValid(
  secret: string,
  subject: string,
  rolesHeader: string,
  timestamp: string,
  signature: string,
  now = Date.now(),
): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > WINDOW_MS) return false;
  const roles = rolesHeader.length === 0 ? [] : rolesHeader.split(",");
  const expected = Buffer.from(signGatewayAssertion(secret, subject, roles, timestamp));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function bearerSubject(req: Request): { subject: string; tokenRole?: string } | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token === "invalid") return undefined;
  const [subject, tokenRole] = token.split("|");
  if (!subject) return undefined;
  return { subject, tokenRole };
}

export function resolveIdentity(req: Request, options: IdentityOptions = {}): Identity | undefined {
  const bearer = bearerSubject(req);

  if (options.gatewayHmacSecret) {
    const subject = req.header("x-gateway-subject")?.trim();
    const rolesHeader = req.header("x-gateway-roles") ?? "";
    const timestamp = req.header("x-gateway-timestamp") ?? "";
    const signature = req.header("x-gateway-signature") ?? "";
    if (!subject) return undefined;
    if (!gatewayAssertionValid(options.gatewayHmacSecret, subject, rolesHeader, timestamp, signature)) {
      return undefined;
    }
    if (bearer && bearer.subject !== subject) return undefined;
    const roles = new Set<string>(rolesHeader.length === 0 ? [] : rolesHeader.split(",").filter(Boolean));
    return { employeeId: subject, roles };
  }

  if (!options.allowUnsignedIdentity) return undefined;
  if (!bearer) return undefined;
  const roles = new Set<string>(options.roles?.(bearer.subject) ?? []);
  if (options.trustTokenRole && bearer.tokenRole) roles.add(bearer.tokenRole);
  return { employeeId: bearer.subject, roles };
}

export function localDevGatewayMiddleware(config: LocalDevIdentity) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.header("x-gateway-signature")) {
      next();
      return;
    }
    const bearer = bearerSubject(req);
    if (!bearer) {
      next();
      return;
    }
    const roles = [...(config.roles[bearer.subject] ?? [])].sort();
    const timestamp = new Date().toISOString();
    req.headers["x-gateway-subject"] = bearer.subject;
    req.headers["x-gateway-roles"] = roles.join(",");
    req.headers["x-gateway-timestamp"] = timestamp;
    req.headers["x-gateway-signature"] = signGatewayAssertion(config.secret, bearer.subject, roles, timestamp);
    next();
  };
}

export function isApprover(identity: Identity): boolean {
  for (const role of identity.roles) {
    if (APPROVER_ROLES.has(role)) return true;
  }
  return false;
}

export function isHr(identity: Identity): boolean {
  return identity.roles.has("HR_BUSINESS_PARTNER");
}
