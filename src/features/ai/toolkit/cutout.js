// remove_background for the AI: cut the subject out of a picture on this PC's GPU, either in
// place or as its own layer above the photo (so text can go between them).
import { removeBackground } from "../../cutout/index.js";
import { brief, editorOf, findObjects, json, kindOf, step } from "./context.js";
import { ToolInputError } from "./validate.js";

export async function removeBackgroundTool(app, inp, { signal }) {
  const ed = editorOf(app);
  const [img] = findObjects(ed, [inp.id]);
  if (!["image", "frame"].includes(kindOf(img))) throw new ToolInputError(`"${inp.id}" is a ${kindOf(img)}. remove_background works on pictures.`);
  return step(app, inp.layer ? "Subject on its own layer" : "Remove background", async () => {
    let r;
    try { r = await removeBackground(app, img, { layer: Boolean(inp.layer) }); } catch (e) { throw new ToolInputError(e.message); }
    const subject = ed.objects().find((o) => o.id === r.id);
    return {
      text: json({
        cut_out: brief(subject), ...(inp.layer ? { photo: brief(img) } : {}),
        ran_on: r.onGPU ? `GPU (${r.gpuName || "WebGPU"})` : "CPU", seconds: +(r.ms / 1000).toFixed(1),
        ...(inp.layer ? { tip: `To put text behind the subject, arrange the text between ${img.id} (photo) and ${subject.id} (cut-out): arrange send_backward on the text until it sits under ${subject.id}.` } : {}),
      }),
    };
  }, { signal });
}
