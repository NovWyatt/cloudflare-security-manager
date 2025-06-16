const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const { Zone, SecurityConfig, User, AuditLog } = require('../models');
const cloudflareService = require('./cloudflareService');
const logger = require('../utils/logger');

class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.isInitialized = false;
    this.scheduledJobs = new Map();
  }

  // Khởi tạo backup service
  async initialize() {
    try {
      // Tạo backup directory
      await this.ensureBackupDirectory();

      // Khởi tạo scheduled backups
      await this.initializeScheduledBackups();

      this.isInitialized = true;
      logger.info('Backup service initialized successfully');

      return true;
    } catch (error) {
      logger.error('Failed to initialize backup service:', error);
      return false;
    }
  }

  // Đảm bảo backup directory tồn tại
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });

      // Tạo subdirectories cho từng loại backup
      const subDirs = ['automatic', 'manual', 'daily', 'weekly'];
      for (const subDir of subDirs) {
        await fs.mkdir(path.join(this.backupDir, subDir), { recursive: true });
      }

      logger.info('Backup directories created/verified');
    } catch (error) {
      logger.error('Failed to create backup directories:', error);
      throw error;
    }
  }

  // Backup cấu hình một zone
  async backupZoneConfig(userId, zoneId, options = {}) {
    try {
      const {
        includeSecrets = false,
        description = 'Manual backup',
        type = 'manual'
      } = options;

      // Lấy thông tin zone
      const zone = await Zone.findOne({
        where: {
          cloudflareId: zoneId,
          userId
        }
      });

      if (!zone) {
        throw new Error('Zone not found or access denied');
      }

      // Lấy cấu hình từ Cloudflare
      const [zoneSettings, securitySettings, firewallRules, dnsRecords] = await Promise.all([
        cloudflareService.getZoneSettings(userId, zoneId),
        cloudflareService.getSecuritySettings(userId, zoneId),
        cloudflareService.getFirewallRules(userId, zoneId),
        includeSecrets ? cloudflareService.getDnsRecords(userId, zoneId) : null
      ]);

      // Lấy local security config
      const localSecurityConfig = await SecurityConfig.findOne({
        where: { zoneId: zone.id }
      });

      // Tạo backup data
      const backupData = {
        metadata: {
          backupId: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          backupAt: new Date().toISOString(),
          backupBy: userId,
          version: '1.0',
          type,
          description,
          includeSecrets
        },
        zone: {
          id: zoneId,
          name: zone.name,
          status: zone.status,
          type: zone.type,
          nameServers: JSON.parse(zone.nameServers || '[]')
        },
        settings: {
          zone: zoneSettings,
          security: securitySettings,
          localSecurity: localSecurityConfig
        },
        firewall: {
          rules: firewallRules
        }
      };

      if (includeSecrets && dnsRecords) {
        backupData.dns = { records: dnsRecords };
      }

      // Lưu backup file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${zone.name}_${timestamp}_${backupData.metadata.backupId}.json`;
      const backupFilePath = path.join(this.backupDir, type, backupFileName);

      await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));

      // Ghi audit log
      await AuditLog.create({
        userId,
        zoneId: zone.id,
        action: 'CREATE_BACKUP',
        details: JSON.stringify({
          backupId: backupData.metadata.backupId,
          backupFileName,
          type,
          description,
          includeSecrets
        })
      });

      logger.info(`Zone backup created: ${zone.name}`, {
        userId,
        zoneId,
        backupId: backupData.metadata.backupId,
        backupFileName,
        type
      });

      return {
        success: true,
        backupId: backupData.metadata.backupId,
        backupFileName,
        backupPath: backupFilePath,
        backupAt: backupData.metadata.backupAt,
        fileSize: (await fs.stat(backupFilePath)).size
      };

    } catch (error) {
      logger.error('Failed to backup zone config:', error);
      throw error;
    }
  }

  // Backup tất cả zones của user
  async backupAllUserZones(userId, options = {}) {
    try {
      const {
        includeSecrets = false,
        description = 'Bulk backup',
        type = 'manual'
      } = options;

      // Lấy tất cả zones của user
      const zones = await Zone.findAll({
        where: { userId },
        attributes: ['id', 'cloudflareId', 'name', 'status', 'type']
      });

      if (zones.length === 0) {
        throw new Error('No zones found for user');
      }

      const backupResults = [];
      const errors = [];

      // Backup từng zone
      for (const zone of zones) {
        try {
          const result = await this.backupZoneConfig(userId, zone.cloudflareId, {
            includeSecrets,
            description: `${description} - ${zone.name}`,
            type
          });

          backupResults.push({
            zoneName: zone.name,
            zoneId: zone.cloudflareId,
            ...result
          });

        } catch (error) {
          logger.error(`Failed to backup zone ${zone.name}:`, error);
          errors.push({
            zoneName: zone.name,
            zoneId: zone.cloudflareId,
            error: error.message
          });
        }
      }

      // Tạo summary backup file
      const summaryData = {
        metadata: {
          summaryBackupId: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          backupAt: new Date().toISOString(),
          backupBy: userId,
          version: '1.0',
          type,
          description,
          totalZones: zones.length,
          successfulBackups: backupResults.length,
          failedBackups: errors.length
        },
        results: backupResults,
        errors
      };

      const summaryFileName = `summary_${new Date().toISOString().replace(/[:.]/g, '-')}_${summaryData.metadata.summaryBackupId}.json`;
      const summaryFilePath = path.join(this.backupDir, type, summaryFileName);

      await fs.writeFile(summaryFilePath, JSON.stringify(summaryData, null, 2));

      logger.info(`Bulk backup completed for user`, {
        userId,
        totalZones: zones.length,
        successful: backupResults.length,
        failed: errors.length,
        summaryFile: summaryFileName
      });

      return {
        success: true,
        summaryBackupId: summaryData.metadata.summaryBackupId,
        summaryFileName,
        summaryPath: summaryFilePath,
        totalZones: zones.length,
        successfulBackups: backupResults.length,
        failedBackups: errors.length,
        results: backupResults,
        errors
      };

    } catch (error) {
      logger.error('Failed to backup all user zones:', error);
      throw error;
    }
  }

  // Restore từ backup file
  async restoreFromBackup(userId, backupFilePath, options = {}) {
    try {
      const { dryRun = false, targetZoneId = null } = options;

      // Đọc backup file
      let backupData;
      try {
        const backupContent = await fs.readFile(backupFilePath, 'utf8');
        backupData = JSON.parse(backupContent);
      } catch (error) {
        throw new Error('Invalid backup file or file not found');
      }

      // Validate backup data
      if (!backupData.metadata || !backupData.zone || !backupData.settings) {
        throw new Error('Invalid backup file format');
      }

      const zoneId = targetZoneId || backupData.zone.id;

      // Kiểm tra zone thuộc về user
      const zone = await Zone.findOne({
        where: {
          cloudflareId: zoneId,
          userId
        }
      });

      if (!zone) {
        throw new Error('Target zone not found or access denied');
      }

      const restoreResults = {
        zoneId,
        zoneName: zone.name,
        backupId: backupData.metadata.backupId,
        restoredAt: new Date().toISOString(),
        dryRun,
        changes: [],
        errors: []
      };

      // Restore zone settings
      if (backupData.settings.zone) {
        for (const [setting, value] of Object.entries(backupData.settings.zone)) {
          try {
            if (!dryRun) {
              await cloudflareService.updateZoneSetting(userId, zoneId, setting, value);
            }
            restoreResults.changes.push({
              type: 'zone_setting',
              setting,
              value,
              status: 'restored'
            });
          } catch (error) {
            restoreResults.errors.push({
              type: 'zone_setting',
              setting,
              error: error.message
            });
          }
        }
      }

      // Restore security settings
      if (backupData.settings.security) {
        const securitySettings = backupData.settings.security;

        if (securitySettings.security_level) {
          try {
            if (!dryRun) {
              await cloudflareService.updateSecurityLevel(userId, zoneId, securitySettings.security_level);
            }
            restoreResults.changes.push({
              type: 'security_level',
              value: securitySettings.security_level,
              status: 'restored'
            });
          } catch (error) {
            restoreResults.errors.push({
              type: 'security_level',
              error: error.message
            });
          }
        }
      }

      // Restore firewall rules
      if (backupData.firewall?.rules && Array.isArray(backupData.firewall.rules)) {
        for (const rule of backupData.firewall.rules) {
          try {
            if (!dryRun) {
              await cloudflareService.createFirewallRule(userId, zoneId, {
                expression: rule.expression,
                action: rule.action,
                description: `${rule.description} (restored from backup)`,
                priority: rule.priority || 1
              });
            }
            restoreResults.changes.push({
              type: 'firewall_rule',
              rule: rule.description || 'Unnamed rule',
              action: rule.action,
              status: 'restored'
            });
          } catch (error) {
            restoreResults.errors.push({
              type: 'firewall_rule',
              rule: rule.description || 'Unnamed rule',
              error: error.message
            });
          }
        }
      }

      // Restore local security config
      if (backupData.settings.localSecurity && !dryRun) {
        await SecurityConfig.upsert({
          zoneId: zone.id,
          ...backupData.settings.localSecurity,
          updatedAt: new Date()
        });
        restoreResults.changes.push({
          type: 'local_security_config',
          status: 'restored'
        });
      }

      // Ghi audit log
      if (!dryRun) {
        await AuditLog.create({
          userId,
          zoneId: zone.id,
          action: 'RESTORE_BACKUP',
          details: JSON.stringify({
            backupId: backupData.metadata.backupId,
            totalChanges: restoreResults.changes.length,
            totalErrors: restoreResults.errors.length
          })
        });

        logger.info(`Backup restored for zone: ${zone.name}`, {
          userId,
          zoneId,
          backupId: backupData.metadata.backupId,
          changes: restoreResults.changes.length,
          errors: restoreResults.errors.length
        });
      }

      return restoreResults;

    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  // Lấy danh sách backups
  async listBackups(userId, options = {}) {
    try {
      const { type = 'all', limit = 50, zoneId = null } = options;

      // Tạo user backup directory nếu chưa có
      const userBackupDir = path.join(this.backupDir, userId.toString());
      try {
        await fs.mkdir(userBackupDir, { recursive: true });
      } catch (error) {
        // Directory đã tồn tại
      }

      const backups = [];
      const searchDirs = type === 'all'
        ? ['manual', 'automatic', 'daily', 'weekly']
        : [type];

      for (const dir of searchDirs) {
        const dirPath = path.join(this.backupDir, dir);
        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);

            try {
              const content = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(content);

              // Lọc theo userId và zoneId nếu cần
              if (data.metadata?.backupBy !== userId) continue;
              if (zoneId && data.zone?.id !== zoneId) continue;

              backups.push({
                backupId: data.metadata?.backupId,
                fileName: file,
                filePath,
                type: dir,
                zoneName: data.zone?.name,
                zoneId: data.zone?.id,
                description: data.metadata?.description,
                backupAt: data.metadata?.backupAt,
                includeSecrets: data.metadata?.includeSecrets || false,
                fileSize: stats.size,
                version: data.metadata?.version
              });

            } catch (error) {
              logger.warn(`Failed to parse backup file ${file}:`, error.message);
            }
          }
        } catch (error) {
          // Directory không tồn tại hoặc không thể đọc
        }
      }

      // Sắp xếp theo thời gian backup (mới nhất trước)
      backups.sort((a, b) => new Date(b.backupAt) - new Date(a.backupAt));

      // Giới hạn số lượng kết quả
      const limitedBackups = backups.slice(0, limit);

      return {
        backups: limitedBackups,
        total: backups.length,
        filtered: limitedBackups.length
      };

    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw error;
    }
  }

  // Xóa backup cũ
  async cleanupOldBackups(options = {}) {
    try {
      const {
        retentionDays = 30,
        maxBackupsPerZone = 10,
        dryRun = false
      } = options;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const cleanupResults = {
        deletedFiles: [],
        retainedFiles: [],
        errors: [],
        totalSizeFreed: 0
      };

      const searchDirs = ['manual', 'automatic', 'daily', 'weekly'];

      for (const dir of searchDirs) {
        const dirPath = path.join(this.backupDir, dir);

        try {
          const files = await fs.readdir(dirPath);
          const backupsByZone = new Map();

          // Phân loại backups theo zone
          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);

            try {
              const content = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(content);

              const zoneKey = `${data.metadata?.backupBy}_${data.zone?.id}`;

              if (!backupsByZone.has(zoneKey)) {
                backupsByZone.set(zoneKey, []);
              }

              backupsByZone.get(zoneKey).push({
                file,
                filePath,
                backupAt: new Date(data.metadata?.backupAt),
                fileSize: stats.size,
                data
              });

            } catch (error) {
              logger.warn(`Failed to parse backup file ${file}:`, error.message);
            }
          }

          // Cleanup cho từng zone
          for (const [zoneKey, zoneBackups] of backupsByZone) {
            // Sắp xếp theo thời gian (mới nhất trước)
            zoneBackups.sort((a, b) => b.backupAt - a.backupAt);

            for (let i = 0; i < zoneBackups.length; i++) {
              const backup = zoneBackups[i];
              const shouldDelete = i >= maxBackupsPerZone || backup.backupAt < cutoffDate;

              if (shouldDelete) {
                try {
                  if (!dryRun) {
                    await fs.unlink(backup.filePath);
                  }

                  cleanupResults.deletedFiles.push({
                    file: backup.file,
                    zoneName: backup.data.zone?.name,
                    backupAt: backup.backupAt,
                    fileSize: backup.fileSize,
                    reason: i >= maxBackupsPerZone ? 'exceeded_limit' : 'expired'
                  });

                  cleanupResults.totalSizeFreed += backup.fileSize;

                } catch (error) {
                  cleanupResults.errors.push({
                    file: backup.file,
                    error: error.message
                  });
                }
              } else {
                cleanupResults.retainedFiles.push({
                  file: backup.file,
                  zoneName: backup.data.zone?.name,
                  backupAt: backup.backupAt,
                  fileSize: backup.fileSize
                });
              }
            }
          }

        } catch (error) {
          logger.warn(`Failed to cleanup directory ${dir}:`, error.message);
        }
      }

      logger.info('Backup cleanup completed', {
        deletedFiles: cleanupResults.deletedFiles.length,
        retainedFiles: cleanupResults.retainedFiles.length,
        errors: cleanupResults.errors.length,
        sizeFreed: cleanupResults.totalSizeFreed,
        dryRun
      });

      return cleanupResults;

    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
      throw error;
    }
  }

  // Khởi tạo scheduled backups
  async initializeScheduledBackups() {
    try {
      // Daily backup lúc 2:00 AM
      const dailyJob = cron.schedule('0 2 * * *', async () => {
        logger.info('Starting daily automatic backup');
        await this.performAutomaticBackup('daily');
      }, {
        scheduled: false,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      // Weekly backup vào Chủ nhật lúc 3:00 AM
      const weeklyJob = cron.schedule('0 3 * * 0', async () => {
        logger.info('Starting weekly automatic backup');
        await this.performAutomaticBackup('weekly');
      }, {
        scheduled: false,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      // Cleanup job - chạy hàng ngày lúc 4:00 AM
      const cleanupJob = cron.schedule('0 4 * * *', async () => {
        logger.info('Starting backup cleanup');
        await this.cleanupOldBackups({
          retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
          maxBackupsPerZone: parseInt(process.env.MAX_BACKUPS_PER_ZONE || '10')
        });
      }, {
        scheduled: false,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      this.scheduledJobs.set('daily', dailyJob);
      this.scheduledJobs.set('weekly', weeklyJob);
      this.scheduledJobs.set('cleanup', cleanupJob);

      // Bật scheduled jobs nếu được enable
      if (process.env.ENABLE_AUTOMATIC_BACKUP === 'true') {
        dailyJob.start();
        weeklyJob.start();
        cleanupJob.start();
        logger.info('Automatic backup jobs started');
      }

    } catch (error) {
      logger.error('Failed to initialize scheduled backups:', error);
      throw error;
    }
  }

  // Thực hiện automatic backup
  async performAutomaticBackup(type = 'daily') {
    try {
      // Lấy danh sách tất cả users có zones
      const users = await User.findAll({
        include: [{
          model: Zone,
          as: 'zones',
          required: true
        }],
        where: {
          isActive: true
        }
      });

      const results = {
        totalUsers: users.length,
        successfulUsers: 0,
        failedUsers: 0,
        totalZones: 0,
        successfulZones: 0,
        failedZones: 0,
        errors: []
      };

      for (const user of users) {
        try {
          const backupResult = await this.backupAllUserZones(user.id, {
            description: `Automatic ${type} backup`,
            type: 'automatic',
            includeSecrets: false
          });

          results.successfulUsers++;
          results.totalZones += backupResult.totalZones;
          results.successfulZones += backupResult.successfulBackups;
          results.failedZones += backupResult.failedBackups;

          logger.info(`Automatic backup completed for user ${user.username}`, {
            userId: user.id,
            totalZones: backupResult.totalZones,
            successful: backupResult.successfulBackups,
            failed: backupResult.failedBackups
          });

        } catch (error) {
          results.failedUsers++;
          results.errors.push({
            userId: user.id,
            username: user.username,
            error: error.message
          });

          logger.error(`Automatic backup failed for user ${user.username}:`, error);
        }
      }

      logger.info(`Automatic ${type} backup completed`, results);
      return results;

    } catch (error) {
      logger.error('Failed to perform automatic backup:', error);
      throw error;
    }
  }

  // Bật/tắt automatic backups
  enableAutomaticBackups() {
    try {
      for (const [name, job] of this.scheduledJobs) {
        job.start();
      }
      logger.info('Automatic backup jobs enabled');
      return true;
    } catch (error) {
      logger.error('Failed to enable automatic backups:', error);
      return false;
    }
  }

  disableAutomaticBackups() {
    try {
      for (const [name, job] of this.scheduledJobs) {
        job.stop();
      }
      logger.info('Automatic backup jobs disabled');
      return true;
    } catch (error) {
      logger.error('Failed to disable automatic backups:', error);
      return false;
    }
  }

  // Lấy thống kê backup
  async getBackupStatistics() {
    try {
      const stats = {
        totalBackups: 0,
        backupsByType: {},
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
        zoneStats: new Map()
      };

      const searchDirs = ['manual', 'automatic', 'daily', 'weekly'];

      for (const dir of searchDirs) {
        const dirPath = path.join(this.backupDir, dir);
        stats.backupsByType[dir] = { count: 0, size: 0 };

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);

            stats.totalBackups++;
            stats.backupsByType[dir].count++;
            stats.backupsByType[dir].size += stat.size;
            stats.totalSize += stat.size;

            // Đọc metadata cho thống kê chi tiết
            try {
              const content = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(content);

              const backupDate = new Date(data.metadata?.backupAt);

              if (!stats.oldestBackup || backupDate < stats.oldestBackup) {
                stats.oldestBackup = backupDate;
              }

              if (!stats.newestBackup || backupDate > stats.newestBackup) {
                stats.newestBackup = backupDate;
              }

              // Zone statistics
              const zoneName = data.zone?.name;
              if (zoneName) {
                if (!stats.zoneStats.has(zoneName)) {
                  stats.zoneStats.set(zoneName, { count: 0, size: 0, lastBackup: null });
                }

                const zoneInfo = stats.zoneStats.get(zoneName);
                zoneInfo.count++;
                zoneInfo.size += stat.size;

                if (!zoneInfo.lastBackup || backupDate > zoneInfo.lastBackup) {
                  zoneInfo.lastBackup = backupDate;
                }
              }

            } catch (error) {
              // Không thể parse file, bỏ qua
            }
          }

        } catch (error) {
          // Directory không tồn tại
        }
      }

      // Convert Map to Object for JSON serialization
      stats.zones = Object.fromEntries(stats.zoneStats);
      delete stats.zoneStats;

      return stats;

    } catch (error) {
      logger.error('Failed to get backup statistics:', error);
      throw error;
    }
  }

  // Verify backup integrity
  async verifyBackupIntegrity(backupFilePath) {
    try {
      const content = await fs.readFile(backupFilePath, 'utf8');
      const data = JSON.parse(content);

      const integrity = {
        valid: true,
        errors: [],
        warnings: [],
        metadata: data.metadata,
        checks: {
          hasMetadata: false,
          hasZoneInfo: false,
          hasSettings: false,
          validStructure: false,
          readableContent: false
        }
      };

      // Check metadata
      if (data.metadata && data.metadata.backupId && data.metadata.backupAt) {
        integrity.checks.hasMetadata = true;
      } else {
        integrity.errors.push('Missing or invalid metadata');
        integrity.valid = false;
      }

      // Check zone info
      if (data.zone && data.zone.id && data.zone.name) {
        integrity.checks.hasZoneInfo = true;
      } else {
        integrity.errors.push('Missing or invalid zone information');
        integrity.valid = false;
      }

      // Check settings
      if (data.settings && (data.settings.zone || data.settings.security)) {
        integrity.checks.hasSettings = true;
      } else {
        integrity.warnings.push('No zone or security settings found');
      }

      // Check structure
      const requiredFields = ['metadata', 'zone', 'settings'];
      const hasAllRequired = requiredFields.every(field => data.hasOwnProperty(field));
      integrity.checks.validStructure = hasAllRequired;

      if (!hasAllRequired) {
        integrity.errors.push('Invalid backup file structure');
        integrity.valid = false;
      }

      integrity.checks.readableContent = true;

      // Additional checks
      const fileStats = await fs.stat(backupFilePath);
      integrity.fileSize = fileStats.size;
      integrity.fileCreated = fileStats.birthtime;
      integrity.fileModified = fileStats.mtime;

      if (fileStats.size === 0) {
        integrity.errors.push('Empty backup file');
        integrity.valid = false;
      }

      return integrity;

    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to verify backup: ${error.message}`],
        warnings: [],
        checks: {
          hasMetadata: false,
          hasZoneInfo: false,
          hasSettings: false,
          validStructure: false,
          readableContent: false
        }
      };
    }
  }

  // Compare two backups
  async compareBackups(backup1Path, backup2Path) {
    try {
      const [backup1, backup2] = await Promise.all([
        fs.readFile(backup1Path, 'utf8').then(JSON.parse),
        fs.readFile(backup2Path, 'utf8').then(JSON.parse)
      ]);

      const comparison = {
        backup1: {
          id: backup1.metadata?.backupId,
          date: backup1.metadata?.backupAt,
          zone: backup1.zone?.name
        },
        backup2: {
          id: backup2.metadata?.backupId,
          date: backup2.metadata?.backupAt,
          zone: backup2.zone?.name
        },
        differences: [],
        identical: true
      };

      // Compare zone settings
      if (backup1.settings?.zone && backup2.settings?.zone) {
        const zone1Settings = backup1.settings.zone;
        const zone2Settings = backup2.settings.zone;

        const allKeys = new Set([...Object.keys(zone1Settings), ...Object.keys(zone2Settings)]);

        for (const key of allKeys) {
          const value1 = zone1Settings[key];
          const value2 = zone2Settings[key];

          if (JSON.stringify(value1) !== JSON.stringify(value2)) {
            comparison.differences.push({
              type: 'zone_setting',
              setting: key,
              backup1Value: value1,
              backup2Value: value2
            });
            comparison.identical = false;
          }
        }
      }

      // Compare security settings
      if (backup1.settings?.security && backup2.settings?.security) {
        const security1 = backup1.settings.security;
        const security2 = backup2.settings.security;

        const allKeys = new Set([...Object.keys(security1), ...Object.keys(security2)]);

        for (const key of allKeys) {
          const value1 = security1[key];
          const value2 = security2[key];

          if (JSON.stringify(value1) !== JSON.stringify(value2)) {
            comparison.differences.push({
              type: 'security_setting',
              setting: key,
              backup1Value: value1,
              backup2Value: value2
            });
            comparison.identical = false;
          }
        }
      }

      // Compare firewall rules
      const rules1 = backup1.firewall?.rules || [];
      const rules2 = backup2.firewall?.rules || [];

      if (rules1.length !== rules2.length) {
        comparison.differences.push({
          type: 'firewall_rules_count',
          backup1Value: rules1.length,
          backup2Value: rules2.length
        });
        comparison.identical = false;
      } else {
        // Compare individual rules
        for (let i = 0; i < rules1.length; i++) {
          const rule1 = rules1[i];
          const rule2 = rules2[i];

          if (JSON.stringify(rule1) !== JSON.stringify(rule2)) {
            comparison.differences.push({
              type: 'firewall_rule',
              ruleIndex: i,
              backup1Value: rule1,
              backup2Value: rule2
            });
            comparison.identical = false;
          }
        }
      }

      return comparison;

    } catch (error) {
      logger.error('Failed to compare backups:', error);
      throw error;
    }
  }

  // Merge multiple backups
  async mergeBackups(backupPaths, outputPath, options = {}) {
    try {
      const {
        description = 'Merged backup',
        conflictResolution = 'latest' // 'latest', 'manual'
      } = options;

      if (backupPaths.length < 2) {
        throw new Error('At least 2 backups are required for merging');
      }

      // Read all backups
      const backups = [];
      for (const backupPath of backupPaths) {
        const content = await fs.readFile(backupPath, 'utf8');
        const data = JSON.parse(content);
        backups.push({ path: backupPath, data });
      }

      // Start with the first backup as base
      const mergedBackup = JSON.parse(JSON.stringify(backups[0].data));

      // Update metadata
      mergedBackup.metadata = {
        backupId: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        backupAt: new Date().toISOString(),
        version: '1.0',
        type: 'merged',
        description,
        mergedFrom: backups.map(b => ({
          backupId: b.data.metadata?.backupId,
          backupAt: b.data.metadata?.backupAt,
          path: path.basename(b.path)
        })),
        conflictResolution
      };

      const conflicts = [];

      // Merge zone settings
      for (let i = 1; i < backups.length; i++) {
        const currentBackup = backups[i].data;

        if (currentBackup.settings?.zone) {
          for (const [key, value] of Object.entries(currentBackup.settings.zone)) {
            if (mergedBackup.settings.zone[key] &&
              JSON.stringify(mergedBackup.settings.zone[key]) !== JSON.stringify(value)) {

              conflicts.push({
                type: 'zone_setting',
                setting: key,
                values: backups.map(b => b.data.settings?.zone?.[key])
              });

              if (conflictResolution === 'latest') {
                mergedBackup.settings.zone[key] = value;
              }
            } else {
              mergedBackup.settings.zone[key] = value;
            }
          }
        }

        // Merge security settings
        if (currentBackup.settings?.security) {
          for (const [key, value] of Object.entries(currentBackup.settings.security)) {
            if (mergedBackup.settings.security[key] &&
              JSON.stringify(mergedBackup.settings.security[key]) !== JSON.stringify(value)) {

              conflicts.push({
                type: 'security_setting',
                setting: key,
                values: backups.map(b => b.data.settings?.security?.[key])
              });

              if (conflictResolution === 'latest') {
                mergedBackup.settings.security[key] = value;
              }
            } else {
              mergedBackup.settings.security[key] = value;
            }
          }
        }

        // Merge firewall rules (append unique rules)
        if (currentBackup.firewall?.rules) {
          const existingRules = mergedBackup.firewall.rules || [];

          for (const rule of currentBackup.firewall.rules) {
            const isDuplicate = existingRules.some(existingRule =>
              existingRule.expression === rule.expression &&
              existingRule.action === rule.action
            );

            if (!isDuplicate) {
              existingRules.push(rule);
            }
          }

          mergedBackup.firewall.rules = existingRules;
        }
      }

      // Save merged backup
      await fs.writeFile(outputPath, JSON.stringify(mergedBackup, null, 2));

      logger.info('Backups merged successfully', {
        inputBackups: backupPaths.length,
        outputPath,
        conflicts: conflicts.length
      });

      return {
        success: true,
        mergedBackupId: mergedBackup.metadata.backupId,
        outputPath,
        conflicts,
        mergedBackups: backups.length
      };

    } catch (error) {
      logger.error('Failed to merge backups:', error);
      throw error;
    }
  }

  // Schedule one-time backup
  async scheduleOneTimeBackup(userId, zoneId, scheduleTime, options = {}) {
    try {
      const {
        includeSecrets = false,
        description = 'Scheduled backup',
        type = 'scheduled'
      } = options;

      const scheduledDate = new Date(scheduleTime);

      if (scheduledDate <= new Date()) {
        throw new Error('Schedule time must be in the future');
      }

      const jobId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create cron expression for the specific time
      const cronExpression = `${scheduledDate.getMinutes()} ${scheduledDate.getHours()} ${scheduledDate.getDate()} ${scheduledDate.getMonth() + 1} *`;

      const scheduledJob = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Executing scheduled backup for zone ${zoneId}`, { userId, zoneId, jobId });

          await this.backupZoneConfig(userId, zoneId, {
            includeSecrets,
            description: `${description} (scheduled)`,
            type
          });

          // Remove job after execution
          scheduledJob.stop();
          this.scheduledJobs.delete(jobId);

          logger.info(`Scheduled backup completed for zone ${zoneId}`, { userId, zoneId, jobId });

        } catch (error) {
          logger.error(`Scheduled backup failed for zone ${zoneId}:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      this.scheduledJobs.set(jobId, scheduledJob);

      logger.info('One-time backup scheduled', {
        userId,
        zoneId,
        jobId,
        scheduleTime: scheduledDate.toISOString()
      });

      return {
        success: true,
        jobId,
        scheduledFor: scheduledDate.toISOString(),
        cronExpression
      };

    } catch (error) {
      logger.error('Failed to schedule one-time backup:', error);
      throw error;
    }
  }

  // Cancel scheduled backup
  cancelScheduledBackup(jobId) {
    try {
      const job = this.scheduledJobs.get(jobId);

      if (!job) {
        throw new Error('Scheduled job not found');
      }

      job.stop();
      this.scheduledJobs.delete(jobId);

      logger.info('Scheduled backup cancelled', { jobId });

      return { success: true, jobId };

    } catch (error) {
      logger.error('Failed to cancel scheduled backup:', error);
      throw error;
    }
  }

  // Get active scheduled jobs
  getScheduledJobs() {
    const jobs = [];

    for (const [jobId, job] of this.scheduledJobs) {
      jobs.push({
        jobId,
        running: job.running || false,
        destroyed: job.destroyed || false
      });
    }

    return jobs;
  }

  // Export backup as different formats
  async exportBackup(backupFilePath, format = 'json', outputPath = null) {
    try {
      const content = await fs.readFile(backupFilePath, 'utf8');
      const data = JSON.parse(content);

      let exportedContent;
      let extension;

      switch (format.toLowerCase()) {
        case 'yaml':
        case 'yml':
          const yaml = require('js-yaml');
          exportedContent = yaml.dump(data, { indent: 2 });
          extension = 'yml';
          break;

        case 'csv':
          exportedContent = this.convertBackupToCSV(data);
          extension = 'csv';
          break;

        case 'xml':
          exportedContent = this.convertBackupToXML(data);
          extension = 'xml';
          break;

        case 'json':
        default:
          exportedContent = JSON.stringify(data, null, 2);
          extension = 'json';
          break;
      }

      if (!outputPath) {
        const baseName = path.basename(backupFilePath, '.json');
        outputPath = path.join(path.dirname(backupFilePath), `${baseName}.${extension}`);
      }

      await fs.writeFile(outputPath, exportedContent);

      logger.info('Backup exported to different format', {
        originalPath: backupFilePath,
        outputPath,
        format
      });

      return {
        success: true,
        outputPath,
        format,
        size: Buffer.byteLength(exportedContent, 'utf8')
      };

    } catch (error) {
      logger.error('Failed to export backup:', error);
      throw error;
    }
  }

  // Convert backup to CSV format
  convertBackupToCSV(data) {
    const rows = [];

    // Header
    rows.push(['Type', 'Setting', 'Value', 'Description']);

    // Zone settings
    if (data.settings?.zone) {
      for (const [key, value] of Object.entries(data.settings.zone)) {
        rows.push(['Zone Setting', key, JSON.stringify(value), '']);
      }
    }

    // Security settings
    if (data.settings?.security) {
      for (const [key, value] of Object.entries(data.settings.security)) {
        rows.push(['Security Setting', key, JSON.stringify(value), '']);
      }
    }

    // Firewall rules
    if (data.firewall?.rules) {
      data.firewall.rules.forEach((rule, index) => {
        rows.push(['Firewall Rule', `Rule ${index + 1}`, rule.expression, rule.description || '']);
        rows.push(['Firewall Action', `Rule ${index + 1}`, rule.action, '']);
      });
    }

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  // Convert backup to XML format
  convertBackupToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<backup>\n';
    xml += '  <metadata>\n';
    xml += `    <backupId>${data.metadata?.backupId || ''}</backupId>\n`;
    xml += `    <backupAt>${data.metadata?.backupAt || ''}</backupAt>\n`;
    xml += `    <version>${data.metadata?.version || ''}</version>\n`;
    xml += '  </metadata>\n';

    xml += '  <zone>\n';
    xml += `    <id>${data.zone?.id || ''}</id>\n`;
    xml += `    <name>${data.zone?.name || ''}</name>\n`;
    xml += `    <status>${data.zone?.status || ''}</status>\n`;
    xml += '  </zone>\n';

    if (data.settings?.zone) {
      xml += '  <zoneSettings>\n';
      for (const [key, value] of Object.entries(data.settings.zone)) {
        xml += `    <setting name="${key}">${this.escapeXML(JSON.stringify(value))}</setting>\n`;
      }
      xml += '  </zoneSettings>\n';
    }

    if (data.settings?.security) {
      xml += '  <securitySettings>\n';
      for (const [key, value] of Object.entries(data.settings.security)) {
        xml += `    <setting name="${key}">${this.escapeXML(JSON.stringify(value))}</setting>\n`;
      }
      xml += '  </securitySettings>\n';
    }

    if (data.firewall?.rules) {
      xml += '  <firewallRules>\n';
      data.firewall.rules.forEach((rule, index) => {
        xml += `    <rule id="${index}">\n`;
        xml += `      <expression>${this.escapeXML(rule.expression)}</expression>\n`;
        xml += `      <action>${rule.action}</action>\n`;
        xml += `      <description>${this.escapeXML(rule.description || '')}</description>\n`;
        xml += '    </rule>\n';
      });
      xml += '  </firewallRules>\n';
    }

    xml += '</backup>';
    return xml;
  }

  // Escape XML special characters
  escapeXML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Health check for backup service
  async healthCheck() {
    const health = {
      status: 'healthy',
      checks: {
        initialized: false,
        backupDirectoryExists: false,
        scheduledJobsRunning: false,
        diskSpace: null
      },
      statistics: null,
      errors: []
    };

    try {
      // Check initialization
      health.checks.initialized = this.isInitialized;

      // Check backup directory
      try {
        await fs.access(this.backupDir);
        health.checks.backupDirectoryExists = true;
      } catch (error) {
        health.checks.backupDirectoryExists = false;
        health.errors.push('Backup directory not accessible');
      }

      // Check scheduled jobs
      health.checks.scheduledJobsRunning = this.scheduledJobs.size > 0;

      // Check disk space
      const stats = await fs.stat(this.backupDir);
      health.checks.diskSpace = {
        path: this.backupDir,
        accessible: true
      };

      // Get backup statistics
      health.statistics = await this.getBackupStatistics();

      if (health.errors.length > 0) {
        health.status = 'degraded';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.errors.push(error.message);
    }

    return health;
  }
}

module.exports = new BackupService();