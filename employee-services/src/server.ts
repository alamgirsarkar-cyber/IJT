import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp, openDatabase } from "./internal-transfer/api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "./internal-transfer/integration/hris/client.ts";
import type { LocalDevIdentity } from "./internal-transfer/auth/identity.ts";

const reference: ReferenceData = {
  departments: [
    { id: "d1", name: "Finance" },
    { id: "d2", name: "Operations" },
  ],
  locations: [
    { id: "l1", name: "Head office", city: "Kolkata", country: "IN" },
    { id: "l2", name: "Plant", city: "Pune", country: "IN" },
  ],
  positions: [
    {
      id: "p-open",
      title: "Analyst",
      departmentId: "d2",
      locationId: "l2",
      grade: "G2",
      costCentre: "CC2",
      open: true,
      internallyFillable: true,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
    {
      id: "p-senior-analyst",
      title: "Senior Analyst",
      departmentId: "d2",
      locationId: "l2",
      grade: "G3",
      costCentre: "CC2",
      open: true,
      internallyFillable: true,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
    {
      id: "p-accountant",
      title: "Accountant",
      departmentId: "d1",
      locationId: "l1",
      grade: "G2",
      costCentre: "CC1",
      open: true,
      internallyFillable: true,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
    {
      id: "p-stores",
      title: "Stores Coordinator",
      departmentId: "d2",
      locationId: "l1",
      grade: "G2",
      costCentre: "CC3",
      open: true,
      internallyFillable: true,
      openFrom: "2026-02-01",
      receivingManagerRef: "mgr-recv",
    },
  ],
};

const employment: Employment = {
  departmentId: "d1",
  departmentName: "Finance",
  locationId: "l1",
  locationName: "Head office",
  positionId: "p-cur",
  positionTitle: "Clerk",
  grade: "G1",
  costCentre: "CC1",
  serviceInPositionMonths: 18,
  positionStartDate: "2024-01-01",
  employmentStatus: "ACTIVE",
  probation: false,
  resignationActive: false,
  lineManagerRef: "mgr-line",
};

const hris: HrisContract = {
  async referenceData() {
    return reference;
  },
  async employment() {
    return employment;
  },
};

// G2-F02 (re-review 2026-10-13): production requires GATEWAY_HMAC_SECRET and never
// accepts a bare Bearer as identity. The id→role map below is a local-dev stub only.
const localDev = process.env.LOCAL_DEV_IDENTITY === "1";
const gatewayHmacSecret = process.env.GATEWAY_HMAC_SECRET;
if (!gatewayHmacSecret && !localDev) {
  process.stderr.write(
    "employee-services: set GATEWAY_HMAC_SECRET (production) or LOCAL_DEV_IDENTITY=1 (demo stub). Refusing to listen.\n",
  );
  process.exit(1);
}

const secret = gatewayHmacSecret ?? "local-dev-gateway-secret";
const stubRoles: LocalDevIdentity["roles"] = {
  "hr-1": ["HR_BUSINESS_PARTNER"],
  "mgr-line": ["LINE_MANAGER"],
  "mgr-recv": ["RECEIVING_MANAGER"],
};
if (localDev) {
  process.stderr.write(
    "employee-services: LOCAL_DEV_IDENTITY=1 — demo identity stub; not the production path. Bare Bearer is signed in-process.\n",
  );
}

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const app = createApp(openDatabase(join(dataDir, "portal.sqlite")), hris, { "local-key": "local-secret" }, {
  gatewayHmacSecret: secret,
  localDevIdentity: localDev ? { secret, roles: stubRoles } : undefined,
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, (error?: Error) => {
  if (error) {
    process.stderr.write(`employee-services failed to listen on ${port}: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`employee-services listening on http://localhost:${port}\n`);
});
