// Saves a video without sending the person to a raw storage page.
// First try: fetch it and save it from here (stays in the app). If the storage host blocks that, fall back to a hidden download link.
export async function saveVideo(url: string, name = "zclip-video.mp4"): Promise<"saved" | "started"> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    clickLink(href, name);
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return "saved";
  } catch {
    clickLink(url, name);
    return "started";
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
