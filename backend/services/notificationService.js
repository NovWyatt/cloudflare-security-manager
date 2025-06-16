const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmailTransporter();
  }

  // Khởi tạo email transporter
  initializeEmailTransporter() {
    try {
      if (process.env.EMAIL_SERVICE === 'smtp') {
        this.emailTransporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else if (process.env.EMAIL_SERVICE === 'gmail') {
        this.emailTransporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
      }

      if (this.emailTransporter) {
        logger.info('Email transporter initialized successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  // Gửi email thông báo bảo mật
  async sendSecurityAlert(user, alertData) {
    try {
      if (!this.emailTransporter) {
        logger.warn('Email transporter not configured, skipping email notification');
        return false;
      }

      const { zoneName, alertType, description, severity, timestamp } = alertData;

      const emailTemplate = this.getSecurityAlertTemplate({
        userName: user.username,
        zoneName,
        alertType,
        description,
        severity,
        timestamp
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cloudflare-security-manager.com',
        to: user.email,
        subject: `🚨 Security Alert: ${alertType} - ${zoneName}`,
        html: emailTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Security alert email sent to ${user.email}`, {
        userId: user.id,
        zoneName,
        alertType,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send security alert email:', error);
      return false;
    }
  }

  // Gửi thông báo Under Attack Mode
  async sendUnderAttackNotification(user, zoneData) {
    try {
      if (!this.emailTransporter) {
        return false;
      }

      const { zoneName, enabled, timestamp } = zoneData;

      const emailTemplate = this.getUnderAttackTemplate({
        userName: user.username,
        zoneName,
        enabled,
        timestamp
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cloudflare-security-manager.com',
        to: user.email,
        subject: `🛡️ Under Attack Mode ${enabled ? 'Enabled' : 'Disabled'} - ${zoneName}`,
        html: emailTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Under Attack notification sent to ${user.email}`, {
        userId: user.id,
        zoneName,
        enabled,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send under attack notification:', error);
      return false;
    }
  }

  // Gửi báo cáo hàng ngày
  async sendDailySummary(user, summaryData) {
    try {
      if (!this.emailTransporter) {
        return false;
      }

      const { date, zones, totalRequests, totalThreats, topCountries } = summaryData;

      const emailTemplate = this.getDailySummaryTemplate({
        userName: user.username,
        date,
        zones,
        totalRequests,
        totalThreats,
        topCountries
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cloudflare-security-manager.com',
        to: user.email,
        subject: `📊 Daily Security Summary - ${date}`,
        html: emailTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Daily summary sent to ${user.email}`, {
        userId: user.id,
        date,
        totalZones: zones.length,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send daily summary:', error);
      return false;
    }
  }

  // Gửi thông báo firewall rule triggered
  async sendFirewallAlert(user, firewallData) {
    try {
      if (!this.emailTransporter) {
        return false;
      }

      const { zoneName, ruleName, action, sourceIP, count, timestamp } = firewallData;

      const emailTemplate = this.getFirewallAlertTemplate({
        userName: user.username,
        zoneName,
        ruleName,
        action,
        sourceIP,
        count,
        timestamp
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cloudflare-security-manager.com',
        to: user.email,
        subject: `🔥 Firewall Alert: ${action.toUpperCase()} - ${zoneName}`,
        html: emailTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Firewall alert sent to ${user.email}`, {
        userId: user.id,
        zoneName,
        action,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send firewall alert:', error);
      return false;
    }
  }

  // Gửi thông báo SSL certificate
  async sendSSLCertificateNotification(user, sslData) {
    try {
      if (!this.emailTransporter) {
        return false;
      }

      const { zoneName, certificateStatus, expiryDate, daysUntilExpiry } = sslData;

      const emailTemplate = this.getSSLCertificateTemplate({
        userName: user.username,
        zoneName,
        certificateStatus,
        expiryDate,
        daysUntilExpiry
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cloudflare-security-manager.com',
        to: user.email,
        subject: `🔒 SSL Certificate ${certificateStatus} - ${zoneName}`,
        html: emailTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`SSL certificate notification sent to ${user.email}`, {
        userId: user.id,
        zoneName,
        certificateStatus,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SSL certificate notification:', error);
      return false;
    }
  }

  // Template cho security alert
  getSecurityAlertTemplate(data) {
    const { userName, zoneName, alertType, description, severity, timestamp } = data;

    const severityColor = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    }[severity] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Security Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚨 Security Alert</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid ${severityColor};">
            <h2 style="color: ${severityColor}; margin-top: 0;">Alert Details</h2>
            <p><strong>Hi ${userName},</strong></p>
            <p>A security event has been detected on your Cloudflare zone:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Zone:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${zoneName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Alert Type:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${alertType}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Severity:</td>
                <td style="padding: 8px; border: 1px solid #ddd; color: ${severityColor}; font-weight: bold;">${severity.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Time:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(timestamp).toLocaleString()}</td>
              </tr>
            </table>
            
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #495057;">Description:</h3>
              <p>${description}</p>
            </div>
            
            <p style="margin-top: 20px;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Dashboard
              </a>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6c757d;">
            <p>This is an automated message from Cloudflare Security Manager.<br>
            If you believe this is an error, please check your dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template cho Under Attack Mode notification
  getUnderAttackTemplate(data) {
    const { userName, zoneName, enabled, timestamp } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Under Attack Mode ${enabled ? 'Enabled' : 'Disabled'}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${enabled ? '#dc3545' : '#28a745'}; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🛡️ Under Attack Mode ${enabled ? 'Enabled' : 'Disabled'}</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px;">
            <p><strong>Hi ${userName},</strong></p>
            <p>Under Attack Mode has been <strong>${enabled ? 'enabled' : 'disabled'}</strong> for your zone:</p>
            
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid ${enabled ? '#dc3545' : '#28a745'};">
              <h3 style="margin-top: 0;">Zone: ${zoneName}</h3>
              <p>Time: ${new Date(timestamp).toLocaleString()}</p>
              
              ${enabled ? `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-top: 15px;">
                  <strong>⚠️ Important:</strong> Under Attack Mode will show a challenge page to all visitors. 
                  This may impact user experience but provides maximum protection against DDoS attacks.
                </div>
              ` : `
                <div style="background: #d1f2eb; border: 1px solid #a3e4d7; padding: 10px; border-radius: 4px; margin-top: 15px;">
                  <strong>✅ Normal Operation:</strong> Your website is now operating normally. 
                  Visitors will no longer see challenge pages.
                </div>
              `}
            </div>
            
            <p>
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/security/${zoneName}" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Manage Security Settings
              </a>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6c757d;">
            <p>Cloudflare Security Manager<br>Automated notification system</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template cho daily summary
  getDailySummaryTemplate(data) {
    const { userName, date, zones, totalRequests, totalThreats, topCountries } = data;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily Security Summary</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">📊 Daily Security Summary</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${date}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px;">
            <p><strong>Hi ${userName},</strong></p>
            <p>Here's your daily security summary for all your zones:</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
              <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center; border-left: 4px solid #007bff;">
                <h3 style="margin: 0; color: #007bff; font-size: 28px;">${totalRequests.toLocaleString()}</h3>
                <p style="margin: 5px 0 0 0; color: #6c757d;">Total Requests</p>
              </div>
              
              <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center; border-left: 4px solid #dc3545;">
                <h3 style="margin: 0; color: #dc3545; font-size: 28px;">${totalThreats.toLocaleString()}</h3>
                <p style="margin: 5px 0 0 0; color: #6c757d;">Threats Blocked</p>
              </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Zone Performance</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">Zone</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">Requests</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">Threats</th>
                  </tr>
                </thead>
                <tbody>
                  ${zones.map(zone => `
                    <tr>
                      <td style="padding: 12px; border: 1px solid #dee2e6;">${zone.name}</td>
                      <td style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">${zone.requests.toLocaleString()}</td>
                      <td style="padding: 12px; text-align: center; border: 1px solid #dee2e6; color: ${zone.threats > 0 ? '#dc3545' : '#28a745'};">${zone.threats.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            ${topCountries && topCountries.length > 0 ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #495057;">Top Visitor Countries</h3>
                <ol style="padding-left: 20px;">
                  ${topCountries.slice(0, 5).map(country => `
                    <li style="margin-bottom: 5px;">${country.country}: ${country.requests.toLocaleString()} requests</li>
                  `).join('')}
                </ol>
              </div>
            ` : ''}
            
            <p style="margin-top: 30px;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/analytics" 
                 style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Detailed Analytics
              </a>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6c757d;">
            <p>Cloudflare Security Manager - Daily Report<br>
            <a href="${process.env.APP_URL}/settings" style="color: #6c757d;">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template cho firewall alert
  getFirewallAlertTemplate(data) {
    const { userName, zoneName, ruleName, action, sourceIP, count, timestamp } = data;

    const actionColor = {
      block: '#dc3545',
      challenge: '#ffc107',
      allow: '#28a745',
      js_challenge: '#fd7e14'
    }[action] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Firewall Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${actionColor}; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🔥 Firewall Alert</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px;">
            <p><strong>Hi ${userName},</strong></p>
            <p>A firewall rule has been triggered on your zone:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${actionColor};">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold; width: 30%;">Zone:</td>
                  <td style="padding: 8px 12px;">${zoneName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Rule:</td>
                  <td style="padding: 8px 12px;">${ruleName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Action:</td>
                  <td style="padding: 8px 12px; color: ${actionColor}; font-weight: bold;">${action.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Source IP:</td>
                  <td style="padding: 8px 12px; font-family: monospace;">${sourceIP}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Triggers:</td>
                  <td style="padding: 8px 12px;">${count} times</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Time:</td>
                  <td style="padding: 8px 12px;">${new Date(timestamp).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>💡 Recommendation:</strong> Review your firewall logs to ensure this activity is expected. 
              Consider adjusting rules if needed.
            </div>
            
            <p>
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/security/${zoneName}/firewall" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
                View Firewall Rules
              </a>
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/analytics/${zoneName}" 
                 style="background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Analytics
              </a>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6c757d;">
            <p>Cloudflare Security Manager - Firewall Monitoring</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template cho SSL certificate notification
  getSSLCertificateTemplate(data) {
    const { userName, zoneName, certificateStatus, expiryDate, daysUntilExpiry } = data;

    const statusColor = {
      'expiring_soon': '#ffc107',
      'expired': '#dc3545',
      'renewed': '#28a745',
      'issued': '#17a2b8'
    }[certificateStatus] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SSL Certificate ${certificateStatus}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🔒 SSL Certificate ${certificateStatus.replace('_', ' ').toUpperCase()}</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px;">
            <p><strong>Hi ${userName},</strong></p>
            
            ${certificateStatus === 'expiring_soon' ? `
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>⚠️ Action Required:</strong> Your SSL certificate for <strong>${zoneName}</strong> will expire in ${daysUntilExpiry} days.
              </div>
            ` : certificateStatus === 'expired' ? `
              <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>🚨 Urgent:</strong> Your SSL certificate for <strong>${zoneName}</strong> has expired!
              </div>
            ` : certificateStatus === 'renewed' ? `
              <div style="background: #d1f2eb; border: 1px solid #a3e4d7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>✅ Good News:</strong> Your SSL certificate for <strong>${zoneName}</strong> has been renewed successfully.
              </div>
            ` : `
              <div style="background: #d6f5ff; border: 1px solid #b8e6ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>ℹ️ Information:</strong> SSL certificate status update for <strong>${zoneName}</strong>.
              </div>
            `}
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Certificate Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold; width: 30%;">Zone:</td>
                  <td style="padding: 8px 12px;">${zoneName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold;">Status:</td>
                  <td style="padding: 8px 12px; color: ${statusColor}; font-weight: bold;">${certificateStatus.replace('_', ' ').toUpperCase()}</td>
                </tr>
                ${expiryDate ? `
                  <tr>
                    <td style="padding: 8px 12px; font-weight: bold;">Expiry Date:</td>
                    <td style="padding: 8px 12px;">${new Date(expiryDate).toLocaleDateString()}</td>
                  </tr>
                ` : ''}
                ${daysUntilExpiry !== undefined ? `
                  <tr>
                    <td style="padding: 8px 12px; font-weight: bold;">Days Until Expiry:</td>
                    <td style="padding: 8px 12px; color: ${daysUntilExpiry <= 7 ? '#dc3545' : daysUntilExpiry <= 30 ? '#ffc107' : '#28a745'}; font-weight: bold;">${daysUntilExpiry}</td>
                  </tr>
                ` : ''}
              </table>
            </div>
            
            ${certificateStatus === 'expiring_soon' || certificateStatus === 'expired' ? `
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #495057;">Recommended Actions:</h4>
                <ul>
                  <li>Check your SSL/TLS settings in Cloudflare dashboard</li>
                  <li>Ensure your origin server certificate is valid</li>
                  <li>Consider enabling automatic certificate renewal</li>
                  <li>Contact support if you need assistance</li>
                </ul>
              </div>
            ` : ''}
            
            <p>
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/security/${zoneName}/ssl" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Manage SSL Settings
              </a>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6c757d;">
            <p>Cloudflare Security Manager - SSL Monitoring</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Gửi thông báo webhook (cho tích hợp với Slack, Discord, etc.)
  async sendWebhookNotification(webhookUrl, data) {
    try {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        logger.info('Webhook notification sent successfully', { webhookUrl });
        return true;
      } else {
        logger.error('Failed to send webhook notification', {
          webhookUrl,
          status: response.status,
          statusText: response.statusText
        });
        return false;
      }
    } catch (error) {
      logger.error('Webhook notification error:', error);
      return false;
    }
  }

  // Gửi thông báo Slack
  async sendSlackNotification(webhookUrl, alertData) {
    const { zoneName, alertType, severity, description } = alertData;

    const color = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    }[severity] || '#gray';

    const slackPayload = {
      username: 'Cloudflare Security Manager',
      icon_emoji: ':shield:',
      attachments: [{
        color: color,
        title: `🚨 Security Alert: ${alertType}`,
        fields: [
          {
            title: 'Zone',
            value: zoneName,
            short: true
          },
          {
            title: 'Severity',
            value: severity.toUpperCase(),
            short: true
          },
          {
            title: 'Description',
            value: description,
            short: false
          }
        ],
        footer: 'Cloudflare Security Manager',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    return this.sendWebhookNotification(webhookUrl, slackPayload);
  }

  // Gửi thông báo Discord
  async sendDiscordNotification(webhookUrl, alertData) {
    const { zoneName, alertType, severity, description } = alertData;

    const color = {
      low: 0x28a745,
      medium: 0xffc107,
      high: 0xfd7e14,
      critical: 0xdc3545
    }[severity] || 0x6c757d;

    const discordPayload = {
      username: 'Cloudflare Security Manager',
      avatar_url: 'https://img.icons8.com/color/96/000000/security-checked.png',
      embeds: [{
        title: `🚨 Security Alert: ${alertType}`,
        description: description,
        color: color,
        fields: [
          {
            name: 'Zone',
            value: zoneName,
            inline: true
          },
          {
            name: 'Severity',
            value: severity.toUpperCase(),
            inline: true
          }
        ],
        footer: {
          text: 'Cloudflare Security Manager'
        },
        timestamp: new Date().toISOString()
      }]
    };

    return this.sendWebhookNotification(webhookUrl, discordPayload);
  }

  // Gửi thông báo push notification (web push)
  async sendPushNotification(user, notificationData) {
    try {
      // Này sẽ cần web push library như web-push
      // Hiện tại chỉ log để future implementation
      logger.info('Push notification would be sent', {
        userId: user.id,
        notification: notificationData
      });

      return true;
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return false;
    }
  }

  // Gửi SMS notification (sử dụng Twilio hoặc AWS SNS)
  async sendSMSNotification(phoneNumber, message) {
    try {
      // Future implementation với Twilio hoặc AWS SNS
      logger.info('SMS notification would be sent', {
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        messageLength: message.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SMS notification:', error);
      return false;
    }
  }

  // Gửi notification tổng hợp cho user
  async sendNotification(user, notificationData, channels = ['email']) {
    const results = {
      email: false,
      slack: false,
      discord: false,
      webhook: false,
      push: false,
      sms: false
    };

    try {
      // Email notification
      if (channels.includes('email')) {
        switch (notificationData.type) {
          case 'security_alert':
            results.email = await this.sendSecurityAlert(user, notificationData);
            break;
          case 'under_attack':
            results.email = await this.sendUnderAttackNotification(user, notificationData);
            break;
          case 'firewall_alert':
            results.email = await this.sendFirewallAlert(user, notificationData);
            break;
          case 'ssl_certificate':
            results.email = await this.sendSSLCertificateNotification(user, notificationData);
            break;
          case 'daily_summary':
            results.email = await this.sendDailySummary(user, notificationData);
            break;
          default:
            logger.warn(`Unknown notification type: ${notificationData.type}`);
        }
      }

      // Slack notification
      if (channels.includes('slack') && user.slackWebhook) {
        results.slack = await this.sendSlackNotification(user.slackWebhook, notificationData);
      }

      // Discord notification
      if (channels.includes('discord') && user.discordWebhook) {
        results.discord = await this.sendDiscordNotification(user.discordWebhook, notificationData);
      }

      // Custom webhook
      if (channels.includes('webhook') && user.webhookUrl) {
        results.webhook = await this.sendWebhookNotification(user.webhookUrl, {
          type: notificationData.type,
          user: {
            id: user.id,
            username: user.username
          },
          data: notificationData,
          timestamp: new Date().toISOString()
        });
      }

      // Push notification
      if (channels.includes('push')) {
        results.push = await this.sendPushNotification(user, notificationData);
      }

      // SMS notification
      if (channels.includes('sms') && user.phoneNumber) {
        const smsMessage = this.formatSMSMessage(notificationData);
        results.sms = await this.sendSMSNotification(user.phoneNumber, smsMessage);
      }

      logger.info('Notification sent through multiple channels', {
        userId: user.id,
        type: notificationData.type,
        channels: channels,
        results: results
      });

      return results;

    } catch (error) {
      logger.error('Failed to send notification:', error);
      return results;
    }
  }

  // Format SMS message
  formatSMSMessage(data) {
    switch (data.type) {
      case 'security_alert':
        return `🚨 Security Alert: ${data.alertType} detected on ${data.zoneName}. Severity: ${data.severity.toUpperCase()}. Check your dashboard for details.`;

      case 'under_attack':
        return `🛡️ Under Attack Mode ${data.enabled ? 'ENABLED' : 'DISABLED'} for ${data.zoneName}. ${data.enabled ? 'Your site is now protected against DDoS attacks.' : 'Normal operations resumed.'}`;

      case 'firewall_alert':
        return `🔥 Firewall Alert: ${data.action.toUpperCase()} action triggered on ${data.zoneName}. Rule: ${data.ruleName}. Source: ${data.sourceIP}`;

      case 'ssl_certificate':
        return `🔒 SSL Certificate ${data.certificateStatus} for ${data.zoneName}. ${data.daysUntilExpiry ? `Expires in ${data.daysUntilExpiry} days.` : ''} Check dashboard.`;

      default:
        return `Cloudflare Security Manager: New ${data.type} notification. Check your dashboard for details.`;
    }
  }

  // Kiểm tra và gửi thông báo dựa trên user preferences
  async sendNotificationWithPreferences(user, notificationData) {
    try {
      // Lấy user settings (giả sử có bảng user_settings)
      const userSettings = user.settings || {
        emailNotifications: true,
        slackNotifications: false,
        discordNotifications: false,
        pushNotifications: true,
        smsNotifications: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };

      // Kiểm tra quiet hours
      if (userSettings.quietHoursEnabled && this.isQuietHours(userSettings)) {
        // Chỉ gửi critical notifications trong quiet hours
        if (notificationData.severity !== 'critical') {
          logger.info('Notification delayed due to quiet hours', {
            userId: user.id,
            type: notificationData.type,
            severity: notificationData.severity
          });
          return { delayed: true, reason: 'quiet_hours' };
        }
      }

      // Xác định channels để gửi
      const channels = [];
      if (userSettings.emailNotifications) channels.push('email');
      if (userSettings.slackNotifications) channels.push('slack');
      if (userSettings.discordNotifications) channels.push('discord');
      if (userSettings.pushNotifications) channels.push('push');
      if (userSettings.smsNotifications) channels.push('sms');
      if (userSettings.webhookEnabled) channels.push('webhook');

      if (channels.length === 0) {
        logger.info('No notification channels enabled for user', { userId: user.id });
        return { sent: false, reason: 'no_channels_enabled' };
      }

      return await this.sendNotification(user, notificationData, channels);

    } catch (error) {
      logger.error('Failed to send notification with preferences:', error);
      return { error: error.message };
    }
  }

  // Kiểm tra xem có phải quiet hours không
  isQuietHours(userSettings) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = userSettings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = userSettings.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle quiet hours that span midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  // Test email configuration
  async testEmailConfiguration() {
    try {
      if (!this.emailTransporter) {
        return { success: false, error: 'Email transporter not configured' };
      }

      const testResult = await this.emailTransporter.verify();

      if (testResult) {
        logger.info('Email configuration test successful');
        return { success: true, message: 'Email configuration is working correctly' };
      } else {
        logger.error('Email configuration test failed');
        return { success: false, error: 'Email configuration verification failed' };
      }
    } catch (error) {
      logger.error('Email configuration test error:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi test notification
  async sendTestNotification(user, type = 'security_alert') {
    const testData = {
      security_alert: {
        type: 'security_alert',
        zoneName: 'example.com',
        alertType: 'Test Security Alert',
        description: 'This is a test security alert to verify your notification settings.',
        severity: 'medium',
        timestamp: new Date().toISOString()
      },
      under_attack: {
        type: 'under_attack',
        zoneName: 'example.com',
        enabled: true,
        timestamp: new Date().toISOString()
      },
      ssl_certificate: {
        type: 'ssl_certificate',
        zoneName: 'example.com',
        certificateStatus: 'expiring_soon',
        daysUntilExpiry: 15,
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    const notificationData = testData[type] || testData.security_alert;

    try {
      const result = await this.sendNotificationWithPreferences(user, notificationData);

      logger.info('Test notification sent', {
        userId: user.id,
        type: type,
        result: result
      });

      return result;
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();