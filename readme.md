# @papack/api

Minimal, opinionated HTTP API core for people who want full control over IO, parsing, streaming, and errors.
No magic. No Hooks. No implicit parsing.

Context is explicitly extensible. You can attach schemas, business logic, services, or infrastructure once, and they are available on ctx in every handler, you dont need hooks.

## Core Rules

- Transport is dumb. handlers decide everything.
- `ctx.req.body` is **always string** (if present).
- Body is read **exactly once** by the core.
- Parsing is **never** automatic.
- Streaming stays streaming.

## Context

- App context is injected once
- Available in **all** handlers
- No mutation rules enforced

```ts
const api = new Api({ value: "from-context" });
```

## Design Intent

- Zero hidden transformations
- Predictable transport semantics
- Streaming stays streaming
- Parsing is a user decision

## RPC

- `POST` only
- `req` **is** the API surface
- Return value will be strinifyed with `JSON.stringify`

```ts
server.rpc("/rpc", (ctx) => {
  return {
    raw: ctx.req.body,
    value: ctx.value,
  };
});
```

## SSE

- `GET` only
- Real `text/event-stream`
- Explicit `emit()`
- Guaranteed `onCleanup()` on disconnect

```ts
server.sse<{ tick: number }>("/events", (ctx) => {
  let i = 0;
  const id = setInterval(() => {
    ctx.emit("tick", i++);
  }, 1000);

  ctx.onCleanup(() => {
    clearInterval(id);
  });
});
```

## Blob (raw by design)

- Return `Buffer | Readable`
- No headers added
- No `Content-Type` guessing
- Streams use `Transfer-Encoding: chunked`
- Full backpressure control

```ts
server.blob("/file", () => {
  return fs.createReadStream("./big.bin");
});
```

## Upload

- `POST` only
- Request body is **binary**
- `ctx.req` is a `Readable`
- Core does **not** read or buffer
- No `ctx.req.body`
- No multipart assumptions

```ts
server.upload("/upload", async (ctx) => {
  for await (const chunk of ctx.req) {
    // stream processing
  }

  return "OK";
});
```

## Errors

- Explicit `HttpError`s only
- Status code + stable `"ERROR_CODE"`
- No messages
- No leaking

Examples:

```
"NOT_FOUND"
"METHOD_NOT_ALLOWED"
"BAD_REQUEST"
```
