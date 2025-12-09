import type { IncomingMessage, ServerResponse } from "node:http";
import type { Readable } from "node:stream";

export interface RequestContext {
  req: IncomingMessage & {
    body: string;
  };
  res: ServerResponse;
}

export type AppContext = Record<string, unknown>;

export type Context<Ctx extends AppContext> = RequestContext & Ctx;

export type SseContext<
  Ctx extends AppContext,
  Events extends Record<string, unknown>
> = Context<Ctx> & {
  emit<E extends keyof Events>(event: E, data: Events[E]): void;
  onCleanup(fn: () => void | Promise<void>): void;
};

export interface ApiPortInterface<Ctx extends AppContext> {
  rpc<O>(path: string, cb: (ctx: Context<Ctx>) => O | Promise<O>): void;

  sse<Events extends Record<string, unknown>>(
    path: string,
    cb: (ctx: SseContext<Ctx, Events>) => void | Promise<void>
  ): void;

  blob(
    path: string,
    cb: (ctx: Context<Ctx>) => Buffer | Readable | Promise<Buffer | Readable>
  ): void;

  upload(
    path: string,
    cb: (
      ctx: Context<Ctx> & {
        req: IncomingMessage;
      }
    ) => unknown | Promise<unknown>
  ): void;

  listen(port: number, cb?: () => void): void;
}
