import { ExecutionReport } from "../types";

export class ExecutionReporter {
  toJson(report: ExecutionReport): string {
    return JSON.stringify(report, null, 2);
  }
}
