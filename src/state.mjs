import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

const EMPTY_STATE = () => ({ version: 1, done: {} });

export class StateStore {
  constructor(directory) {
    this.directory = directory;
    this.path = join(directory, "state.json");
    this.state = EMPTY_STATE();
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8"));
      if (!parsed.done || typeof parsed.done !== "object" || Array.isArray(parsed.done)) {
        throw new Error("unsupported state schema");
      }
      if (parsed.version === undefined) this.state = { version: 1, done: parsed.done };
      else if (parsed.version === 1) this.state = parsed;
      else throw new Error("unsupported state schema");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return this.state;
  }

  has(key) {
    return this.state.done[key] === true;
  }

  async markDone(key) {
    this.state.done[key] = true;
    await this.save();
  }

  async save() {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const handle = await open(temporary, "w", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(this.state)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, this.path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
