// A thin Error subclass carrying an HTTP status code, so services can throw
// domain errors (e.g. "email already registered" -> 409) and controllers can
// map them to a response without a shared error-handling framework yet.
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
