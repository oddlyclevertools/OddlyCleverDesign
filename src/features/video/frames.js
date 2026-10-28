// Video frames from the files: one hidden <video> element per clip (the browser decodes on the
// graphics card). For export and scrubbing each frame is reached by seeking, so the result is
// exact and not limited to real time; the live preview plays the elements instead.
import { seekTo, urlOf } from "./media.js";

const ready = (v) => new Promise((resolve, reject) => {
  if (v.readyState >= 2) return resolve();
  const ok = () => { off(); resolve(); };
  const bad = () => { off(); reject(new Error("A video clip can't be played in this browser.")); };
  const off = () => { v.removeEventListener("loadeddata", ok); v.removeEventListener("error", bad); };
  v.addEventListener("loadeddata", ok);
  v.addEventListener("error", bad);
});

/** A pool of video elements, one per clip. */
export function createFramePool() {
  const els = new Map(); // clipId -> { v, mediaId, ready: Promise }

  async function ensure(clip) {
    let e = els.get(clip.id);
    if (e && e.mediaId !== clip.mediaId) { drop(clip.id); e = null; }
    if (!e) {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      e = { v, mediaId: clip.mediaId, ready: null };
      e.ready = urlOf(clip.mediaId).then((url) => { v.src = url; return ready(v); });
      els.set(clip.id, e);
    }
    await e.ready;
    return e.v;
  }

  function drop(id) {
    const e = els.get(id);
    if (!e) return;
    els.delete(id);
    try { e.v.pause(); e.v.removeAttribute("src"); e.v.load(); } catch { /* gone */ }
  }

  return {
    ensure,
    /** The element of a clip when it has a frame to show (sync, for drawing). */
    get(clipId) {
      const e = els.get(clipId);
      return e && e.v.readyState >= 2 ? e.v : null;
    },
    element: (clipId) => els.get(clipId)?.v || null,
    /** Seek every visible clip to its frame. `items` = [{ clip, src }]. */
    async prepare(items) {
      await Promise.all(items.map(async (it) => {
        const v = await ensure(it.clip);
        if (!v.paused) v.pause();
        await seekTo(v, it.src);
      }));
    },
    /** Let go of clips that are no longer on the timeline. */
    keepOnly(ids) {
      for (const id of [...els.keys()]) if (!ids.has(id)) drop(id);
    },
    dispose() { for (const id of [...els.keys()]) drop(id); },
  };
}
