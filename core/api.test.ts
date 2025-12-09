import { describe, it, expect, beforeAll } from "bun:test";
import { Api } from "./api";
import http from "node:http";

function request(
  options: http.RequestOptions,
  body?: Buffer | string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });

    req.on("error", reject);

    if (body) req.write(body);
    req.end();
  });
}

describe("Api Core", () => {
  let server: Api<{ value: string }>;
  let port: number;

  beforeAll(() => {
    server = new Api({ value: "from-context" });

    server.rpc("/rpc", (ctx) => {
      return {
        body: ctx.req.body,
        value: ctx.value,
      };
    });

    server.upload("/upload", async (ctx) => {
      // stream -> buffer (test only!)
      const chunks: Buffer[] = [];
      for await (const c of ctx.req) chunks.push(c as Buffer);
      const buf = Buffer.concat(chunks);

      expect(buf.toString()).toBe("UPLOAD_DATA");
    });

    port = 32123;
    server.listen(port);
  });

  it("passes context into rpc handler", async () => {
    const res = await request(
      {
        hostname: "localhost",
        port,
        path: "/rpc",
        method: "POST",
        headers: { "content-type": "application/json" },
      },
      JSON.stringify({ hello: "world" })
    );

    expect(res.status).toBe(200);

    const json = JSON.parse(res.body);
    expect(json.value).toBe("from-context");
    expect(json.body).toContain("hello");
  });

  it("streams upload without touching ctx.req.body", async () => {
    const res = await request(
      {
        hostname: "localhost",
        port,
        path: "/upload",
        method: "POST",
      },
      "UPLOAD_DATA"
    );

    expect(res.status).toBe(200);
    expect(res.body).toBe(`"OK"`);
  });

  it("returns NOT_FOUND for unknown route", async () => {
    const res = await request({
      hostname: "localhost",
      port,
      path: "/does-not-exist",
      method: "GET",
    });

    expect(res.status).toBe(404);
    expect(res.body).toBe(`"NOT_FOUND"`);
  });

  it("rejects wrong method", async () => {
    const res = await request({
      hostname: "localhost",
      port,
      path: "/rpc",
      method: "GET",
    });

    expect(res.status).toBe(405);
    expect(res.body).toBe(`"METHOD_NOT_ALLOWED"`);
  });
});
