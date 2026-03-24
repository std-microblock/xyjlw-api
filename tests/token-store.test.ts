import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  createFileTokenStore,
  createMemoryTokenStore,
} from "../src/token-store.js";

describe("token-store", () => {
  it("memory store 可读写 token", () => {
    const store = createMemoryTokenStore("old.token");
    expect(store.getToken()).toBe("old.token");
    store.setToken("new.token");
    expect(store.getToken()).toBe("new.token");
  });

  it("file store 会把 token 持久化到磁盘", () => {
    const dir = mkdtempSync(join(tmpdir(), "xyjlw-token-"));
    const filePath = join(dir, "token.json");

    try {
      const store = createFileTokenStore({
        filePath,
        initialToken: "first.token",
      });
      expect(store.getToken()).toBe("first.token");

      store.setToken("second.token");
      const raw = readFileSync(filePath, "utf8");
      expect(raw).toContain("second.token");

      const reloaded = createFileTokenStore({ filePath });
      expect(reloaded.getToken()).toBe("second.token");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
