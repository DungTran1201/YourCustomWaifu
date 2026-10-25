/**
 * Cross-platform launcher for Development Guest Preview mode
 */
process.env.YCW_ENABLE_GUEST_PREVIEW = "1";
const { spawn } = require("child_process");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(pnpm, ["dev"], { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code || 0));
