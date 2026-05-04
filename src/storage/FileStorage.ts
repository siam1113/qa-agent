import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export class FileStorage {
  constructor(private readonly rootDir: string) {
    mkdirSync(rootDir, { recursive: true });
  }

  write(relativePath: string, content: string): string {
    const full = join(this.rootDir, relativePath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
    return full;
  }
}
