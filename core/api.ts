import { createServer, type Server } from "node:http";
import type { ServerResponse } from "node:http";
import type { Readable } from "node:stream";

import { HttpError } from "./http-error";
import type {
  ApiPortInterface,
  Context,
  SseContext,
  AppContext,
} from "./api-port-interface";
import { ValidationError } from "@papack/schema";

type Route<Ctx extends AppContext> =
  | {
      kind: "rpc";
      handler: (ctx: Context<Ctx>) => unknown | Promise<unknown>;
    }
  | {
      kind: "sse";
      handler: (ctx: SseContext<Ctx, any>) => void | Promise<void>;
    }
  | {
      kind: "blob";
      handler: (
        ctx: Context<Ctx>
      ) => Buffer | Readable | Promise<Buffer | Readable>;
    }
  | {
      kind: "upload";
      handler: (ctx: Context<Ctx>) => unknown | Promise<unknown>;
    };

// CORS
type CorsOptions = {
  origin: string;
};

export class Api<Ctx extends AppContext> implements ApiPortInterface<Ctx> {
  private server: Server;
  private routes = new Map<string, Route<Ctx>>();
  private ctx: Ctx;
  private cors?: CorsOptions; // CORS

  constructor(
    ctx: Ctx,
    options?: { maxRequestSize?: number; cors?: CorsOptions } // CORS
  ) {
    this.ctx = ctx;
    this.cors = options?.cors; // CORS

    this.server = createServer(async (req, res) => {
      try {
        if (this.cors) {
          res.setHeader("Access-Control-Allow-Origin", this.cors.origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
          res.setHeader("Access-Control-Allow-Headers", "content-type");
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        const path = req.url ?? "";
        const route = this.routes.get(path);

        //Not Found
        if (!route) {
          res.statusCode = 404;
          res.end(`"NOT_FOUND"`);
          return;
        }

        //Upload
        if (route.kind === "upload") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(`"METHOD_NOT_ALLOWED"`);
            return;
          }

          const ctx: Context<Ctx> = {
            req: req as any,
            res,
            ...this.ctx,
          };

          await route.handler(ctx);

          res.statusCode = 200;
          res.end(`"OK"`);
          return;
        }

        //Read Body
        const reqWithBody = req as typeof req & { body: string };
        let body = "";
        let size = 0;
        const maxSize = options?.maxRequestSize ?? 1024 * 1024; // default 1MB

        for await (const chunk of req) {
          size += chunk.length;
          if (size > maxSize) {
            res.statusCode = 413;
            res.end(`"PAYLOAD_TOO_LARGE"`);
            return;
          }
          body += chunk.toString("utf8");
        }

        reqWithBody.body = body;

        const ctx: Context<Ctx> = {
          req: reqWithBody,
          res,
          ...this.ctx,
        };

        //rpc
        if (route.kind === "rpc") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(`"METHOD_NOT_ALLOWED"`);
            return;
          }

          const result = await route.handler(ctx);

          if (result !== undefined) {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result));
          } else {
            res.end("");
          }
          return;
        }

        //sse
        if (route.kind === "sse") {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end(`"METHOD_NOT_ALLOWED"`);
            return;
          }

          res.setHeader("content-type", "text/event-stream");
          res.setHeader("cache-control", "no-cache");
          res.setHeader("connection", "keep-alive");

          const cleanups: Array<() => void | Promise<void>> = [];
          let closed = false;

          const runCleanup = async () => {
            if (closed) return;
            closed = true;
            for (const fn of cleanups) {
              try {
                await fn();
              } catch {}
            }
          };

          req.on("close", runCleanup);
          res.on("close", runCleanup);

          const sseCtx: SseContext<Ctx, any> = {
            ...ctx,
            emit(event, data) {
              if (!closed) {
                res.write(`event: ${String(event)}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              }
            },
            onCleanup(fn) {
              cleanups.push(fn);
            },
          };

          await route.handler(sseCtx);
          return;
        }

        //Blob
        if (route.kind === "blob") {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end(`"METHOD_NOT_ALLOWED"`);
            return;
          }

          const data = await route.handler(ctx);
          if (Buffer.isBuffer(data)) {
            res.end(data);
          } else {
            data.pipe(res);
          }
          return;
        }
      } catch (err) {
        this.handleError(err, res);
      }
    });
  }

  private handleError(err: unknown, res: ServerResponse) {
    if (err instanceof HttpError) {
      res.statusCode = err.statusCode;
      res.end(err.body);
      return;
    }
    if (err instanceof ValidationError) {
      res.statusCode = 400;
      res.end(`"${err.code}"`);
      return;
    }

    res.statusCode = 500;
    res.end(`"INTERNAL_ERROR"`);
  }

  rpc<O>(path: string, cb: (ctx: Context<Ctx>) => O | Promise<O>): void {
    this.routes.set(path, {
      kind: "rpc",
      handler: cb,
    });
  }

  sse<Events extends Record<string, unknown>>(
    path: string,
    cb: (ctx: SseContext<Ctx, Events>) => void | Promise<void>
  ): void {
    this.routes.set(path, {
      kind: "sse",
      handler: cb as any,
    });
  }

  blob(
    path: string,
    cb: (ctx: Context<Ctx>) => Buffer | Readable | Promise<Buffer | Readable>
  ): void {
    this.routes.set(path, {
      kind: "blob",
      handler: cb,
    });
  }

  upload(
    path: string,
    cb: (ctx: Context<Ctx>) => unknown | Promise<unknown>
  ): void {
    this.routes.set(path, {
      kind: "upload",
      handler: cb,
    });
  }

  listen(port: number, cb?: () => void): void {
    this.server.listen(port, cb);
  }
}
