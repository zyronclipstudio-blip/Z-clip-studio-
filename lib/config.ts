import path from "node:path";

export const DATA_DIR = process.env.ZCLIP_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const EXPORT_DIR = path.join(DATA_DIR, "exports");
export const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
export const GUARDIAN_FILE = path.join(DATA_DIR, "guardian-events.json");

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
export const GEMINI_PRICE_IN_PER_M = Number(process.env.GEMINI_PRICE_IN_PER_M) || 0;
export const GEMINI_PRICE_OUT_PER_M = Number(process.env.GEMINI_PRICE_OUT_PER_M) || 0;

export const RETENTION_HOURS = Number(process.env.RETENTION_HOURS) || 24;

export const LIMITS = {
  maxClips: 20,
  maxBatchBytes: 500 * 1024 * 1024,
  maxClipSeconds: 600,
  maxTotalSeconds: 1800,
  maxProcessPerHour: 10,
  maxProcessPerDay: 30,
  maxConcurrentRenders: 1,
  renderTimeoutMs: 10 * 60 * 1000,
  allowedExtensions: [".mp4", ".mov", ".m4v", ".webm", ".avi"],
} as const;

export const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
};

// Maximum finished length per destination. ZClip never pads to reach this.
export { PLATFORM_CAP_SECONDS } from "./caps";
