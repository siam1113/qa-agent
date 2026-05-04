import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export class FileStorage {
  constructor(
    private readonly rootDir: string,
    private readonly log?: (message: string) => void
  ) {
    mkdirSync(rootDir, { recursive: true });
    this.log?.(`[FileStorage] Root directory ready: ${rootDir}`);
  }

  write(relativePath: string, content: string): string {
    const full = join(this.rootDir, relativePath);
    this.log?.(`[FileStorage] Writing artifact: ${relativePath}`);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
    this.log?.(`[FileStorage] Wrote artifact: ${full}`);
    return full;
  }
}
