const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { encryptToken, decryptToken } = require('../services/encryptionService');
const logger = require('../utils/logger');

class AuthController {
    // Đăng ký người dùng mới
    async register(req, res) {
        try {
            const { username, email, password, cloudflareApiToken } = req.body;

            // Kiểm tra user đã tồn tại
            const existingUser = await User.findOne({
                where: {
                    $or: [{ email }, { username }]
                }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username hoặc email đã được sử dụng'
                });
            }

            // Mã hóa password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Mã hóa Cloudflare API token
            const encryptedToken = encryptToken(cloudflareApiToken);

            // Tạo user mới
            const user = await User.create({
                username,
                email,
                password: hashedPassword,
                cloudflareApiToken: encryptedToken,
                isActive: true
            });

            logger.info(`New user registered: ${username}`, { userId: user.id });

            // Không trả về password trong response
            const { password: _, ...userResponse } = user.toJSON();

            res.status(201).json({
                success: true,
                message: 'Đăng ký thành công',
                data: { user: userResponse }
            });

        } catch (error) {
            logger.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi đăng ký'
            });
        }
    }

    // Đăng nhập
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Tìm user theo email
            const user = await User.findOne({
                where: { email, isActive: true }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không đúng'
                });
            }

            // Kiểm tra password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không đúng'
                });
            }

            // Cập nhật lastLogin
            await user.update({ lastLogin: new Date() });

            // Tạo JWT token
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    username: user.username
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            logger.info(`User logged in: ${user.username}`, { userId: user.id });

            // Không trả về password trong response
            const { password: _, cloudflareApiToken, ...userResponse } = user.toJSON();

            res.json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    user: userResponse,
                    token,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                }
            });

        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi đăng nhập'
            });
        }
    }

    // Lấy thông tin profile
    async getProfile(req, res) {
        try {
            const user = await User.findByPk(req.userId, {
                attributes: { exclude: ['password', 'cloudflareApiToken'] }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy người dùng'
                });
            }

            res.json({
                success: true,
                data: { user }
            });

        } catch (error) {
            logger.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin profile'
            });
        }
    }

    // Cập nhật profile
    async updateProfile(req, res) {
        try {
            const { username, email, currentPassword, newPassword } = req.body;

            const user = await User.findByPk(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy người dùng'
                });
            }

            // Kiểm tra email/username trùng lặp
            if (email !== user.email || username !== user.username) {
                const existingUser = await User.findOne({
                    where: {
                        $or: [{ email }, { username }],
                        id: { $ne: user.id }
                    }
                });

                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'Username hoặc email đã được sử dụng'
                    });
                }
            }

            const updateData = { username, email };

            // Nếu muốn đổi password
            if (newPassword) {
                if (!currentPassword) {
                    return res.status(400).json({
                        success: false,
                        message: 'Vui lòng nhập mật khẩu hiện tại'
                    });
                }

                const isValidPassword = await bcrypt.compare(currentPassword, user.password);
                if (!isValidPassword) {
                    return res.status(400).json({
                        success: false,
                        message: 'Mật khẩu hiện tại không đúng'
                    });
                }

                const saltRounds = 12;
                updateData.password = await bcrypt.hash(newPassword, saltRounds);
            }

            await user.update(updateData);

            logger.info(`User profile updated: ${user.username}`, { userId: user.id });

            // Trả về user info không có password
            const { password: _, cloudflareApiToken, ...userResponse } = user.toJSON();

            res.json({
                success: true,
                message: 'Cập nhật profile thành công',
                data: { user: userResponse }
            });

        } catch (error) {
            logger.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật profile'
            });
        }
    }

    // Cập nhật Cloudflare API Token
    async updateCloudflareToken(req, res) {
        try {
            const { cloudflareApiToken } = req.body;

            if (!cloudflareApiToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Cloudflare API Token không được để trống'
                });
            }

            const user = await User.findByPk(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy người dùng'
                });
            }

            // Mã hóa token mới
            const encryptedToken = encryptToken(cloudflareApiToken);
            await user.update({ cloudflareApiToken: encryptedToken });

            logger.info(`Cloudflare token updated for user: ${user.username}`, { userId: user.id });

            res.json({
                success: true,
                message: 'Cập nhật Cloudflare API Token thành công'
            });

        } catch (error) {
            logger.error('Update Cloudflare token error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật token'
            });
        }
    }

    // Verify JWT token
    async verifyToken(req, res) {
        try {
            const user = await User.findByPk(req.userId, {
                attributes: { exclude: ['password', 'cloudflareApiToken'] }
            });

            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Token không hợp lệ'
                });
            }

            res.json({
                success: true,
                data: { user }
            });

        } catch (error) {
            logger.error('Verify token error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi verify token'
            });
        }
    }

    // Đăng xuất (thực tế chỉ cần frontend xóa token)
    async logout(req, res) {
        try {
            logger.info(`User logged out: ${req.user?.username}`, { userId: req.userId });

            res.json({
                success: true,
                message: 'Đăng xuất thành công'
            });

        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi đăng xuất'
            });
        }
    }
}

module.exports = new AuthController();