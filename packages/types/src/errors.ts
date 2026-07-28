/**
 * Standardized error codes used across platform packages.
 */
export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR';

/**
 * The shape of an error object returned by APIs.
 */
export type ServiceError = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * The shape of an error response returned by platform APIs.
 */
export type ErrorResponse = {
  status: 'error';
  errors: ServiceError[];
};
