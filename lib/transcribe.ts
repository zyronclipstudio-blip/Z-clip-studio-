import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { FFMPEG, GEMINI_API_KEY, GEMINI_MODEL_CHAIN, UPLOAD_DIR } from "./config";
import { isImageName } from "./image";
import { run } from "./media";
import type { EditPlan, MediaAsset } from "./types/schema";

export type CaptionWord = NonNullable<EditPlan["captions"]>["words"][number];

const Row = z.object({ start: z.coerce.number(), end: z.coerce.number(), text: z.string() });
const MAX_AUDIO_SEC = 180; // per clip, keeps the cost of captions small and predictable

// Keeps only the words that fall inside the pieces the edit actually uses.
export function wordsForPlan(plan: EditPlan, all: CaptionWord[]): CaptionWord[] {
  return all.filter((w) => plan.segments.some((s) => s.assetId === w.assetId && w.endSec > s.startSec && w.startSec < s.endSec));
}

// Turns the speech in the clips into short timed phrases (1 to 3 words) for word-by-word captions.
// Returns [] when there is no speech (music, singing, silence). Any failure means "no captions", never a failed edit.
export async function transcribeUsedAssets(plan: EditPlan, assets: MediaAsset[]): Promise<{ words: CaptionWord[]; tokensIn?: number; tokensOut?: number }> {
  if (!GEMINI_API_KEY) return { words: [] };
  const used = new Set(plan.segments.map((s) => s.assetId));
  const targets = assets.filter((a) => used.has(a.id) && a.hasAudio && !isImageName(a.originalName));
  if (!targets.length) return { words: [] };

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "zclip-asr-"));
  const uploaded: string[] = [];
  const words: CaptionWord[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    for (let i = 0; i < targets.length; i++) {
      const a = targets[i];
      const wav = path.join(tmp, `a-${i}.wav`);
      try {
        await run(FFMPEG, ["-y", "-hide_banner", "-i", path.join(UPLOAD_DIR, a.storedName), "-vn", "-ac", "1", "-ar", "16000", "-t", String(MAX_AUDIO_SEC), wav], 120_000);
        let file = await ai.files.upload({ file: wav, config: { mimeType: "audio/wav" } });
        if (file.name) uploaded.push(file.name);
        const started = Date.now();
        while (String(file.state) === "PROCESSING") {
          if (Date.now() - started > 90_000) throw new Error("slow");
          await new Promise((r) => setTimeout(r, 1500));
          file = await ai.files.get({ name: file.name as string });
        }
        if (!file.uri || !file.mimeType) continue;

        const prompt = `Transcribe the spoken words in this audio for on-screen captions.
Return ONLY a JSON array. Each item is {"start":seconds,"end":seconds,"text":"words"} with 1 to 3 words per item, in order, times measured from the start of the audio, accurate to about 0.1 second.
Write the words exactly as spoken in the original language (do not translate). If there is no speech, or it is only music or singing, return [].`;
        let res: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
        for (const model of GEMINI_MODEL_CHAIN) {
          try {
            res = await ai.models.generateContent({ model, contents: createUserContent([createPartFromUri(file.uri, file.mimeType), prompt]), config: { responseMimeType: "application/json", temperature: 0 } });
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (!res) continue;
        tokensIn += res.usageMetadata?.promptTokenCount ?? 0;
        tokensOut += res.usageMetadata?.candidatesTokenCount ?? 0;
        const rows = z.array(Row).parse(JSON.parse((res.text ?? "[]").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()));
        for (const r of rows) {
          const text = r.text.replace(/\s+/g, " ").trim().slice(0, 40);
          if (!text || !(r.end > r.start) || r.start < 0 || r.start > a.durationSec + 1) continue;
          words.push({ assetId: a.id, startSec: Math.round(r.start * 100) / 100, endSec: Math.round(Math.min(r.end, a.durationSec) * 100) / 100, text });
        }
      } catch {
        // This clip gets no captions; the others still can.
      }
    }
  } finally {
    await Promise.all(uploaded.map((n) => ai.files.delete({ name: n }).catch(() => undefined)));
    await fs.rm(tmp, { recursive: true, force: true });
  }
  return { words: words.slice(0, 1500), tokensIn, tokensOut };
}
