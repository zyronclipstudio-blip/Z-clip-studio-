import path from "node:path";

export const DATA_DIR = process.env.ZCLIP_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const EXPORT_DIR = path.join(DATA_DIR, "exports");
export const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
export const GUARDIAN_FILE = path.join(DATA_DIR, "guardian-events.json");

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash";
/** How long the AI step keeps retrying when Gemini is busy before the basic cut is used (seconds, env AI_PATIENCE_SEC). */
export const AI_PATIENCE_MS = Math.max(10, Number(process.env.AI_PATIENCE_SEC) || 120) * 1000;
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
  allowedExtensions: [".mp4", ".mov", ".m4v", ".webm", ".avi", ".jpg", ".jpeg", ".png", ".webp"],
} as const;

export const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Maximum finished length per destination. ZClip never pads to reach this.
export { PLATFORM_CAP_SECONDS } from "./caps";

// Models to try in order. Google retires models (a retired one answers 404), so there is always a newer last resort.
export const GEMINI_MODEL_CHAIN: string[] = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL, "gemini-3.8-flash"])];
export const isModelGone = (msg: string) => /404|NOT_FOUND|no longer available|not found/i.test(msg);
