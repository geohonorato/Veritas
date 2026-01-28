const nodemailer = require('nodemailer');
const db = require('../database');
const path = require('path');
const fs = require('fs');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isReady = false;
    }

    async initialize() {
        try {
            const settings = db.getSettings();
            console.log('[EmailService] Inicializando. Modo:', settings.email_mode || 'legacy');

            if (settings.email_mode === 'oauth2') {
                if (!settings.oauth_user || !settings.oauth_client_id || !settings.oauth_client_secret || !settings.oauth_refresh_token) {
                    console.warn('[EmailService] Credenciais OAuth2 incompletas.');
                    this.isReady = false;
                    return;
                }

                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        type: 'OAuth2',
                        user: settings.oauth_user,
                        clientId: settings.oauth_client_id,
                        clientSecret: settings.oauth_client_secret,
                        refreshToken: settings.oauth_refresh_token,
                        accessToken: settings.oauth_access_token,
                    },
                });
                console.log(`[EmailService] Configurado via OAuth2 (User: ${settings.oauth_user})`);

            } else {
                // Fallback SMTP
                if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
                    console.warn('[EmailService] Configurações SMTP ausentes. Serviço de email desativado.');
                    this.isReady = false;
                    return;
                }

                this.transporter = nodemailer.createTransport({
                    host: settings.smtp_host,
                    port: settings.smtp_port || 587,
                    secure: settings.smtp_secure === 'true',
                    auth: {
                        user: settings.smtp_user,
                        pass: settings.smtp_pass,
                    },
                });
                console.log('[EmailService] Configurado via SMTP Tradicional.');
            }

            // Verifica conexão
            await this.transporter.verify();
            console.log('[EmailService] Conexão Testada e Aprovada! ✅');
            this.isReady = true;

        } catch (error) {
            console.error('[EmailService] Erro ao conectar:', error.message);
            this.isReady = false;
        }
    }

    async sendPointNotification(user, activity) {
        // Tenta reinicializar se não estiver pronto (caso configurações tenham sido salvas depois)
        if (!this.isReady) await this.initialize();

        if (!this.isReady) {
            console.log('[EmailService] Email não enviado (Serviço não configurado).');
            return null;
        }

        if (!user.email) {
            console.log(`[EmailService] Usuário ${user.nome} sem email cadastrado.`);
            return null;
        }

        const settings = db.getSettings();
        const fromEmail = settings.oauth_user || settings.smtp_user || 'no-reply@cesupa.br';

        // Prepare logo using CID for better email client support
        let logoAttachment = null;
        let logoSrc = null;

        try {
            const possiblePaths = [
                path.join(__dirname, '../../public/images/logo.png'),
                path.join(process.cwd(), 'public', 'images', 'logo.png'),
                path.join(process.cwd(), 'desktop-app', 'public', 'images', 'logo.png')
            ];

            const logoPath = possiblePaths.find(p => fs.existsSync(p));

            if (logoPath) {
                 logoAttachment = {
                     filename: 'logo.png',
                     path: logoPath,
                     cid: 'logo_veritas_cid' // Unique identifier
                 };
                 logoSrc = 'cid:logo_veritas_cid';
            } else {
                 console.warn('[EmailService] Logo não encontrado nos caminhos:', possiblePaths);
            }
        } catch(e) { console.error('Error preparing logo:', e); }

        const history = db.getLastSemesterActivities(user.id);
        const html = this._generateHtmlTemplate(user, activity, history, logoSrc);

        const mailOptions = {
            from: `"Cesupa NPJ" <${fromEmail}>`,
            to: user.email,
            subject: `✔ Ponto Registrado: ${activity.type} - ${new Date().toLocaleDateString('pt-BR')}`,
            html: html,
            attachments: logoAttachment ? [logoAttachment] : []
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[EmailService] Email enviado para ${user.email}: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error('[EmailService] Erro ao enviar email:', error);
            return null;
        }
    }

    _generateHtmlTemplate(user, activity, history, logoSrc) {
        const date = new Date(activity.timestamp);
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

        // --- THEME CONFIGURATION ---
        const theme = {
            mainColor: '#232856',       // User requested color (used for hero background)
            bgColor: '#000000',         // True Black Background for "Dark Mode" depth
            cardColor: '#101012',       // Very Dark Zinc for Card
            innerCardColor: '#232856',  // The requested color as the Feature Box
            textColor: '#ffffff',       // White Text
            mutedText: '#a1a1aa',       // Zinc 400
            borderColor: '#27272a',     // Zinc 800
            
            // Accents
            entradaColor: '#34d399',    // Emerald 400
            saidaColor: '#f472b6',      // Pink 400
            gradientStart: '#232856',   // Blue content
            gradientEnd: '#4f46e5',     // Indigo
        };

        const isEntrada = activity.type.toUpperCase() === 'ENTRADA' || activity.type.toUpperCase() === 'ENTRADA';
        const statusColor = isEntrada ? theme.entradaColor : theme.saidaColor;
        const statusLabel = isEntrada ? 'ENTRADA REGISTRADA' : 'SAÍDA REGISTRADA';
        
        // Logo HTML
        const logoImg = logoSrc 
            ? `<img src="${logoSrc}" alt="Sistema de Presença NPJ" width="180" style="display: block; border: 0; width: 180px; height: auto; margin: 0 auto;">` 
            : `<div style="font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -1px;">SISTEMA DE <span style="color: #6366f1;">PRESENÇA</span></div>`;

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comprovante de Ponto</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.bgColor}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
    
    <!-- Outer Container -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${theme.bgColor};">
        <tr>
            <td align="center" style="padding: 40px 10px;">
            
                <!-- Content Card -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: ${theme.cardColor}; border: 1px solid ${theme.borderColor}; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    
                    <!-- Top Stripe (Accent) -->
                    <tr>
                        <td height="4" style="background-color: ${theme.mainColor};"></td>
                    </tr>

                    <!-- Header Section -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 30px;">
                            ${logoImg}
                        </td>
                    </tr>

                    <!-- Main Status Section (Hero) -->
                    <tr>
                        <td align="center" style="padding: 0 40px 40px;">
                            <!-- The distinct color block requested -->
                            <div style="background-color: ${theme.innerCardColor}; border-radius: 16px; padding: 32px 20px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);">
                                <p style="margin: 0 0 16px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">
                                    ${statusLabel}
                                </p>
                                <h2 style="margin: 0; font-size: 52px; font-weight: 700; color: #ffffff; letter-spacing: -2px; line-height: 1;">
                                    ${timeStr}
                                </h2>
                                <div style="width: 40px; height: 4px; background-color: ${statusColor}; margin: 20px auto; border-radius: 2px;"></div>
                                <p style="margin: 0; font-size: 15px; color: #fff; font-weight: 500; opacity: 0.8;">
                                    ${capitalizedDay}, ${dateStr}
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Details Section -->
                    <tr>
                        <td style="padding: 0 40px 40px;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding-bottom: 16px; border-bottom: 1px solid ${theme.borderColor};">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="color: ${theme.mutedText}; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">ALUNO</td>
                                                <td align="right" style="color: ${theme.textColor}; font-size: 14px; font-weight: 500;">${user.nome}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px 0; border-bottom: 1px solid ${theme.borderColor};">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="color: ${theme.mutedText}; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">MATRÍCULA</td>
                                                <td align="right" style="color: ${theme.textColor}; font-size: 14px; font-weight: 500; font-family: 'Courier New', monospace;">${user.matricula || '---'}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px 0 0;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="color: ${theme.mutedText}; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">LOCALIZAÇÃO</td>
                                                <td align="right" style="color: ${theme.textColor}; font-size: 14px; font-weight: 500;">NPJ/Cesupa</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #0d0d0f; padding: 24px;">
                            <p style="margin: 0; font-size: 11px; color: ${theme.mutedText}; line-height: 1.6;">
                                <strong>Veritas System</strong> • Controle de Frequência Digital
                            </p>
                        </td>
                    </tr>
                    
                </table>

                <!-- Copyright -->
                <p style="margin-top: 30px; font-size: 11px; color: #52525b; text-align: center;">
                    Não responda a este e-mail.
                </p>

            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
}

module.exports = new EmailService();
