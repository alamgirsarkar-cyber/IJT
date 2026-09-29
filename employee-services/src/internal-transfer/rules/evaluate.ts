export type RuleViolation = { ruleId: string; field?: string };
export type Advisory = { code: string; ruleId: string };

export type EligibilityInput = {
  employmentStatus: string;
  probation: boolean;
  positionStartDate: string;
  requestedEffectiveDate: string;
  resignationActive: boolean;
  currentDepartmentId: string;
  currentLocationId: string;
  currentPositionId: string;
  targetDepartmentId: string;
  targetLocationId: string;
  targetPositionId: string;
  positionOpen: boolean;
  internallyFillable: boolean;
  asOf: string;
};

export type Evaluation = { violations: RuleViolation[]; advisories: Advisory[] };

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function serviceMonths(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
  const anniversary = Math.min(sd, lastDay);
  if (ed < anniversary) months -= 1;
  return months;
}

export function br1(input: EligibilityInput): RuleViolation | undefined {
  if (input.employmentStatus !== "ACTIVE" || input.probation) {
    return { ruleId: "internal-transfer-request.BR1" };
  }
  return undefined;
}

export function br2(input: EligibilityInput): RuleViolation | undefined {
  if (serviceMonths(input.positionStartDate, input.requestedEffectiveDate) < 12) {
    return { ruleId: "internal-transfer-request.BR2" };
  }
  return undefined;
}

export function br4(input: EligibilityInput): RuleViolation | undefined {
  if (input.resignationActive) return { ruleId: "internal-transfer-request.BR4" };
  return undefined;
}

export function br5(input: EligibilityInput): RuleViolation | undefined {
  if (
    input.targetDepartmentId === input.currentDepartmentId &&
    input.targetLocationId === input.currentLocationId &&
    input.targetPositionId === input.currentPositionId
  ) {
    return { ruleId: "internal-transfer-request.BR5" };
  }
  return undefined;
}

export function br6(input: EligibilityInput): RuleViolation | undefined {
  if (!input.positionOpen || !input.internallyFillable) {
    return { ruleId: "internal-transfer-request.BR6" };
  }
  return undefined;
}

export function br7(input: EligibilityInput): RuleViolation | undefined {
  const earliest = addDays(input.asOf, 14);
  const latest = addDays(input.asOf, 180);
  if (input.requestedEffectiveDate < earliest || input.requestedEffectiveDate > latest) {
    return { ruleId: "internal-transfer-request.BR7", field: "requestedEffectiveDate" };
  }
  return undefined;
}

export function br8(input: EligibilityInput): Advisory | undefined {
  const day = Number(input.requestedEffectiveDate.slice(8, 10));
  if (day !== 1) {
    return { code: "PAYROLL_CYCLE_MISALIGNED", ruleId: "internal-transfer-request.BR8" };
  }
  return undefined;
}

export function br9Advisory(): Advisory {
  return { code: "HR_CHECKS_FURTHER", ruleId: "internal-transfer-request.BR9" };
}

export function evaluate(input: EligibilityInput): Evaluation {
  const violations = [br1, br2, br4, br5, br6, br7]
    .map((rule) => rule(input))
    .filter((item): item is RuleViolation => item !== undefined);
  const advisories: Advisory[] = [br9Advisory()];
  const payroll = br8(input);
  if (payroll) advisories.push(payroll);
  return { violations, advisories };
}
