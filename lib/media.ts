import { spawn } from "node:child_process";
import { FFPROBE } from "./config";
import { IMAGE_SECONDS, isImageName } from "./image";

export function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Arguments are passed as an array (no shell), so file names can never inject commands.
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr = (stderr + d.toString()).slice(-400_000)));
    child.on("error", (err) => {
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      reject(new Error(code === "ENOENT" ? `${cmd} was not found. Install FFmpeg and make sure it is on your PATH.` : err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} failed (code ${code}): ${stderr.slice(-600)}`));
    });
  });
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
}

interface FfStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
  disposition?: { attached_pic?: number };
}

// Reads the real streams from the file, so a renamed non-video file is rejected.
export async function probeMedia(file: string): Promise<ProbeResult> {
  const isPhoto = isImageName(file);
  const { stdout } = await run(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    30_000,
  );
  const info = JSON.parse(stdout) as { streams?: FfStream[]; format?: { duration?: string } };
  const streams = info.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  if (!v || !v.width || !v.height) throw new Error("No video stream found");

  let width = v.width;
  let height = v.height;
  const rot = Number(v.tags?.rotate ?? v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0);
  if (Math.abs(rot) % 180 === 90) [width, height] = [height, width];

  const [num, den] = (v.r_frame_rate ?? "30/1").split("/").map(Number);
  const fps = den ? num / den : num || 30;
  if (isPhoto) {
    // A photo is a still: it can be shown for up to IMAGE_SECONDS and has no sound.
    return { durationSec: IMAGE_SECONDS, width, height, fps: 30, hasAudio: false, codec: "image" };
  }
  const durationSec = Number(info.format?.duration ?? v.duration ?? 0);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error("Could not read clip duration");

  return {
    durationSec,
    width,
    height,
    fps: Math.round(fps * 100) / 100,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    codec: v.codec_name ?? "unknown",
  };
}
