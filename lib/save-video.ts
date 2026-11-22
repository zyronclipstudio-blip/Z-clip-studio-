// Saves a video without sending the person to a raw storage page.
// Fetches the file from ZClip's own download address and saves it from here, so the person stays in the app.
// A new name each time, so the phone never asks "Download file again?" for a copy it already has.
export const freshName = () => `zclip-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.mp4`;

export async function saveVideo(url: string, name = freshName()): Promise<"saved"> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    clickLink(href, name);
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return "saved";
  } catch {
    // Same-origin saves rarely fail; if one does, say so instead of opening a raw storage page.
    throw new Error("Could not save the video. Check your connection and try again.");
  }
}

function clickLink(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
