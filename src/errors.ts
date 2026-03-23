/**
 * Base error class for all Township SDK errors.
 */
export class TownshipError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null,
  ) {
    super(message)
    this.name = 'TownshipError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the API key is missing or invalid (HTTP 401).
 */
export class AuthenticationError extends TownshipError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401)
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when a location cannot be found (HTTP 404).
 */
export class NotFoundError extends TownshipError {
  constructor(message = 'Location not found') {
    super(message, 404)
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the API rate limit is exceeded (HTTP 429).
 */
export class RateLimitError extends TownshipError {
  constructor(message = 'Rate limit exceeded. Please slow down your requests.') {
    super(message, 429)
    this.name = 'RateLimitError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the request is malformed (HTTP 400).
 */
export class ValidationError extends TownshipError {
  constructor(message = 'Invalid request') {
    super(message, 400)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the batch payload exceeds the maximum size (HTTP 413).
 */
export class PayloadTooLargeError extends TownshipError {
  constructor(message = 'Batch payload exceeds the maximum of 100 records per request') {
    super(message, 413)
    this.name = 'PayloadTooLargeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
