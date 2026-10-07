import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

describe("Content-Security-Policy in staticwebapp.config.json", () => {
  const config = JSON.parse(read("public/staticwebapp.config.json"));
  const policy: string = config.globalHeaders["Content-Security-Policy"];
  const scriptSrc = policy.split(";").map((d) => d.trim().split(/\s+/)).find((d) => d[0] === "script-src") ?? [];

  it("allows each inline script in index.html by its hash", () => {
    // CI builds and deploys from a Linux checkout, so hash the LF form.
    const html = read("index.html").replace(/\r\n/g, "\n");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const body of scripts) {
      expect(scriptSrc).toContain(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
    }
  });

  it("allows no other inline or eval'd script", () => {
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});
