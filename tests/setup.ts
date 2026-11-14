// Import this FIRST in every test file: it points ZClip's temporary folders at a throwaway directory.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zclip-test-"));
process.env.ZCLIP_DATA_DIR = TEST_DIR;
