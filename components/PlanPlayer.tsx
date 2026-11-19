"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { EditPlan } from "@/lib/types/schema";

export interface PlanPlayerHandle {
  /** Jump to a point on the edit's own timeline (seconds from the start of the edit). */
  seek: (sec: number) => void;
}

interface Props {
  plan: EditPlan;
  /** Short-lived links to the person's clips, keyed by clip id. */
  urls: Record<string, string>;
  onTime?: (sec: number) => void;
}

const ASPECT: Record<EditPlan["aspectRatio"], string> = { "9:16": "9 / 16", "1:1": "1 / 1", "16:9": "16 / 9" };

const startsOf = (plan: EditPlan) => {
  const out: number[] = [];
  let t = 0;
  for (const s of plan.segments) {
    out.push(t);
    t += s.endSec - s.startSec;
  }
  return out;
};

/**
 * Plays the edit live, straight from the clips, so changes show instantly and nothing is
 * rendered until the person taps export. One video element walks through the pieces in order.
 */
export const PlanPlayer = forwardRef<PlanPlayerHandle, Props>(function PlanPlayer({ plan, urls, onTime }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const planRef = useRef(plan);
  const urlsRef = useRef(urls);
  const playingRef = useRef(false);
  const loadingRef = useRef(false);
  const lastReport = useRef(-1);
  planRef.current = plan;
  urlsRef.current = urls;

  const report = useCallback(
    (sec: number) => {
      if (Math.abs(sec - lastReport.current) < 0.05) return;
      lastReport.current = sec;
      onTime?.(sec);
    },
    [onTime],
  );

  const setPlay = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlaying(value);
  }, []);

  // Point the video at piece `i`, `offset` seconds into it, and optionally start playing.
  const load = useCallback(
    (i: number, offset: number, autoplay: boolean) => {
      const v = video.current;
      const p = planRef.current;
      const seg = p.segments[i];
      if (!v || !seg) return;
      idxRef.current = i;
      setIdx(i);
      v.volume = Math.min(1, Math.max(0, seg.volume ?? 1));
      v.muted = (seg.volume ?? 1) === 0;
      const url = urlsRef.current[seg.assetId];
      if (!url) return;
      const target = Math.min(seg.endSec - 0.05, seg.startSec + Math.max(0, offset));
      const go = () => {
        loadingRef.current = false;
        v.currentTime = target;
        if (autoplay) void v.play().catch(() => setPlay(false));
      };
      if (v.dataset.assetId !== seg.assetId || v.dataset.url !== url) {
        v.dataset.assetId = seg.assetId;
        v.dataset.url = url;
        loadingRef.current = true;
        v.addEventListener("loadedmetadata", go, { once: true });
        v.src = url;
        v.load();
      } else {
        go();
      }
      report(startsOf(p)[i] + Math.max(0, offset));
    },
    [report, setPlay],
  );

  // Follow the video while it plays: move to the next piece when this one ends.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      const p = planRef.current;
      const seg = p.segments[idxRef.current];
      if (v && seg && !loadingRef.current) {
        const t = v.currentTime;
        if (t >= seg.endSec - 0.04 || v.ended) {
          const next = idxRef.current + 1;
          if (next < p.segments.length) load(next, 0, true);
          else {
            v.pause();
            setPlay(false);
            load(0, 0, false);
          }
        } else {
          report(startsOf(p)[idxRef.current] + Math.max(0, t - seg.startSec));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, load, report, setPlay]);

  // The edit or the links changed: show the current piece again (paused) so the preview matches.
  useEffect(() => {
    video.current?.pause();
    setPlay(false);
    const i = Math.min(idxRef.current, plan.segments.length - 1);
    load(Math.max(0, i), 0, false);
  }, [plan, urls, load, setPlay]);

  useImperativeHandle(
    ref,
    () => ({
      seek(sec: number) {
        const p = planRef.current;
        const starts = startsOf(p);
        let i = 0;
        for (let k = 0; k < starts.length; k++) if (sec >= starts[k]) i = k;
        load(i, Math.max(0, sec - starts[i]), playingRef.current);
      },
    }),
    [load],
  );

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (playingRef.current) {
      v.pause();
      setPlay(false);
    } else {
      setPlay(true);
      void v.play().catch(() => setPlay(false));
    }
  };

  const seg = plan.segments[idx];
  const hasPreview = Boolean(seg && urls[seg.assetId]);
  const next = plan.segments[idx + 1];
  const nextUrl = next && next.assetId !== seg?.assetId ? urls[next.assetId] : undefined;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: plan.aspectRatio === "16:9" ? "100%" : plan.aspectRatio === "1:1" ? "420px" : "300px" }}>
      <div className="relative overflow-hidden rounded-[16px] border border-[#242a35] bg-black" style={{ aspectRatio: ASPECT[plan.aspectRatio] }}>
        <video ref={video} playsInline preload="auto" className="h-full w-full object-cover" onClick={toggle} />
        {nextUrl && <video src={nextUrl} preload="auto" muted playsInline className="hidden" />}
        {!hasPreview && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] leading-5 text-[#8d97a8]">
            Preview isn&apos;t available for this clip. You can still edit and render.
          </div>
        )}
        {hasPreview && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/55 text-[#ecd083] backdrop-blur"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
      </div>
    </div>
  );
});
