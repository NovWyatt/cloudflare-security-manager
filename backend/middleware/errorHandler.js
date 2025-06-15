const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.userId || 'anonymous'
    });

    // Default error response
    let error = {
        error: 'Internal server error',
        message: 'Something went wrong',
        timestamp: new Date().toISOString()
    };

    let statusCode = 500;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        // Sequelize validation error
        statusCode = 400;
        error.error = 'Validation error';
        error.message = err.message;
        error.details = err.errors?.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
    } else if (err.name === 'SequelizeUniqueConstraintError') {
        // Duplicate entry error
        statusCode = 409;
        error.error = 'Conflict';
        error.message = 'Resource already exists';
        error.details = err.errors?.map(e => ({
            field: e.path,
            message: e.message
        }));
    } else if (err.name === 'SequelizeForeignKeyConstraintError') {
        // Foreign key constraint error
        statusCode = 400;
        error.error = 'Bad request';
        error.message = 'Invalid reference to related resource';
    } else if (err.name === 'JsonWebTokenError') {
        // JWT error
        statusCode = 401;
        error.error = 'Authentication failed';
        error.message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        // JWT expired
        statusCode = 401;
        error.error = 'Authentication failed';
        error.message = 'Token expired';
    } else if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
        // JSON parsing error
        statusCode = 400;
        error.error = 'Bad request';
        error.message = 'Invalid JSON format';
    } else if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        // Connection error (Cloudflare API)
        statusCode = 503;
        error.error = 'Service unavailable';
        error.message = 'External service temporarily unavailable';
    } else if (err.response?.status) {
        // HTTP error from external API (Axios)
        statusCode = err.response.status >= 500 ? 503 : err.response.status;
        error.error = err.response.statusText || 'External API error';
        error.message = err.response.data?.message || 'External service error';
    } else if (err.statusCode) {
        // Custom error with status code
        statusCode = err.statusCode;
        error.error = err.name || 'Application error';
        error.message = err.message;
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        error.message = 'Internal server error';
        delete error.details;
    }

    // Add request ID for tracking
    if (req.id) {
        error.requestId = req.id;
    }

    res.status(statusCode).json(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        timestamp: new Date().toISOString()
    });
};

/**
 * Create custom error
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);

        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Cloudflare API error handler
 */
const handleCloudflareError = (error) => {
    if (error.response) {
        const { status, data } = error.response;

        // Cloudflare specific error handling
        if (status === 400 && data.errors) {
            const errorMessage = data.errors.map(e => e.message).join(', ');
            throw new AppError(`Cloudflare API error: ${errorMessage}`, 400);
        }

        if (status === 401) {
            throw new AppError('Invalid Cloudflare API token', 401);
        }

        if (status === 403) {
            throw new AppError('Insufficient permissions for Cloudflare API', 403);
        }

        if (status === 404) {
            throw new AppError('Cloudflare resource not found', 404);
        }

        if (status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 60;
            throw new AppError(`Cloudflare API rate limit exceeded. Retry after ${retryAfter} seconds`, 429);
        }

        if (status >= 500) {
            throw new AppError('Cloudflare API server error', 503);
        }

        // Handle other HTTP status codes
        if (status === 422) {
            const validationErrors = data.errors || [];
            const errorDetails = validationErrors.map(e => `${e.code}: ${e.message}`).join(', ');
            throw new AppError(`Cloudflare validation error: ${errorDetails}`, 422);
        }

        // Generic HTTP error
        throw new AppError(`Cloudflare API error: ${data.message || data.error || 'Unknown error'}`, status);
    }

    // Handle network and connection errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new AppError('Cannot connect to Cloudflare API - Please check your internet connection', 503);
    }

    if (error.code === 'ETIMEDOUT') {
        throw new AppError('Cloudflare API request timeout - Please try again', 504);
    }

    if (error.code === 'ECONNRESET') {
        throw new AppError('Connection to Cloudflare API was reset - Please try again', 503);
    }

    if (error.code === 'CERT_HAS_EXPIRED') {
        throw new AppError('SSL certificate error when connecting to Cloudflare API', 503);
    }

    // Handle axios specific errors
    if (error.code === 'ERR_NETWORK') {
        throw new AppError('Network error when connecting to Cloudflare API', 503);
    }

    if (error.code === 'ERR_CANCELED') {
        throw new AppError('Cloudflare API request was canceled', 408);
    }

    // Default fallback
    throw new AppError('Cloudflare API error: ' + (error.message || 'Unknown error occurred'), 500);
};

/**
 * Database error handler
 */
const handleDatabaseError = (error) => {
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message);
        throw new AppError(`Validation error: ${messages.join(', ')}`, 400);
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0]?.path || 'field';
        throw new AppError(`${field} already exists`, 409);
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new AppError('Referenced resource does not exist', 400);
    }

    if (error.name === 'SequelizeConnectionError') {
        throw new AppError('Database connection error', 503);
    }

    if (error.name === 'SequelizeTimeoutError') {
        throw new AppError('Database query timeout', 504);
    }

    throw new AppError('Database error: ' + error.message, 500);
};

/**
 * Validation error handler
 */
const handleValidationError = (error) => {
    if (error.details) {
        const messages = error.details.map(detail => detail.message);
        throw new AppError(`Validation error: ${messages.join(', ')}`, 400);
    }

    throw new AppError('Validation error: ' + error.message, 400);
};

/**
 * File upload error handler
 */
const handleFileUploadError = (error) => {
    if (error.code === 'LIMIT_FILE_SIZE') {
        throw new AppError('File size too large', 413);
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
        throw new AppError('Too many files uploaded', 400);
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        throw new AppError('Unexpected file field', 400);
    }

    throw new AppError('File upload error: ' + error.message, 400);
};

/**
 * Rate limiting error handler
 */
const handleRateLimitError = (error) => {
    const retryAfter = error.retryAfter || 60;
    throw new AppError(`Rate limit exceeded. Try again in ${retryAfter} seconds`, 429);
};

/**
 * Create error response with additional context
 */
const createErrorResponse = (error, req) => {
    const response = {
        error: error.error || 'Internal server error',
        message: error.message || 'Something went wrong',
        timestamp: new Date().toISOString()
    };

    // Add request ID if available
    if (req.id) {
        response.requestId = req.id;
    }

    // Add validation details in development
    if (process.env.NODE_ENV === 'development' && error.details) {
        response.details = error.details;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
        response.stack = error.stack;
    }

    // Add help information for common errors
    if (error.statusCode === 401) {
        response.help = {
            message: 'Authentication required',
            actions: ['Check your API token', 'Verify token permissions', 'Login again']
        };
    }

    if (error.statusCode === 403) {
        response.help = {
            message: 'Insufficient permissions',
            actions: ['Check your account permissions', 'Contact administrator']
        };
    }

    if (error.statusCode === 429) {
        response.help = {
            message: 'Rate limit exceeded',
            actions: ['Wait before making more requests', 'Reduce request frequency']
        };
    }

    return response;
};

module.exports = {
    errorHandler,
    asyncHandler,
    notFoundHandler,
    AppError,
    handleCloudflareError,
    handleDatabaseError,
    handleValidationError,
    handleFileUploadError,
    handleRateLimitError,
    createErrorResponse
};