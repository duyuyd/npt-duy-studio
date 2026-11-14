import { spawn } from "node:child_process";
const args = [];
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--host") args.push("--hostname");
  else if (arg !== "--strictPort") args.push(arg);
}
const child = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "dev", ...args], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 1); });
