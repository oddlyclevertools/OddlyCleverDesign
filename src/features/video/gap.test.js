// v0.5 video gaps: caption cues, speed / reverse / freeze / ripple, reframe, transitions, stretch.
import { describe, expect, it } from "vitest";
import * as Q from "./cues.js";
import * as M from "./model.js";
import { transitionFx } from "./transitions.js";
import { stretch } from "./stretch.js";
import { quietCut } from "./whisper.js";

const words = (list) => list.map(([text, start, end]) => ({ text, start, end }));

describe("caption cues", () => {
  const w = words([["Welcome", 0, 0.4], ["back", 0.4, 0.7], ["to", 0.7, 0.8], ["the", 0.8, 0.9], ["channel.", 0.9, 1.4], ["Today", 2.5, 2.8], ["we", 2.8, 3]]);
  it("groups words into short captions, breaking at sentences and pauses", () => {
    const cues = Q.groupWords(w, { maxWords: 3 });
    expect(cues.map((q) => q.text)).toEqual(["Welcome back to", "the channel.", "Today we"]);
    expect(cues[0].words).toHaveLength(3);
    expect(cues[0].end).toBe(0.8); // closes the tiny gap to the next caption
  });
  it("edits text keeping word times when the count matches", () => {
    const cues = Q.groupWords(w, { maxWords: 3 });
    const next = Q.editCue(cues, 0, { text: "Welcome BACK too" });
    expect(next[0].words[1]).toEqual({ text: "BACK", start: 0.4, end: 0.7 });
    expect(cues[0].text).toBe("Welcome back to"); // not changed in place
    const more = Q.editCue(cues, 0, { text: "Hello there my friends" });
    expect(more[0].words).toHaveLength(4);
    expect(more[0].words[0].start).toBe(0);
  });
  it("retimes words with the cue", () => {
    const next = Q.editCue(Q.groupWords(w, { maxWords: 3 }), 0, { start: 1, end: 2.6 });
    expect(next.find((q) => q.text.startsWith("Welcome")).words[1].start).toBeCloseTo(1.8, 2);
  });
  it("splits, merges, removes, shifts and adds", () => {
    const cues = Q.groupWords(w, { maxWords: 3 });
    const s = Q.splitCue(cues, 0, 0.5);
    expect(s.map((q) => q.text).slice(0, 2)).toEqual(["Welcome", "back to"]);
    const m = Q.mergeCues(s, 0);
    expect(m[0].text).toBe("Welcome back to");
    expect(Q.removeCue(cues, 1)).toHaveLength(2);
    expect(Q.shiftCue(cues, 2, 1)[2].words[0].start).toBe(3.5);
    expect(Q.addCue(cues, 5, "Hi")).toHaveLength(4);
    expect(() => Q.splitCue([{ start: 0, end: 1, text: "One" }], 0)).toThrow();
  });
});

describe("speed, reverse, freeze and ripple", () => {
  const media = { id: "m", name: "A", kind: "video", duration: 10 };
  it("allows 0.1x to 10x", () => {
    const { tl, clip } = M.addClip(M.emptyTimeline(), media, { start: 0 });
    expect(M.findClip(M.updateClip(tl, clip.id, { speed: 10 }), clip.id).speed).toBe(10);
    expect(M.findClip(M.updateClip(tl, clip.id, { speed: 0.05 }), clip.id).speed).toBe(0.1);
  });
  it("plays backwards", () => {
    let { tl, clip } = M.addClip(M.emptyTimeline(), media, { start: 1, in: 2, out: 6 });
    tl = M.updateClip(tl, clip.id, { reverse: true });
    const c = M.findClip(tl, clip.id);
    expect(M.sourceTime(c, 1)).toBe(6);
    expect(M.sourceTime(c, 4)).toBe(3);
    const sp = M.splitClip(tl, c.id, 2);
    expect([sp.left.in, sp.left.out, sp.right.in, sp.right.out]).toEqual([5, 6, 2, 5]);
    const tr = M.findClip(M.trimClip(tl, c.id, { endAt: 3 }, 10), c.id);
    expect([tr.in, tr.out, M.clipEnd(tr)]).toEqual([4, 6, 3]);
  });
  it("freezes a frame and moves the rest along", () => {
    let { tl, clip } = M.addClip(M.emptyTimeline(), media, { start: 0, out: 4 });
    tl = M.addClip(tl, media, { start: 4, out: 2 }).tl;
    const r = M.freezeFrame(tl, clip.id, 1, 2);
    const vids = M.clipsOn(r.tl, "video");
    expect(vids.map((c) => [c.start, M.clipLength(c)])).toEqual([[0, 1], [1, 2], [3, 3], [6, 2]]);
    expect(M.sourceTime(r.freeze, 2.5)).toBe(1);
    const t2 = M.findClip(M.trimClip(r.tl, r.freeze.id, { endAt: 4 }), r.freeze.id);
    expect(t2.hold).toBe(3);
  });
  it("ripple delete closes the gap on that track only", () => {
    let { tl, clip } = M.addClip(M.emptyTimeline(), media, { start: 0, out: 2 });
    tl = M.addClip(tl, media, { start: 2, out: 3 }).tl;
    tl = M.addClip(tl, { id: "a", kind: "audio", duration: 5 }, { track: "music", start: 3 }).tl;
    const r = M.rippleDelete(tl, clip.id);
    expect(M.clipsOn(r, "video")[0].start).toBe(0);
    expect(M.clipsOn(r, "music")[0].start).toBe(3);
  });
});

describe("fit and reframe", () => {
  it("keeps the fit and eases between key points", () => {
    const n = M.normalize({ clips: [{ mediaId: "x", track: "video", kind: "video", in: 0, out: 4, fit: "free",
      reframe: { x: 0, y: 0, zoom: 1, keys: [{ t: 0, x: -1, y: 0, zoom: 1 }, { t: 2, x: 1, y: 0, zoom: 2 }] } }] });
    const c = n.clips[0];
    expect(c.fit).toBe("free");
    expect(M.reframeAt(c, 1)).toEqual({ x: 0, y: 0, zoom: 1.5 });
    expect(M.reframeAt(c, 3).x).toBe(1);
    expect(M.normalize({ clips: [{ mediaId: "x", track: "video", kind: "video", fit: "weird" }] }).clips[0].fit).toBe("cover");
  });
});

describe("transitions", () => {
  it("knows the new ones", () => {
    for (const t of ["slide", "wipe", "zoom", "whip", "spin"]) expect(M.cleanTransition({ type: t }).type).toBe(t);
  });
  it("moves pictures the right way", () => {
    expect(transitionFx("slide", 0, "in", 100, 50).dx).toBe(100);
    expect(transitionFx("slide", 1, "in", 100, 50).dx).toBe(0);
    expect(transitionFx("slide", 1, "out", 100, 50).dx).toBe(-100);
    expect(transitionFx("wipe", 0.5, "in", 100, 50).clip).toEqual([0, 0, 50, 50]);
    expect(transitionFx("whip", 0.5, "in", 100, 50).blur).toBeGreaterThan(3);
    expect(transitionFx("spin", 1, "in", 100, 50).scale).toBeCloseTo(1);
    expect(transitionFx("crossfade", 0.25, "in", 100, 50).alpha).toBe(0.25);
  });
});

describe("sound", () => {
  it("stretches without changing the pitch", () => {
    const rate = 48000, f = 440;
    const x = new Float32Array(rate);
    for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * f * i) / rate);
    const [y] = stretch([x], 2);
    expect(y.length).toBe(rate / 2);
    // Count zero crossings in the middle: the same frequency means the same count per second.
    let z = 0;
    for (let i = 2000; i < 22000; i++) if ((y[i - 1] < 0) !== (y[i] < 0)) z++;
    expect(z / (20000 / rate)).toBeGreaterThan(2 * f * 0.9);
    expect(z / (20000 / rate)).toBeLessThan(2 * f * 1.1);
  });
  it("cuts long speech in a quiet moment", () => {
    const rate = 16000;
    const s = new Float32Array(rate * 40).fill(0.5);
    s.fill(0, rate * 27, rate * 27 + 1600);
    const cut = quietCut(s, 0, rate);
    expect(cut).toBeGreaterThanOrEqual(rate * 27);
    expect(cut).toBeLessThanOrEqual(rate * 27 + 1600);
  });
});
