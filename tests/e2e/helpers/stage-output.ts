import os from "node:os";
import path from "node:path";

const stageOutputRoot = process.env.PLAYWRIGHT_OUTPUT_DIR
  || path.join(os.tmpdir(), "renvix-salla-stage-playwright");

export function stageArtifactPath(fileName: string) {
  return path.join(stageOutputRoot, "screenshots", path.basename(fileName));
}
