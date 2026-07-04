import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
rmSync(join(here, "..", ".next", "dev"), { recursive: true, force: true });
