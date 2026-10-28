# OddlyClever Design connector

Lets **Claude Desktop**, **Claude Code** or any other MCP app build designs in the OddlyClever Design tab open in your browser. Say "make 3 thumbnails for my next Short with Sparks" and watch Claude build them. It uses your normal Claude plan: no API key.

```
Claude ──stdio (MCP)──> connector/index.mjs ──WebSocket 127.0.0.1:47615──> your OddlyClever Design tab
```

The connector has no design tools of its own. When your tab connects, it sends the app's tool list and design guide, and the connector offers those tools to Claude. Each call runs in your tab, one at a time, and every change can be undone there.

## Setup (once)

You need Node.js 20 or newer. Run `npm install` in this `connector` folder if `node_modules` is missing.

1. **Get your lines.** In a terminal in the `design-tool` folder, run:

   ```
   node connector/index.mjs --setup
   ```

   It prints your **pairing code**, plus the exact lines for Claude with your real paths. The **Connect Claude** card in the app's AI panel shows the same lines.
2. **Add the connector to Claude.**
   - **Claude Desktop:** go to Settings › Developer › Edit Config. In `claude_desktop_config.json`, add the `oddlyclever-design` entry under `mcpServers` and keep any servers already there:

     ```json
     {
       "mcpServers": {
         "oddlyclever-design": {
           "command": "C:\\Program Files\\nodejs\\node.exe",
           "args": ["C:\\path\\to\\design-tool\\connector\\index.mjs"]
         }
       }
     }
     ```

   - **Claude Code:** `claude mcp add --scope user oddlyclever-design -- node "C:\path\to\design-tool\connector\index.mjs"`
   - **Other MCP apps** (Cursor, VS Code and so on): add a stdio server with the same command and arguments.
3. **Restart Claude.** In Claude Desktop, quit fully (from the tray as well) and open it again. In Claude Code, start a new session.
4. **Connect.** Open OddlyClever Design. In the AI panel's **Connect Claude** card, paste the pairing code and click **Connect**. If you don't have the code to hand, ask Claude to "connect to OddlyClever Design": its `how_to_connect` tool gives Claude the code to tell you. The browser remembers the code, and the tab reconnects by itself when Claude restarts.

While Claude works, a "Claude is designing…" pill appears above the canvas:
- **Stop** cancels the current step, and Claude is told to wait for you.
- **Undo Claude**, once Claude has finished, rolls back everything it just changed. Normal undo (Ctrl+Z) also works step by step.

## Options

| Flag | Environment variable | What it does |
|---|---|---|
| `--port <n>` | `OC_PORT` | Sets the WebSocket port. The default is 47615. If you change it, type the same port in the card under More options. |
| `--allow-origin <url>` | `OC_ALLOW_ORIGIN` (comma list) | Lets a hosted copy of the app connect, for example `https://you.github.io`. Repeat the flag for more than one. |
| `--export-dir <path>` | `OC_EXPORT_DIR` | Sets the folder that `save_picture` writes to. |
| `--no-export` | `OC_NO_EXPORT=1` | Turns `save_picture` off. |
| `--new-code` | | Makes a new pairing code. You'll need to paste it into the app again. |
| `--setup` | | Prints the setup lines and your code. |

`OC_PAIRING_CODE` sets a fixed code (useful for tests). `OC_CONFIG_DIR` moves the settings file.

## Security model

The connector listens on your computer, so it assumes that any website you visit might try to talk to it.

- It binds to **127.0.0.1 only**, so nothing on your network can reach it. It also checks the `Host` header, which blocks DNS-rebinding tricks.
- **Origin allowlist.** Browsers always send the page's origin. Only `http://localhost:5181`, `http://localhost:5182` (and the same on `127.0.0.1`), plus anything you add with `--allow-origin`, can connect. Any other site gets HTTP 403.
- **Pairing code.** A random 8-character code (about 39 bits) is made on first run. It's stored in your user settings folder (`%APPDATA%\OddlyClever Design\connector.json` on Windows), with user-only permissions where the system supports them. A tab must send the code first, within 5 seconds, or it's dropped. The check runs in constant time. After 5 wrong codes, the connector refuses every tab for a minute.
- **Untrusted messages.** Messages are capped at 24 MB and must be JSON text, and their shapes are checked. Tool names, schemas, descriptions and picture types are filtered. A call that takes more than 120 seconds is cancelled. The tab treats incoming calls the same way: only known tools run, inputs must be plain objects, and nothing is ever evaluated or inserted as HTML.
- **One tab at a time.** A newly paired tab replaces the old one.
- **No file system access, with one exception.** `save_picture` writes PNG or JPG files into one folder: `Downloads/OddlyClever` by default, or the folder you set with `--export-dir`, or none at all with `--no-export`. The folder is only created on the first save. File names are reduced to letters, digits, spaces, `-` and `_`, so `../` can't escape the folder. Existing files are never overwritten.
- **The connector doesn't edit your Claude config.** The app only shows you what to paste.
- **What Claude sees.** Claude sees what its tools send back, such as your design's details and snapshots, and that goes through your Claude app. Your design is never sent anywhere else.

## Troubleshooting

- **"Can't reach the connector"**: Claude isn't running the connector. Check that the config was saved, then restart Claude fully. In Claude Desktop, look under Settings › Developer for an error next to `oddlyclever-design`. In Claude Code, run `/mcp`.
- **"That pairing code doesn't match"**: run `node connector/index.mjs --setup` to see the current code. Case, spaces and dashes don't matter.
- **"Too many wrong codes"**: wait one minute.
- **Port already in use**: another copy of the connector is running. For example, Claude Desktop and Claude Code both started it. Only one copy can own a port. Remove it from one of them, or give one `--port 47616` and type that port in the card.
- **The tools don't appear in Claude**: after you click Connect, the connector tells Claude its tool list changed. Some apps only re-read the list on a new chat, so start one, or ask Claude to call `how_to_connect` with `wait_seconds`.
- **A hosted copy (https) can't connect**: start the connector with `--allow-origin https://your-site`. Chrome may ask to allow access to devices on your local network; allow it.
- **Nothing moves while Claude works**: browsers pause drawing in hidden tabs. Keep the app visible, for example side by side with Claude.

## Test without Claude

From the `design-tool` folder, with the dev server running on port 5181:

```
node tools/mcp_client_test.mjs          # with a fake tool list injected into the page
node tools/mcp_client_test.mjs --real   # with the app's real toolkit
```

The test spawns the connector as an MCP client would and pairs the app in headless Chrome through the real card. It then calls the tools, and it also checks the bad paths: a wrong Origin, a wrong code, a disconnect, the no-app state, Stop and cancel.
