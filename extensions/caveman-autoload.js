/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function cavemanAutoload(pi) {
  let pending = false;

  const restore = (_event, ctx) => {
    pending = !ctx.sessionManager.getBranch().some(
      (entry) => entry.type === "message" && entry.message.role === "user",
    );
  };
  pi.on("session_start", restore);
  pi.on("session_tree", restore);

  pi.on("input", (event, ctx) => {
    if (!pending || event.source === "extension") return { action: "continue" };
    const text = event.text.trimStart();
    if (text.startsWith("/") || (!text && !event.images?.length)) {
      return { action: "continue" };
    }
    if (!pi.getCommands().some((command) => command.source === "skill" && command.name === "skill:caveman")) {
      ctx.ui.notify("Caveman autoload: caveman skill not found; leaving prompts unchanged.", "warning");
      pending = false;
      return { action: "continue" };
    }
    return { action: "transform", text: `/skill:caveman ${event.text}`, images: event.images };
  });

  pi.on("message_end", (event) => {
    if (!pending || event.message.role !== "user") return;
    const content = event.message.content;
    const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content;
    // Wait for Pi's expanded skill to be committed, so failed preflight does not consume activation.
    if (blocks.some((block) => block.type === "text" && block.text.startsWith('<skill name="caveman" '))) {
      pending = false;
    }
  });
}
