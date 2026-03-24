import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface TokenStore {
  getToken(): string | null;
  setToken(token: string | null): void;
}

export class MemoryTokenStore implements TokenStore {
  constructor(private token: string | null = null) {}

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }
}

export interface FileTokenStoreOptions {
  filePath: string;
  initialToken?: string | null;
}

interface TokenFilePayload {
  token: string | null;
  updatedAt: string;
}

export class FileTokenStore implements TokenStore {
  private readonly filePath: string;
  private token: string | null;

  constructor(options: FileTokenStoreOptions) {
    this.filePath = options.filePath;
    this.token = options.initialToken ?? null;
    this.loadFromDisk();
    if (!this.token && options.initialToken) {
      this.token = options.initialToken;
      this.persist();
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
    this.persist();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as TokenFilePayload;
      if (typeof parsed.token === "string" && parsed.token.trim()) {
        this.token = parsed.token;
      }
    } catch {
      // ignore broken cache files and continue with in-memory token
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          token: this.token,
          updatedAt: new Date().toISOString(),
        } satisfies TokenFilePayload,
        null,
        2
      ),
      "utf8"
    );
  }
}

export function createMemoryTokenStore(initialToken: string | null = null): MemoryTokenStore {
  return new MemoryTokenStore(initialToken);
}

export function createFileTokenStore(options: FileTokenStoreOptions): FileTokenStore {
  return new FileTokenStore(options);
}
