// Photos are welcome next to videos. A photo has no length of its own, so ZClip treats it as a
// still that can be shown for up to IMAGE_SECONDS. Safe to import from the browser or the server.
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"] as const;
export const IMAGE_SECONDS = 4;
export const isImageName = (name: string) => IMAGE_EXTS.some((e) => name.toLowerCase().endsWith(e));
