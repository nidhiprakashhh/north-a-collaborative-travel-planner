// Extends Express's Request type so authenticated routes can read
// `req.userId` without casting. Populated by the requireAuth middleware.
export {};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
