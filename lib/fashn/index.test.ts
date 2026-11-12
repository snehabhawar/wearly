import { describe, expect, it } from "vitest";
import { FashnError, removeBackground } from "./index";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake fetch that answers each call with the next response */
function fakeFetch(...responses: Response[]) {
  const calls: string[] = [];
  const f = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error("unexpected call");
    return next;
  }) as typeof fetch;
  return { f, calls };
}

const fast = { pollMs: 1, timeoutMs: 200 };

describe("FASHN client", () => {
  it("runs, polls until completed and downloads the output", async () => {
    const { f, calls } = fakeFetch(
      json({ id: "p1", error: null }),
      json({ status: "processing" }),
      json({ status: "completed", output: ["https://cdn.fashn.ai/out.png"] }),
      new Response(new Uint8Array([1, 2, 3])),
    );
    const out = await removeBackground("key", "data:image/jpeg;base64,AA", { ...fast, fetch: f });
    expect([...out]).toEqual([1, 2, 3]);
    expect(calls).toEqual([
      "https://api.fashn.ai/v1/run",
      "https://api.fashn.ai/v1/status/p1",
      "https://api.fashn.ai/v1/status/p1",
      "https://cdn.fashn.ai/out.png",
    ]);
  });

  it("throws when the run is rejected", async () => {
    const { f } = fakeFetch(json({ id: null, error: "bad key" }, 401));
    await expect(removeBackground("key", "x", { ...fast, fetch: f })).rejects.toThrow(FashnError);
  });

  it("throws when the prediction fails", async () => {
    const { f } = fakeFetch(json({ id: "p1" }), json({ status: "failed", error: { name: "ImageLoadError" } }));
    await expect(removeBackground("key", "x", { ...fast, fetch: f })).rejects.toThrow(/failed/);
  });

  it("times out", async () => {
    const pending = () => json({ status: "processing" });
    const f = (async (url: string | URL | Request) =>
      String(url).endsWith("/run") ? json({ id: "p1" }) : pending()) as typeof fetch;
    await expect(removeBackground("key", "x", { pollMs: 5, timeoutMs: 20, fetch: f })).rejects.toThrow(/timed out/);
  });
});
