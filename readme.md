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

## CORS

CORS is handled centrally by the core when enabled at instantiation.
If configured, the server:

- matches the incoming `Origin` against allowed origins
- sets `Access-Control-Allow-Origin` dynamically
- enables `Access-Control-Allow-Credentials` for session cookies
- responds to `OPTIONS` preflight requests with `204`

```ts
const api = new Api(ctx, {
  cors: {
    origins: ["http://localhost:5173", "https://app.example.com"],
  },
});
```

### Reconnects & Event IDs

SSE reconnects are handled automatically by the browser.
The core supports optional event IDs via `emit(event, data, id)`.

If an event ID is sent:

- the browser stores the last received ID
- reconnect requests include `Last-Event-ID`
- handlers can resume streams manually

```ts
server.sse("/events", async (ctx) => {
  const lastId = ctx.req.headers["last-event-id"];

  console.log(lastId);

  ctx.emit("tick", { value: 1 }, 1);
});
```

Generated stream:

```txt
id: 1
event: tick
data: {"value":1}
```

Reconnect replay strategy is fully user-controlled.
The core does not buffer, persist, or replay events automatically.

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
