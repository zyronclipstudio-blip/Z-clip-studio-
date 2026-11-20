// The person's own sound for an edit (a song, or the sound of a video). One per project,
// stored at a fixed name so deleting a project can always find and remove it.
export const SOUND_EXTS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".mp4", ".mov", ".webm"] as const;
export const SOUND_MAX_BYTES = 40 * 1024 * 1024;
export const SOUND_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export const soundKey = (userId: string, projectId: string, ext: string) => `${userId}/${projectId}/sound${ext}`;
export const allSoundKeys = (userId: string, projectId: string) => SOUND_EXTS.map((e) => soundKey(userId, projectId, e));
/** True only for a sound key that belongs to this person's project. */
export const isOwnSoundKey = (key: string, userId: string, projectId: string) =>
  !key.includes("..") && allSoundKeys(userId, projectId).includes(key);
