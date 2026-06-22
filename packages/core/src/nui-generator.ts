import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NuiBridgeRegistry } from "@fdt/schemas";
import {
  renderCallbackLua,
  renderCallbackSchemas,
  renderFivemTs,
  renderMessageLua,
  renderMessageSchemas,
  renderMessagesTs,
  syncNuiBridgeSchemas,
} from "./nui-schema-sync.js";

function sanitizeResourceName(name: string): string {
  const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (!/^[a-z][a-z0-9_]*$/.test(cleaned)) {
    throw new Error("Resource name must start with a letter and use lowercase letters, numbers, or underscores");
  }
  return cleaned;
}

const CALLBACKS_START = "-- fdt:nui-callbacks-start";
const CALLBACKS_END = "-- fdt:nui-callbacks-end";
const MESSAGES_START = "-- fdt:nui-messages-start";
const MESSAGES_END = "-- fdt:nui-messages-end";
const SCHEMA_CALLBACKS_START = "// fdt:callback-types-start";
const SCHEMA_CALLBACKS_END = "// fdt:callback-types-end";
const SCHEMA_MESSAGES_START = "// fdt:message-types-start";
const SCHEMA_MESSAGES_END = "// fdt:message-types-end";

export interface NuiResourceFile {
  relativePath: string;
  content: string;
}

export interface GenerateNuiResourceOptions {
  resourceName: string;
  title?: string;
  mockMode?: boolean;
}

export function generateNuiResource(options: GenerateNuiResourceOptions): NuiResourceFile[] {
  const resourceName = sanitizeResourceName(options.resourceName);
  const title = options.title ?? resourceName.replace(/_/g, " ");
  const mockMode = options.mockMode ?? true;

  const registry: NuiBridgeRegistry = {
    schemaVersion: 1,
    resourceName,
    callbacks: ["close", "ping"],
    messages: ["setVisible"],
    definitions: {
      callbacks: {
        close: { payload: {} },
        ping: { payload: { hello: { type: "string", optional: true } } },
      },
      messages: {
        setVisible: { payload: { visible: { type: "boolean" } } },
      },
    },
  };

  const callbackBlock = registry.callbacks.map(renderCallbackLua).join("\n");
  const messageBlock = registry.messages.map(renderMessageLua).join("\n");

  return [
    {
      relativePath: "fxmanifest.lua",
      content: [
        "fx_version 'cerulean'",
        "game 'gta5'",
        "",
        "name 'FDT NUI Starter'",
        `description '${title.replace(/'/g, "\\'")}'`,
        "",
        "ui_page 'web/dist/index.html'",
        "",
        "files {",
        "    'web/dist/index.html',",
        "    'web/dist/**/*',",
        "    'shared/nui-bridge.json',",
        "}",
        "",
        "client_scripts {",
        "    'client/main.lua',",
        "}",
        "",
        "server_scripts {",
        "    'server/main.lua',",
        "}",
        "",
      ].join("\n"),
    },
    {
      relativePath: "client/main.lua",
      content: [
        "local uiOpen = false",
        "",
        "local function setUi(state)",
        "    uiOpen = state",
        "    SetNuiFocus(state, state)",
        "    SendNUIMessage({ action = 'setVisible', payload = { visible = state } })",
        "end",
        "",
        "RegisterCommand('open_" + resourceName + "', function()",
        "    setUi(not uiOpen)",
        "end, false)",
        "",
        CALLBACKS_START,
        callbackBlock.trimEnd(),
        CALLBACKS_END,
        "",
        MESSAGES_START,
        messageBlock.trimEnd(),
        MESSAGES_END,
        "",
      ].join("\n"),
    },
    {
      relativePath: "server/main.lua",
      content: [
        "RegisterNetEvent('" + resourceName + ":server:ping', function()",
        "    local src = source",
        "    TriggerClientEvent('" + resourceName + ":client:pong', src, { ok = true })",
        "end)",
        "",
      ].join("\n"),
    },
    {
      relativePath: "web/package.json",
      content: `${JSON.stringify(
        {
          name: `@meta/${resourceName}-nui`,
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@types/react": "^19.0.10",
            "@types/react-dom": "^19.0.4",
            "@vitejs/plugin-react": "^4.3.4",
            typescript: "^5.8.2",
            vite: "^6.2.2",
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      relativePath: "web/tsconfig.json",
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
          },
          include: ["src"],
        },
        null,
        2,
      )}\n`,
    },
    {
      relativePath: "web/vite.config.ts",
      content: [
        "import { defineConfig } from \"vite\";",
        "import react from \"@vitejs/plugin-react\";",
        "import path from \"node:path\";",
        "",
        "export default defineConfig({",
        "  plugins: [react()],",
        "  base: \"./\",",
        "  build: {",
        "    outDir: path.resolve(__dirname, \"dist\"),",
        "    emptyOutDir: true,",
        "  },",
        "});",
        "",
      ].join("\n"),
    },
    {
      relativePath: "web/index.html",
      content: [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        "    <title>" + title + "</title>",
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    },
    {
      relativePath: "shared/nui-bridge.json",
      content: `${JSON.stringify(registry, null, 2)}\n`,
    },
    {
      relativePath: "web/src/schemas.ts",
      content: [
        SCHEMA_CALLBACKS_START,
        renderCallbackSchemas(registry).trimEnd(),
        SCHEMA_CALLBACKS_END,
        "",
        SCHEMA_MESSAGES_START,
        renderMessageSchemas(registry).trimEnd(),
        SCHEMA_MESSAGES_END,
        "",
      ].join("\n"),
    },
    {
      relativePath: "web/src/messages.ts",
      content: renderMessagesTs(registry),
    },
    {
      relativePath: "web/src/fivem.ts",
      content: renderFivemTs(registry),
    },
    {
      relativePath: "web/src/mock.ts",
      content: [
        "export const mockMode = " + String(mockMode) + ";",
        "",
        "export const mockPayload = {",
        "  title: " + JSON.stringify(title) + ",",
        "  resource: " + JSON.stringify(resourceName) + ",",
        "};",
        "",
      ].join("\n"),
    },
    {
      relativePath: "web/src/App.tsx",
      content: [
        "import { useEffect, useState } from \"react\";",
        "import { ping, close } from \"./fivem\";",
        "import { mockMode, mockPayload } from \"./mock\";",
        "import { handleNuiMessage } from \"./messages\";",
        "",
        "export default function App() {",
        "  const [visible, setVisible] = useState(mockMode);",
        "  const [message, setMessage] = useState<string | null>(null);",
        "",
        "  useEffect(() => {",
        "    function onMessage(event: MessageEvent<{ action?: string; payload?: { visible?: boolean } }>) {",
        "      const action = event.data?.action;",
        "      if (!action) {",
        "        return;",
        "      }",
        "",
        "      handleNuiMessage(action as \"setVisible\", event.data.payload ?? {}, {",
        "        setVisible: (payload) => setVisible(Boolean(payload.visible)),",
        "      });",
        "    }",
        "",
        "    window.addEventListener(\"message\", onMessage);",
        "    return () => window.removeEventListener(\"message\", onMessage);",
        "  }, []);",
        "",
        "  async function ping() {",
        "    if (mockMode) {",
        "      setMessage(`Mock ping from ${mockPayload.resource}`);",
        "      return;",
        "    }",
        "",
        "    const response = await ping({ hello: \"world\" });",
        "    setMessage(response.ok ? `Pong from ${response.resource ?? \"server\"}` : \"Ping failed\");",
        "  }",
        "",
        "  if (!visible) {",
        "    return null;",
        "  }",
        "",
        "  return (",
        "    <main style={{ fontFamily: \"sans-serif\", padding: 24, color: \"#e2e8f0\", background: \"#0f172a\" }}>",
        "      <h1>" + title + "</h1>",
        "      <p>FDT NUI starter resource{mockMode ? \" (mock mode)\" : \"\"}.</p>",
        "      <button type=\"button\" onClick={() => void ping()}>Ping</button>",
        "      {message && <p>{message}</p>}",
        "      <button type=\"button\" onClick={() => void close()}>Close</button>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    },
    {
      relativePath: "web/src/main.tsx",
      content: [
        "import { StrictMode } from \"react\";",
        "import { createRoot } from \"react-dom/client\";",
        "import App from \"./App\";",
        "",
        "createRoot(document.getElementById(\"root\")!).render(",
        "  <StrictMode>",
        "    <App />",
        "  </StrictMode>,",
        ");",
        "",
      ].join("\n"),
    },
    {
      relativePath: "README.md",
      content: [
        "# " + title,
        "",
        "Generated by `fdt nui new`.",
        "",
        "## Development",
        "",
        "```bash",
        "cd web",
        "pnpm install",
        "pnpm dev",
        "```",
        "",
        "Open the Vite dev URL in a browser. Mock mode renders the UI without FiveM.",
        "",
        "## Build for FiveM",
        "",
        "```bash",
        "fdt nui build " + resourceName + " --workspace <path>",
        "```",
        "",
        "Or manually:",
        "",
        "```bash",
        "cd web && pnpm install && pnpm build",
        "```",
        "",
      ].join("\n"),
    },
  ];
}

export interface WriteNuiResourceOptions extends GenerateNuiResourceOptions {
  workspaceRoot: string;
  resourcesRoot: string;
  force?: boolean;
}

export async function writeNuiResource(options: WriteNuiResourceOptions): Promise<string> {
  const resourceName = sanitizeResourceName(options.resourceName);
  const resourceRoot = path.resolve(options.workspaceRoot, options.resourcesRoot, resourceName);

  if (options.force !== true) {
    const { access } = await import("node:fs/promises");
    try {
      await access(resourceRoot);
      throw new Error(`Resource folder already exists: ${resourceRoot}. Pass --force to overwrite generated files.`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw error;
      }
    }
  }

  const files = generateNuiResource(options);
  for (const file of files) {
    const targetPath = path.join(resourceRoot, file.relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content, "utf8");
  }

  await syncNuiBridgeSchemas(resourceRoot);

  return resourceRoot;
}
