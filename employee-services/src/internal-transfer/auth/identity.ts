import type { Request } from "express";

// G2-F02: identity comes from the bearer subject only; roles are resolved server side
// from an injected source, never read from the token in the production path. The token
// `subject|ROLE` suffix is honoured only when `trustTokenRole` is explicitly set, which is
// a test seam and must never be turned on by the running server.

export type RoleSource = (employeeId: string) => readonly string[];

export type IdentityOptions = {
  roles?: RoleSource;
  trustTokenRole?: boolean;
};

export type Identity = {
  employeeId: string;
  roles: Set<string>;
};

export const APPROVER_ROLES = new Set(["LINE_MANAGER", "RECEIVING_MANAGER", "HR_BUSINESS_PARTNER"]);

export function resolveIdentity(req: Request, options: IdentityOptions = {}): Identity | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token === "invalid") return undefined;
  const [subject, tokenRole] = token.split("|");
  if (!subject) return undefined;
  const roles = new Set<string>(options.roles?.(subject) ?? []);
  if (options.trustTokenRole && tokenRole) roles.add(tokenRole);
  return { employeeId: subject, roles };
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
