import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp, openDatabase } from "./internal-transfer/api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "./internal-transfer/integration/hris/client.ts";

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

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const app = createApp(openDatabase(join(dataDir, "portal.sqlite")), hris, { "local-key": "local-secret" });

const port = Number(process.env.PORT ?? 3001);
app.listen(port, (error?: Error) => {
  if (error) {
    process.stderr.write(`employee-services failed to listen on ${port}: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`employee-services listening on http://localhost:${port}\n`);
});
