/**
 * Magic Eden Error Handler
 * 
 * Provides comprehensive error handling and fallback mechanisms
 * for Magic Eden integration
 */

export interface MagicEdenError {
  code: string;
  message: string;
  details?: string | Record<string, unknown> | Error;
  timestamp: string;
  collectionId?: string;
  symbol?: string;
}

export interface MagicEdenErrorResponse {
  success: false;
  error: MagicEdenError;
  fallbackActions?: string[];
}

export class MagicEdenErrorHandler {
  private static readonly ERROR_CODES = {
    VALIDATION_FAILED: 'ME_VALIDATION_FAILED',
    API_UNAVAILABLE: 'ME_API_UNAVAILABLE',
    COLLECTION_NOT_FOUND: 'ME_COLLECTION_NOT_FOUND',
    INVALID_SYMBOL: 'ME_INVALID_SYMBOL',
    RATE_LIMITED: 'ME_RATE_LIMITED',
    NETWORK_ERROR: 'ME_NETWORK_ERROR',
    INVALID_METADATA: 'ME_INVALID_METADATA',
    SUBMISSION_FAILED: 'ME_SUBMISSION_FAILED'
  } as const;

  /**
   * Handles API errors from Magic Eden
   */
  static handleApiError(error: unknown, context?: { collectionId?: string; symbol?: string }): MagicEdenError {
    const timestamp = new Date().toISOString();
    
    // Network/fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        code: this.ERROR_CODES.NETWORK_ERROR,
        message: 'Failed to connect to Magic Eden API. Please check your internet connection.',
        details: error.message,
        timestamp,
        ...context
      };
    }

    // HTTP response errors
    if (error && typeof error === 'object' && 'status' in error) {
      const httpError = error as { status: number; statusText?: string };
      switch (httpError.status) {
        case 404:
          return {
            code: this.ERROR_CODES.COLLECTION_NOT_FOUND,
            message: 'Collection not found on Magic Eden. This is normal for new collections.',
            details: `HTTP ${httpError.status}`,
            timestamp,
            ...context
          };
        case 429:
          return {
            code: this.ERROR_CODES.RATE_LIMITED,
            message: 'Magic Eden API rate limit exceeded. Please try again later.',
            details: `HTTP ${httpError.status}`,
            timestamp,
            ...context
          };
        case 500:
        case 502:
        case 503:
          return {
            code: this.ERROR_CODES.API_UNAVAILABLE,
            message: 'Magic Eden API is temporarily unavailable. Please try again later.',
            details: `HTTP ${httpError.status}`,
            timestamp,
            ...context
          };
        default:
          return {
            code: this.ERROR_CODES.API_UNAVAILABLE,
            message: `Magic Eden API returned an error: ${httpError.status}`,
            details: httpError.statusText || `HTTP ${httpError.status}`,
            timestamp,
            ...context
          };
      }
    }

    // Validation errors
    if (error instanceof Error && error.message.includes('validation')) {
      return {
        code: this.ERROR_CODES.VALIDATION_FAILED,
        message: 'Collection data validation failed for Magic Eden standards.',
        details: error.message,
        timestamp,
        ...context
      };
    }

    // Generic error
    if (error instanceof Error) {
      return {
        code: 'ME_UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred with Magic Eden integration.',
        details: error.stack || error.toString(),
        timestamp,
        ...context
      };
    }

    // Unknown error type
    return {
      code: 'ME_UNKNOWN_ERROR',
      message: 'An unknown error occurred with Magic Eden integration.',
      details: String(error),
      timestamp,
      ...context
    };
  }

  /**
   * Handles validation errors
   */
  static handleValidationError(
    errors: string[], 
    context?: { collectionId?: string; symbol?: string }
  ): MagicEdenError {
    return {
      code: this.ERROR_CODES.VALIDATION_FAILED,
      message: `Magic Eden validation failed: ${errors.join(', ')}`,
      details: { validationErrors: errors },
      timestamp: new Date().toISOString(),
      ...context
    };
  }

  /**
   * Generates fallback actions based on error type
   */
  static generateFallbackActions(error: MagicEdenError): string[] {
    const actions: string[] = [];

    switch (error.code) {
      case this.ERROR_CODES.VALIDATION_FAILED:
        actions.push('Review and fix validation errors in collection metadata');
        actions.push('Ensure all required fields are properly filled');
        actions.push('Check that image URLs are accessible');
        actions.push('Verify Solana wallet addresses are valid');
        break;

      case this.ERROR_CODES.COLLECTION_NOT_FOUND:
        actions.push('This is normal for new collections - Magic Eden will auto-list once NFTs are minted');
        actions.push('Ensure your collection follows Metaplex Core standards');
        actions.push('Wait 24-48 hours after minting for auto-listing');
        actions.push('If auto-listing fails, use manual submission via Creator Hub');
        break;

      case this.ERROR_CODES.API_UNAVAILABLE:
      case this.ERROR_CODES.NETWORK_ERROR:
        actions.push('Retry the operation in a few minutes');
        actions.push('Check Magic Eden status page for service updates');
        actions.push('Collection creation was successful - Magic Eden integration can be retried later');
        break;

      case this.ERROR_CODES.RATE_LIMITED:
        actions.push('Wait 5-10 minutes before retrying');
        actions.push('Implement exponential backoff for bulk operations');
        actions.push('Consider processing collections in smaller batches');
        break;

      case this.ERROR_CODES.INVALID_METADATA:
        actions.push('Review NFT metadata format');
        actions.push('Ensure attributes follow standard schema');
        actions.push('Verify image and metadata URIs are accessible');
        break;

      default:
        actions.push('Review error details and try again');
        actions.push('Contact support if the issue persists');
        actions.push('Collection functionality is not affected by this error');
        break;
    }

    return actions;
  }

  /**
   * Creates a safe error response that doesn't break the main flow
   */
  static createSafeErrorResponse(
    error: unknown, 
    context?: { collectionId?: string; symbol?: string }
  ): MagicEdenErrorResponse {
    const magicEdenError = this.handleApiError(error, context);
    const fallbackActions = this.generateFallbackActions(magicEdenError);

    return {
      success: false,
      error: magicEdenError,
      fallbackActions
    };
  }

  /**
   * Logs errors in a structured format
   */
  static logError(error: MagicEdenError, operation: string): void {
    console.error(`[Magic Eden Integration] ${operation} failed:`, {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      collectionId: error.collectionId,
      symbol: error.symbol,
      details: error.details
    });
  }

  /**
   * Determines if an error is retryable
   */
  static isRetryableError(error: MagicEdenError): boolean {
    const retryableCodes: string[] = [
      this.ERROR_CODES.API_UNAVAILABLE,
      this.ERROR_CODES.NETWORK_ERROR,
      this.ERROR_CODES.RATE_LIMITED
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Calculates retry delay based on error type
   */
  static getRetryDelay(error: MagicEdenError, attemptNumber: number): number {
    switch (error.code) {
      case this.ERROR_CODES.RATE_LIMITED:
        return Math.min(300000, 60000 * attemptNumber); // 1min, 2min, 3min, max 5min
      case this.ERROR_CODES.API_UNAVAILABLE:
      case this.ERROR_CODES.NETWORK_ERROR:
        return Math.min(60000, 5000 * Math.pow(2, attemptNumber)); // Exponential backoff, max 1min
      default:
        return 0; // No retry for non-retryable errors
    }
  }

  /**
   * Wraps Magic Eden operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: { collectionId?: string; symbol?: string }
  ): Promise<{ success: true; data: T } | MagicEdenErrorResponse> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const errorResponse = this.createSafeErrorResponse(error, context);
      this.logError(errorResponse.error, operationName);
      return errorResponse;
    }
  }
}

export const magicEdenErrorHandler = MagicEdenErrorHandler;
