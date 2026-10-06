export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function serviceUnavailable(message: string): HttpError {
  return new HttpError(503, "SERVICE_UNAVAILABLE", message);
}

export function validationError(message: string): HttpError {
  return new HttpError(400, "VALIDATION_ERROR", message);
}

export function notFound(message = "The requested resource was not found."): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}
