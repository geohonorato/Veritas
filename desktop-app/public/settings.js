// settings.js - Clean Settings Page Logic
// Handles Email Configuration, OAuth, and SMTP Settings

(function () {
    'use strict';

    // --- DOM Elements ---
    const emailModeSelect = document.getElementById('email-mode-select');
    const oauthFields = document.getElementById('oauth-fields');
    const smtpFields = document.getElementById('smtp-fields');
    const connectGoogleBtn = document.getElementById('connect-google-btn');
    const oauthStatus = document.getElementById('oauth-status');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // SMTP Inputs
    const smtpHost = document.getElementById('smtp-host');
    const smtpPort = document.getElementById('smtp-port');
    const smtpUser = document.getElementById('smtp-user');
    const smtpPass = document.getElementById('smtp-pass');
    const smtpSecure = document.getElementById('smtp-secure');
    const testEmailBtn = document.getElementById('test-email-btn'); // NOVO
    const emailTestStatus = document.getElementById('email-test-status'); // NOVO STATUS

    // Knowledge Path Input
    const knowledgePathInput = document.getElementById('knowledge-path-input');

    // --- Toggle Email Mode ---
    function toggleEmailMode() {
        if (!emailModeSelect) return;

        const mode = emailModeSelect.value;
        if (mode === 'oauth2') {
            if (oauthFields) oauthFields.classList.remove('hidden');
            if (smtpFields) smtpFields.classList.add('hidden');
        } else {
            if (oauthFields) oauthFields.classList.add('hidden');
            if (smtpFields) smtpFields.classList.remove('hidden');
        }
    }

    // --- Load Settings from Server ---
    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            console.log('[Settings] Carregado:', settings);

            // Email Mode
            if (emailModeSelect && settings.email_mode) {
                emailModeSelect.value = settings.email_mode;
                toggleEmailMode();
            }

            // OAuth Status
            if (settings.oauth_user) {
                if (oauthStatus) {
                    oauthStatus.textContent = `Conectado: ${settings.oauth_user}`;
                    oauthStatus.classList.remove('text-white');
                    oauthStatus.classList.add('text-emerald-400');
                }
                if (connectGoogleBtn) {
                    connectGoogleBtn.textContent = 'Reconectar Conta';
                }
            } else {
                if (oauthStatus) {
                    oauthStatus.textContent = 'Não Conectado';
                    oauthStatus.classList.remove('text-emerald-400');
                    oauthStatus.classList.add('text-white');
                }
            }

            // SMTP
            if (smtpHost && settings.smtp_host) smtpHost.value = settings.smtp_host;
            if (smtpPort && settings.smtp_port) smtpPort.value = settings.smtp_port;
            if (smtpUser && settings.smtp_user) smtpUser.value = settings.smtp_user;
            if (smtpSecure && settings.smtp_secure === 'true') smtpSecure.checked = true;

        } catch (err) {
            console.error('[Settings] Erro ao carregar:', err);
        }
    }

    // --- Connect Google Account ---
    async function connectGoogleOAuth() {
        console.log('[OAuth] Botão clicado - Iniciando fluxo...');

        if (connectGoogleBtn) {
            connectGoogleBtn.disabled = true;
            connectGoogleBtn.textContent = 'Conectando...';
        }

        try {
            const user = sessionStorage.getItem('veritas_user') || 'admin';
            const res = await fetch('/api/auth/google/url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-User': user
                },
                body: JSON.stringify({}) // Server uses stored credentials
            });

            console.log('[OAuth] Response status:', res.status);

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Falha na requisição');
            }

            const data = await res.json();
            console.log('[OAuth] URL recebida:', data.url ? 'SIM' : 'NÃO');

            if (data.url) {
                // Redirect to Google consent screen
                window.location.href = data.url;
            } else {
                throw new Error('URL de autenticação não recebida');
            }

        } catch (err) {
            console.error('[OAuth] Erro:', err);
            showStatus(oauthStatus, 'Erro ao conectar: ' + err.message, 'error');
        } finally {
            if (connectGoogleBtn) {
                connectGoogleBtn.disabled = false;
                connectGoogleBtn.textContent = 'Conectar Conta Google';
            }
        }
    }

    // --- Helper for Status ---
    function showStatus(element, message, type = 'normal') {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('hidden', 'text-green-400', 'text-red-400', 'text-zinc-500', 'text-emerald-400');
        
        if (type === 'success') element.classList.add('text-emerald-400');
        else if (type === 'error') element.classList.add('text-red-400');
        else element.classList.add('text-zinc-500');

        // Auto clear after 5s
        if (type !== 'normal') {
            setTimeout(() => {
                element.textContent = '';
            }, 5000);
        }
    }

    // --- Save SMTP Settings ---
    async function saveSMTPSettings() {
        const data = {
            email_mode: emailModeSelect ? emailModeSelect.value : 'smtp',
            smtp_host: smtpHost ? smtpHost.value : '',
            smtp_port: smtpPort ? smtpPort.value : '',
            smtp_user: smtpUser ? smtpUser.value : '',
            smtp_pass: smtpPass ? smtpPass.value : '',
            smtp_secure: smtpSecure ? smtpSecure.checked.toString() : 'false'
        };

        try {
            const user = sessionStorage.getItem('veritas_user') || 'admin';
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-User': user
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                // Se tivesse um elemento de status para o botão de salvar, usaríamos aqui.
                // Como não tem específico, vamos criar um alert customizado ou usar o console por enquanto
                // Ou melhor, vamos reusar o status do email de teste se estiver perto? Não, confuso.
                // Vou trocar o Texto do botão temporariamente.
                const originalText = saveSettingsBtn.textContent;
                saveSettingsBtn.textContent = 'Salvo!';
                saveSettingsBtn.classList.remove('bg-emerald-600');
                saveSettingsBtn.classList.add('bg-emerald-500');
                setTimeout(() => {
                    saveSettingsBtn.textContent = originalText;
                    saveSettingsBtn.classList.add('bg-emerald-600');
                    saveSettingsBtn.classList.remove('bg-emerald-500');
                }, 2000);
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (err) {
            console.error(err);
            saveSettingsBtn.textContent = 'Erro ao Salvar';
            saveSettingsBtn.classList.add('bg-red-600');
             setTimeout(() => {
                    saveSettingsBtn.textContent = 'Salvar SMTP';
                    saveSettingsBtn.classList.remove('bg-red-600');
                    saveSettingsBtn.classList.add('bg-emerald-600');
                }, 2000);
        }
    }

    // --- Event Listeners ---
    if (emailModeSelect) {
        emailModeSelect.addEventListener('change', toggleEmailMode);
    }

    if (connectGoogleBtn) {
        console.log('[Settings] Botão Google encontrado, adicionando listener...');
        connectGoogleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            connectGoogleOAuth();
        });
    } else {
        console.warn('[Settings] Botão connect-google-btn NÃO encontrado!');
    }

    // Knowledge Ingest
    const knowledgeIngestBtn = document.getElementById('knowledge-ingest-btn');
    const knowledgeStatus = document.getElementById('knowledge-status');

    if (knowledgeIngestBtn) {
        knowledgeIngestBtn.addEventListener('click', async () => {
            if (knowledgeStatus) {
                knowledgeStatus.textContent = 'Processando documentos... Isso pode demorar.';
                knowledgeStatus.classList.remove('hidden', 'text-green-400', 'text-red-400');
                knowledgeStatus.classList.add('text-zinc-500');
            }
            knowledgeIngestBtn.disabled = true;

            try {
                const user = sessionStorage.getItem('veritas_user') || 'admin';
                const res = await fetch('/api/knowledge/ingest', { 
                    method: 'POST',
                    headers: {
                        'X-Auth-User': user
                    }
                });
                const data = await res.json();

                if (knowledgeStatus) {
                    knowledgeStatus.classList.remove('hidden', 'text-zinc-500');
                    if (data.status === 'success') {
                        knowledgeStatus.textContent = `Sucesso! ${data.processed} arquivos aprendidos em ${data.duration}s.`;
                        knowledgeStatus.classList.add('text-green-400');
                    } else if (data.status === 'empty') {
                        knowledgeStatus.textContent = data.message;
                        knowledgeStatus.classList.add('text-yellow-400');
                    } else {
                        throw new Error(data.error || 'Erro desconhecido');
                    }
                }
            } catch (e) {
                if (knowledgeStatus) {
                    knowledgeStatus.textContent = 'Erro: ' + e.message;
                    knowledgeStatus.classList.remove('hidden', 'text-zinc-500');
                    knowledgeStatus.classList.add('text-red-400');
                }
                console.error(e);
            } finally {
                knowledgeIngestBtn.disabled = false;
            }
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSMTPSettings);
    }

    // --- Send Test Email ---
    async function sendTestEmail() {
        if (testEmailBtn) {
            testEmailBtn.disabled = true;
            testEmailBtn.textContent = 'Enviando...';
        }
        
        showStatus(emailTestStatus, 'Enviando solicitação...', 'normal');

        try {
            const user = sessionStorage.getItem('veritas_user') || 'admin';
            const res = await fetch('/api/email/test', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-User': user
                },
                body: JSON.stringify({
                    targetEmail: 'geohonorato234@gmail.com'
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Falha ao enviar');
            }

            const data = await res.json();
            showStatus(emailTestStatus, 'Email enviado com sucesso!', 'success');

        } catch (err) {
            console.error('[Settings] Erro ao enviar teste:', err);
            showStatus(emailTestStatus, 'Erro: ' + err.message, 'error');
        } finally {
            if (testEmailBtn) {
                testEmailBtn.disabled = false;
                testEmailBtn.textContent = 'Enviar Email de Teste (Exemplo)';
            }
        }
    }

    if (testEmailBtn) {
        testEmailBtn.addEventListener('click', sendTestEmail);
    }

    // --- Initialize ---
    console.log('[Settings] Módulo inicializado.');
    loadSettings();

})();
