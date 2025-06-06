/**
 * Generic API response class for successful responses.
 * Provides a consistent structure for all API responses.
 * @template T - The type of the data being returned.
 */

class ApiResponse<T = any> {
  status: number; // HTTP status code for the response
  data: T; // The actual data payload of the response
  message: string; // A message describing the response
  success: boolean; // Indicates if the request was successful (always true for this class)

  /**
   * Creates a new ApiResponse instance.
   * @param status - HTTP status code
   * @param data - The data payload
   * @param message - Optional message (default: "Success")
   * @param success - Indicates if the request was successful (default: true)
   */

  constructor(status: number, data: T, message: string = "Success", success: boolean = true) {
    this.status = status;
    this.data = data;
    this.message = message;
    this.success = success;
  }
}

export { ApiResponse };
