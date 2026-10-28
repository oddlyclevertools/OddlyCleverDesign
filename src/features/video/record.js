// Voice-over recording: asks for the microphone (the browser shows its own permission prompt),
// shows a live level meter, records with MediaRecorder, and puts the take on the voice track.
import { el, icon, modal, toast } from "../../ui/kit.js";
import * as api from "./api.js";
import { importMedia } from "./media.js";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function micError(e) {
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") return "The microphone is blocked. Allow it in the browser's address bar, then try again.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "No microphone was found. Plug one in and try again.";
  if (e?.name === "NotReadableError") return "Another app is using the microphone. Close it and try again.";
  return `The microphone couldn't start: ${e?.message || e}`;
}

/**
 * Open the recorder. The take goes on the voice track at `at` seconds.
 * @param {object} app
 * @param {{ at?: number }} opts
 */
export function openRecorder(app, { at = 0 } = {}) {
  let stream = null, ac = null, rec = null, raf = 0, chunks = [], t0 = 0, take = null;
  const meterFill = el("i");
  const meter = el("div.vd-meter", { role: "meter", "aria-label": "Microphone level", "aria-valuemin": "0", "aria-valuemax": "100" }, meterFill);
  const clock = el("span.vd-rec-clock", {}, "0:00");
  const status = el("p.vd-note", {}, "Your browser will ask to use your microphone. Nothing leaves this computer.");
  const allowBtn = el("button.btn.primary", { type: "button" }, icon("Mic", 16), "Allow the microphone");
  const recBtn = el("button.btn.primary.vd-rec-btn", { type: "button", hidden: true }, icon("Circle", 16), "Start recording");
  const player = el("audio.vd-rec-play", { controls: true, hidden: true });
  const addBtn = el("button.btn.primary", { type: "button", hidden: true }, icon("Plus", 16), "Add to the voice track");
  const againBtn = el("button.btn", { type: "button", hidden: true }, icon("RotateCcw", 16), "Record again");

  const content = el("div.vd-rec", {}, status, el("div.vd-rec-row", {}, meter, clock), player,
    el("div.row.end.vd-rec-actions", {}, allowBtn, recBtn, againBtn, addBtn));
  const m = modal("Record a voice-over", content);
  const closeModal = m.close;

  function cleanup() {
    cancelAnimationFrame(raf);
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* stopped */ } }
    stream?.getTracks().forEach((t) => t.stop());
    ac?.close().catch(() => {});
    if (player.src) URL.revokeObjectURL(player.src);
    stream = null;
    ac = null;
  }
  // Closing the dialog (X, Esc, outside click) lets go of the microphone.
  const watcher = new MutationObserver(() => { if (!content.isConnected) { watcher.disconnect(); cleanup(); } });
  requestAnimationFrame(() => watcher.observe(document.body, { childList: true, subtree: true }));

  function meterLoop(analyser) {
    const data = new Float32Array(analyser.fftSize);
    const loop = () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-8) + 60) / 60)); // -60..0 dB
      meterFill.style.width = `${Math.round(level * 100)}%`;
      meter.setAttribute("aria-valuenow", String(Math.round(level * 100)));
      meter.classList.toggle("hot", level > 0.92);
      if (rec?.state === "recording") {
        const s = Math.floor((performance.now() - t0) / 1000);
        clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  allowBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) { toast("This browser can't record sound.", { error: true }); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      status.textContent = micError(e);
      return;
    }
    ac = new AudioContext();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(stream).connect(analyser);
    meterLoop(analyser);
    allowBtn.hidden = true;
    recBtn.hidden = false;
    status.textContent = "Speak to check the level: aim for the green part of the bar. Then press Start recording.";
  });

  recBtn.addEventListener("click", () => {
    if (rec?.state === "recording") { rec.stop(); return; }
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    try {
      rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 160000 } : undefined);
    } catch (e) {
      status.textContent = `Recording couldn't start: ${e.message}`;
      return;
    }
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      take = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
      if (player.src) URL.revokeObjectURL(player.src);
      player.src = URL.createObjectURL(take);
      player.hidden = false;
      recBtn.hidden = true;
      againBtn.hidden = false;
      addBtn.hidden = false;
      recBtn.replaceChildren(icon("Circle", 16), "Start recording");
      recBtn.classList.remove("on");
      status.textContent = "Listen back. Add it to the voice track, or record again.";
    };
    rec.start(250);
    t0 = performance.now();
    recBtn.replaceChildren(icon("Square", 16), "Stop");
    recBtn.classList.add("on");
    status.textContent = "Recording…";
  });

  againBtn.addEventListener("click", () => {
    take = null;
    player.hidden = true;
    againBtn.hidden = true;
    addBtn.hidden = true;
    recBtn.hidden = false;
    clock.textContent = "0:00";
    status.textContent = "Press Start recording when you're ready.";
  });

  addBtn.addEventListener("click", async () => {
    if (!take) return;
    addBtn.disabled = true;
    status.textContent = "Saving the take…";
    try {
      const n = new Date();
      const name = `Voice-over ${n.getHours()}:${String(n.getMinutes()).padStart(2, "0")}`;
      const ext = take.type.includes("mp4") ? "m4a" : take.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([take], `${name}.${ext}`, { type: take.type.replace("video/", "audio/") });
      const media = await importMedia(file, { name });
      await api.addClip(app, { mediaId: media.id, track: "voice", start: at });
      toast("The voice-over is on the timeline.");
      closeModal();
      cleanup();
    } catch (e) {
      addBtn.disabled = false;
      status.textContent = e.message;
    }
  });

  return { close: () => { closeModal(); cleanup(); } };
}
