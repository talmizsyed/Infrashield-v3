/**
 * Represents a successful API response.
 */
export type ApiSuccessResponse<T> = {
  status: 'success';
  data: T;
};

/**
 * Represents an error returned by the API.
 */
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Represents a failed API response.
 */
export type ApiErrorResponse = {
  status: 'error';
  errors: ApiError[];
};

/**
 * Normalized API response shape.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
