"use client";

import { useEffect } from "react";

const CORE_JERSEY_FILES = [
  "csk_back.webp",
  "mi_back.webp",
  "rcb_back.webp",
  "kkr_back.webp",
  "srh_back.webp",
  "dc_back.webp",
  "rr_back.webp",
  "gt_back.webp",
  "lsg_back.webp",
  "pbks_back.webp",
  "neutral_back.webp",
  "csk_miniature.webp",
  "mi_miniature.webp",
  "rcb_miniature.webp",
  "kkr_miniature.webp",
  "srh_miniature.webp",
  "dc_miniature.webp",
  "rr_miniature.webp",
  "gt_miniature.webp",
  "lsg_miniature.webp",
  "pbks_miniature.webp",
  "neutral_miniature.webp",
  "csk_back.png",
  "mi_back.png",
  "rcb_back.png",
  "kkr_back.png",
  "srh_back.png",
  "dc_back.png",
  "rr_back.png",
  "gt_back.png",
  "lsg_back.png",
  "pbks_back.png",
  "neutral_back.png",
];

let preloaded = false;

export function preloadAllJerseys() {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;

  const schedulePreload =
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 50);

  schedulePreload(() => {
    CORE_JERSEY_FILES.forEach((file) => {
      const img = new Image();
      img.src = `/jerseys/${file}`;
      if (typeof img.decode === "function") {
        img.decode().catch(() => {});
      }
    });
  });
}

export function JerseyPreloader() {
  useEffect(() => {
    preloadAllJerseys();
  }, []);

  return null;
}
