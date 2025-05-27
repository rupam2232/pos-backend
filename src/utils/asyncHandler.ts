import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express route handler or middleware.
 * Ensures that any errors thrown in async code are passed to Express's error handler.
 * @param requestHandler - The async Express handler to wrap
 * @returns A standard Express middleware function
 */

export const asyncHandler = (requestHandler: RequestHandler) => {
  // Return a new function with the standard Express middleware signature
  return (req: Request, res: Response, next: NextFunction) => {
    // Execute the original handler and catch any errors, passing them to Express's error handler via next()
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
