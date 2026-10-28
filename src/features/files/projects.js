// Project helpers: make a copy of the open design and switch to it.

/**
 * Save the open design, store a copy under `name` and make the copy the open design.
 * The canvas already shows the same content, so nothing is reloaded.
 * @returns {Promise<string>} the copy's project id
 */
export async function duplicateDesign(app, name) {
  if (!app.project) throw new Error("No design is open.");
  await app.save();
  const ed = app.editor;
  const id = app.store.newProjectId();
  await app.store.saveProject({
    id, name, width: ed.width, height: ed.height, thumb: ed.thumbnail(), doc: ed.toJSON(),
  });
  app.project = { id, name };
  app.shell.nameInput.value = name;
  // route() sees the open project already matches the hash and does nothing.
  location.hash = `#/d/${id}`;
  ed.history.reset();
  return id;
}
