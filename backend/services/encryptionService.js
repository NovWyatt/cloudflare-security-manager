const crypto = require('crypto');
const logger = require('../utils/logger');

class EncryptionService {
    constructor() {
        this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
        this.secretKey = process.env.ENCRYPTION_KEY;

        if (!this.secretKey) {
            throw new Error('ENCRYPTION_KEY environment variable is required');
        }

        if (this.secretKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be 32 characters long');
        }

        this.keyBuffer = Buffer.from(this.secretKey, 'utf8');
    }

    /**
     * Encrypt text using AES-256-GCM
     * @param {string} text - Text to encrypt
     * @returns {string} - Encrypted text in format: iv:authTag:encrypted
     */
    encrypt(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Text must be a non-empty string');
            }

            // Generate random IV
            const iv = crypto.randomBytes(16);

            // Create cipher
            const cipher = crypto.createCipher(this.algorithm, this.keyBuffer);
            cipher.setAutoPadding(true);

            // Encrypt the text
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Get authentication tag (for GCM mode)
            const authTag = cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : '';

            // Combine IV, auth tag, and encrypted data
            const result = `${iv.toString('hex')}:${authTag}:${encrypted}`;

            logger.debug('Text encrypted successfully');
            return result;

        } catch (error) {
            logger.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt text using AES-256-GCM
     * @param {string} encryptedText - Encrypted text in format: iv:authTag:encrypted
     * @returns {string} - Decrypted text
     */
    decrypt(encryptedText) {
        try {
            if (!encryptedText || typeof encryptedText !== 'string') {
                throw new Error('Encrypted text must be a non-empty string');
            }

            // Split the encrypted text
            const parts = encryptedText.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted text format');
            }

            const [ivHex, authTagHex, encrypted] = parts;

            // Convert hex strings back to buffers
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = authTagHex ? Buffer.from(authTagHex, 'hex') : null;

            // Create decipher
            const decipher = crypto.createDecipher(this.algorithm, this.keyBuffer);

            // Set auth tag for GCM mode
            if (authTag && decipher.setAuthTag) {
                decipher.setAuthTag(authTag);
            }

            // Decrypt the text
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            logger.debug('Text decrypted successfully');
            return decrypted;

        } catch (error) {
            logger.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash text using SHA-256
     * @param {string} text - Text to hash
     * @returns {string} - SHA-256 hash
     */
    hash(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Text must be a non-empty string');
            }

            return crypto.createHash('sha256').update(text).digest('hex');

        } catch (error) {
            logger.error('Hashing failed:', error);
            throw new Error('Failed to hash data');
        }
    }

    /**
     * Create HMAC signature
     * @param {string} text - Text to sign
     * @param {string} secret - Secret key for HMAC
     * @returns {string} - HMAC signature
     */
    createHmac(text, secret = this.secretKey) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Text must be a non-empty string');
            }

            return crypto.createHmac('sha256', secret).update(text).digest('hex');

        } catch (error) {
            logger.error('HMAC creation failed:', error);
            throw new Error('Failed to create HMAC');
        }
    }

    /**
     * Verify HMAC signature
     * @param {string} text - Original text
     * @param {string} signature - HMAC signature to verify
     * @param {string} secret - Secret key for HMAC
     * @returns {boolean} - True if signature is valid
     */
    verifyHmac(text, signature, secret = this.secretKey) {
        try {
            const expectedSignature = this.createHmac(text, secret);
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            logger.error('HMAC verification failed:', error);
            return false;
        }
    }

    /**
     * Generate random token
     * @param {number} length - Token length in bytes (default: 32)
     * @returns {string} - Random token in hex format
     */
    generateToken(length = 32) {
        try {
            return crypto.randomBytes(length).toString('hex');
        } catch (error) {
            logger.error('Token generation failed:', error);
            throw new Error('Failed to generate token');
        }
    }

    /**
     * Generate cryptographically secure random string
     * @param {number} length - String length
     * @param {string} charset - Character set to use
     * @returns {string} - Random string
     */
    generateRandomString(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        try {
            let result = '';
            const charsetLength = charset.length;
            const randomBytes = crypto.randomBytes(length);

            for (let i = 0; i < length; i++) {
                result += charset[randomBytes[i] % charsetLength];
            }

            return result;
        } catch (error) {
            logger.error('Random string generation failed:', error);
            throw new Error('Failed to generate random string');
        }
    }

    /**
     * Encrypt JSON object
     * @param {object} obj - Object to encrypt
     * @returns {string} - Encrypted JSON string
     */
    encryptObject(obj) {
        try {
            const jsonString = JSON.stringify(obj);
            return this.encrypt(jsonString);
        } catch (error) {
            logger.error('Object encryption failed:', error);
            throw new Error('Failed to encrypt object');
        }
    }

    /**
     * Decrypt JSON object
     * @param {string} encryptedJson - Encrypted JSON string
     * @returns {object} - Decrypted object
     */
    decryptObject(encryptedJson) {
        try {
            const jsonString = this.decrypt(encryptedJson);
            return JSON.parse(jsonString);
        } catch (error) {
            logger.error('Object decryption failed:', error);
            throw new Error('Failed to decrypt object');
        }
    }

    /**
     * Create encrypted API token for storage
     * @param {string} token - Cloudflare API token
     * @param {string} userId - User ID for additional security
     * @returns {string} - Encrypted token
     */
    encryptApiToken(token, userId) {
        try {
            // Add user ID as additional data for security
            const tokenData = {
                token,
                userId,
                timestamp: Date.now()
            };

            return this.encryptObject(tokenData);
        } catch (error) {
            logger.error('API token encryption failed:', error);
            throw new Error('Failed to encrypt API token');
        }
    }

    /**
     * Decrypt API token from storage
     * @param {string} encryptedToken - Encrypted token
     * @param {string} userId - User ID for verification
     * @returns {string} - Decrypted API token
     */
    decryptApiToken(encryptedToken, userId) {
        try {
            const tokenData = this.decryptObject(encryptedToken);

            // Verify user ID matches
            if (tokenData.userId !== userId) {
                throw new Error('Token does not belong to this user');
            }

            // Check if token is not too old (optional security measure)
            const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
            if (Date.now() - tokenData.timestamp > maxAge) {
                logger.warn('Attempting to decrypt old API token', { userId });
            }

            return tokenData.token;
        } catch (error) {
            logger.error('API token decryption failed:', error);
            throw new Error('Failed to decrypt API token');
        }
    }

    /**
     * Generate a secure session token
     * @returns {object} - Session token and its hash
     */
    generateSessionToken() {
        try {
            const token = this.generateToken(32);
            const hash = this.hash(token);

            return {
                token,
                hash,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            };
        } catch (error) {
            logger.error('Session token generation failed:', error);
            throw new Error('Failed to generate session token');
        }
    }

    /**
     * Verify session token
     * @param {string} token - Session token to verify
     * @param {string} storedHash - Stored hash to compare against
     * @returns {boolean} - True if token is valid
     */
    verifySessionToken(token, storedHash) {
        try {
            const tokenHash = this.hash(token);
            return crypto.timingSafeEqual(
                Buffer.from(tokenHash, 'hex'),
                Buffer.from(storedHash, 'hex')
            );
        } catch (error) {
            logger.error('Session token verification failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;