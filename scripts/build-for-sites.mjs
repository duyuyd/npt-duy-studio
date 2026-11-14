import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
for (const item of await readdir(".open-next")) {
  if (item === "assets") continue;
  await cp(`.open-next/${item}`, `dist/server/${item}`, { recursive: true, dereference: true });
}
await cp(".open-next/worker.js", "dist/server/index.js");
await cp(".open-next/assets", "dist/client", { recursive: true, dereference: true });

// Sites loads each output as an ES module without Wrangler's final bundling step.
// Resolve the server bundle's Node built-ins through explicit ESM imports.
const handler = "dist/server/server-functions/default/handler.mjs";
const source = await readFile(handler, "utf8");
const builtins = ["path", "crypto", "util", "fs", "stream", "stream/web", "url", "async_hooks", "http", "https", "vm", "buffer", "zlib"];
const required = [...source.matchAll(/(?<![\w$.])require\(["']([^"']+)["']\)/g)].map((match) => match[1]);
const unsupported = [...new Set(required)].filter((name) => !builtins.includes(name.replace(/^node:/, "")) && name !== "@builder.io/partytown/integration");
if (unsupported.length) throw new Error(`Unsupported Node requires in server bundle: ${unsupported.join(", ")}`);
const imports = builtins.map((name, index) => `import * as __siteNode${index} from "node:${name}";`).join("\n");
const mappings = builtins.flatMap((name, index) => [`${JSON.stringify(name)}:__siteNode${index}`, `${JSON.stringify(`node:${name}`)}:__siteNode${index}`]).join(",");
const shim = `${imports}\nconst __siteBuiltins={${mappings}};\nconst require=(name)=>{if(Object.hasOwn(__siteBuiltins,name))return __siteBuiltins[name];throw new Error("Unsupported require: "+name)};\n`;
await writeFile(handler, shim + source);
