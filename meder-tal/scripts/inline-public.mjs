// Replaces references to files in public/ with data URIs in the single-file build.
import { readFileSync, writeFileSync } from "node:fs";
const file = "dist-single/index.html";
const types = { jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", png: "image/png" };
let html = readFileSync(file, "utf8");
html = html.replace(/<link rel="preload"[^>]*>/g, "");
html = html.replace(/"\/((?:img\/)?[\w.-]+\.(jpg|webp|svg|png))"/g, (_, path, ext) => {
  const data = readFileSync(`public/${path}`).toString("base64");
  return `"data:${types[ext]};base64,${data}"`;
});
writeFileSync(file, html);
console.log(`${file}: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
