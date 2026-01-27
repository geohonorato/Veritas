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

        // Prepare Logo (Base64)
        let logoBase64 = '';
        try {
            // Tentativa robusta de encontrar o logo
            const possiblePaths = [
                path.join(__dirname, '../../public/images/logo.png'),
                path.join(process.cwd(), 'public', 'images', 'logo.png'),
                path.join(process.cwd(), 'desktop-app', 'public', 'images', 'logo.png')
            ];

            let logoPath = possiblePaths.find(p => fs.existsSync(p));

            if (logoPath) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            } else {
                console.warn('[EmailService] Logo não encontrado em nenhum dos caminhos:', possiblePaths);
            }
        } catch(e) { console.error('Error preparing logo:', e); }

        const history = db.getLastSemesterActivities(user.id);
        const html = this._generateHtmlTemplate(user, activity, history, logoBase64);

        const mailOptions = {
            from: `"Veritas System" <${fromEmail}>`,
            to: user.email,
            subject: `Registro de Ponto - ${activity.type} - ${new Date().toLocaleDateString('pt-BR')}`,
            html: html
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

    _generateHtmlTemplate(user, activity, history, logoBase64) {
        const date = new Date(activity.timestamp);
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

        const isEntrada = activity.type.toUpperCase() === 'ENTRADA';
        
        // Cores do Projeto (Baseadas no Layout do Login/Referência)
        const colors = {
            primary: isEntrada ? '#10b981' : '#f43f5e', // Emerald (Entrada) / Rose (Saída)
            primaryBg: isEntrada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            primaryBorder: isEntrada ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            background: '#09090b', // Zinc 950 (Fundo Geral)
            surface: '#18181b',    // Zinc 900 (Card)
            border: '#27272a',     // Zinc 800
            textMain: '#fafafa',   // Zinc 50
            textMuted: '#a1a1aa',  // Zinc 400
            divider: '#27272a'     // Zinc 800 dashed
        };

        const statusLabel = isEntrada ? 'ENTRADA' : 'SAÍDA';
        const docTitle = isEntrada ? 'Comprovante de Entrada' : 'Comprovante de Saída';

        // Logo Centralizada e Tratada para Dark Mode
        // filter: brightness(0) invert(1) garante que o logo fique BRANCO sobre o fundo escuro
        const logoImg = logoBase64 
            ? `<img src="${logoBase64}" alt="Veritas" height="48" style="display: block; border: 0; height: 48px; width: auto; margin: 0 auto; filter: brightness(0) invert(1);">` 
            : `<span style="font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -1px;">VERITAS</span>`;

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${docTitle}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; color: ${colors.textMain};">
    
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.background}; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 15px;">
                
                <!-- Main Card -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 400px; width: 100%; background-color: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); overflow: hidden; position: relative;">
                    
                    <!-- Top Gradient Decoration -->
                    <tr>
                        <td height="4" style="background: linear-gradient(90deg, #27272a 0%, #71717a 50%, #27272a 100%); opacity: 0.2; line-height: 0; font-size: 0;">&nbsp;</td>
                    </tr>

                    <!-- Header (Logo + Title) -->
                    <tr>
                        <td align="center" style="padding: 32px 32px 24px; border-bottom: 1px dashed ${colors.border};">
                            <!-- Logo Centered -->
                            <div style="margin-bottom: 20px; text-align: center;">
                                ${logoImg}
                            </div>
                            <!-- Title -->
                            <h1 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: ${colors.textMain}; text-transform: uppercase; letter-spacing: 0.05em;">Registro Confirmado</h1>
                            <p style="margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: ${colors.textMuted};">Sistema de Ponto Eletrônico</p>
                        </td>
                    </tr>

                    <!-- Main Highlight Area -->
                    <tr>
                        <td align="center" style="padding: 32px; background-color: rgba(255, 255, 255, 0.02);">
                            
                            <!-- Status Pill -->
                            <div style="display: inline-block; padding: 6px 16px; background-color: ${colors.primaryBg}; border: 1px solid ${colors.primaryBorder}; border-radius: 99px; margin-bottom: 20px;">
                                <span style="font-size: 11px; font-weight: 700; color: ${colors.primary}; letter-spacing: 0.15em; text-transform: uppercase;">
                                    ${statusLabel}
                                </span>
                            </div>

                            <!-- Clock -->
                            <h2 style="margin: 0 0 8px; font-size: 56px; font-weight: 300; line-height: 1; color: ${colors.textMain}; letter-spacing: -2px; font-feature-settings: 'tnum';">
                                ${timeStr}
                            </h2>
                            
                            <!-- Date -->
                            <p style="margin: 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
                                ${capitalizedDay}, ${dateStr}
                            </p>
                        </td>
                    </tr>

                    <!-- Data List -->
                    <tr>
                        <td style="padding: 8px 32px 32px;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                
                                <!-- Aluno Row -->
                                <tr>
                                    <td style="padding: 16px 0; border-bottom: 1px dashed ${colors.border};">
                                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="left" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.textMuted}; font-weight: 600;">Aluno</td>
                                                <td align="right" style="font-size: 13px; font-weight: 500; color: ${colors.textMain};">${user.nome}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Matrícula Row -->
                                <tr>
                                    <td style="padding: 16px 0; border-bottom: 1px dashed ${colors.border};">
                                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="left" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.textMuted}; font-weight: 600;">Matrícula</td>
                                                <td align="right" style="font-size: 13px; font-weight: 500; color: ${colors.textMain}; font-family: monospace, monospace;">
                                                    ${user.matricula || 'N/A'}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Local Row -->
                                <tr>
                                    <td style="padding: 16px 0; border-bottom: 1px dashed ${colors.border};">
                                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="left" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.textMuted}; font-weight: 600;">Local</td>
                                                <td align="right" style="font-size: 13px; font-weight: 500; color: ${colors.textMain};">NPJ Cesupa</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Auth Hash -->
                                <tr>
                                    <td style="padding: 16px 0 0;">
                                        <p style="margin: 0 0 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.textMuted};">Autenticação Digital</p>
                                        <p style="margin: 0; font-size: 10px; font-family: 'Courier New', monospace; color: #52525b; word-break: break-all; line-height: 1.4;">
                                            ${activity.auth_hash || '---'}
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 16px; background-color: #1a1a1d; border-top: 1px solid ${colors.border};">
                            <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center">
                                        <span style="font-size: 11px; color: ${colors.textMuted}; font-weight: 500;">
                                            Comprovante Digital Veritas
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
                
                <!-- Silent Legal Text -->
                <div style="margin-top: 32px; text-align: center; max-width: 300px; margin-left: auto; margin-right: auto;">
                    <p style="font-size: 10px; color: #52525b; line-height: 1.6;">
                        Este documento possui validade jurídica para fins de controle de frequência do NPJ/Cesupa. 
                        <br>Sistema Veritas © 2026
                    </p>
                </div>

            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
}

module.exports = new EmailService();
