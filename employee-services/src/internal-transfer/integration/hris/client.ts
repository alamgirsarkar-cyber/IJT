export type Department = { id: string; name: string };
export type Location = { id: string; name: string; city: string; country: string };
export type Position = {
  id: string;
  title: string;
  departmentId: string;
  locationId: string;
  grade: string;
  costCentre: string;
  open: boolean;
  internallyFillable: boolean;
  openFrom: string;
  receivingManagerRef: string | null;
};
export type ReferenceData = {
  departments: Department[];
  locations: Location[];
  positions: Position[];
};
export type Employment = {
  departmentId: string;
  departmentName: string;
  locationId: string;
  locationName: string;
  positionId: string;
  positionTitle: string;
  grade: string;
  costCentre: string;
  serviceInPositionMonths: number;
  positionStartDate: string;
  employmentStatus: string;
  probation: boolean;
  resignationActive: boolean;
  lineManagerRef: string | null;
};

export type HrisContract = {
  referenceData(): Promise<ReferenceData>;
  employment(employeeId: string): Promise<Employment>;
};

const TIMEOUT_MS = 2000;

export class HrisClient {
  private failures = 0;
  private calls = 0;
  private openUntil = 0;
  private readonly contract: HrisContract;

  constructor(contract: HrisContract) {
    this.contract = contract;
  }

  async referenceData(): Promise<ReferenceData> {
    return this.call(() => this.contract.referenceData());
  }

  async employment(employeeId: string): Promise<Employment> {
    return this.call(() => this.contract.employment(employeeId));
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    if (Date.now() < this.openUntil) {
      throw new Error("circuit-open");
    }
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      this.calls += 1;
      try {
        const result = await withTimeout(fn(), TIMEOUT_MS);
        this.note(true);
        return result;
      } catch (error) {
        last = error;
        this.note(false);
      }
    }
    throw last instanceof Error ? last : new Error("hris-unavailable");
  }

  private note(ok: boolean): void {
    if (!ok) this.failures += 1;
    if (this.calls >= 20 && this.failures / this.calls >= 0.5) {
      this.openUntil = Date.now() + 30_000;
    }
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function openFillablePositions(data: ReferenceData): Position[] {
  return data.positions.filter((position) => position.open && position.internallyFillable);
}
