/**
 * Custom error class for API errors.
 * Extends the built-in Error class to include HTTP status, error details, and a success flag.
 */

class ApiError extends Error {
  status: number; // HTTP status code for the error
  data: any; // Data set to null by default for all the errors
  success: boolean; // Indicates if the request was successful (always false for errors)
  errors: any[]; // Array of additional error details

  /**
   * Creates a new ApiError instance.
   * @param status - HTTP status code
   * @param message - Error message (default: "something went wrong")
   * @param errors - Array of additional error details (default: empty array)
   * @param stack - Optional stack trace
   * @param data - Optional additional data for the error (default: null)
   */

  constructor(
    status: number,
    message: string = "Something went wrong",
    errors: any[] = [],
    stack: string = ""
  ) {
    super(message);
    this.status = status;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    // Set the stack trace
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
