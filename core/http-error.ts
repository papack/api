export abstract class HttpError extends Error {
  readonly statusCode: number;
  readonly body: string;

  protected constructor(statusCode: number, code: string) {
    super(code);
    this.statusCode = statusCode;
    this.body = `"${code}"`;
  }
}

export class NotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND");
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor() {
    super(405, "METHOD_NOT_ALLOWED");
  }
}

export class BadRequestError extends HttpError {
  constructor() {
    super(400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends HttpError {
  constructor() {
    super(403, "FORBIDDEN");
  }
}

export class InternalServerError extends HttpError {
  constructor() {
    super(500, "INTERNAL_ERROR");
  }
}

export class NotImplementedError extends HttpError {
  constructor() {
    super(501, "NOT_IMPLEMENTED");
  }
}
