if (!window.VERITAS_APP_LOADED) {
  if (typeof window.api === 'undefined') {
    console.warn('[Script.js] Window.api missing (Premature load). Skipping execution.');
  } else {
    window.VERITAS_APP_LOADED = true;
    console.log('[Script.js] Starting App Logic...');
    (function () {
      // Prevent re-declaration error on reload
      if (typeof window.allActivitiesCache === 'undefined') {
        window.allActivitiesCache = [];
      }
      // Alias for local usage if needed, or just use window.allActivitiesCache
      var allActivitiesCache = window.allActivitiesCache;

      document.addEventListener('DOMContentLoaded', () => {
        // --- Funcionalidade da Navegação Lateral ---
        const navItems = document.querySelectorAll('#sidebar-nav .nav-item');
        const dashboardSection = document.getElementById('dashboard-section');
        const settingsSection = document.getElementById('settings-section');
        const usuariosSection = document.getElementById('usuarios-section');
        const atividadesSection = document.getElementById('atividades-section');
        /* Removed helpSection */
        const dailySummarySection = document.getElementById('daily-summary-section');

        navItems.forEach((item, idx) => {
          item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach((el) => {
              el.classList.remove('active', 'bg-indigo-500/10', 'text-indigo-400', 'ring-1', 'ring-inset', 'ring-indigo-500/20');
              el.classList.add('text-zinc-400', 'hover:text-zinc-100', 'hover:bg-white/5');
            });
            item.classList.remove('text-zinc-400', 'hover:text-zinc-100', 'hover:bg-white/5');
            item.classList.add('active', 'bg-indigo-500/10', 'text-indigo-400', 'ring-1', 'ring-inset', 'ring-indigo-500/20');

            dashboardSection.classList.add('hidden');
            settingsSection.classList.add('hidden');
            usuariosSection.classList.add('hidden');
            atividadesSection.classList.add('hidden');
            /* Removed helpSection hide */
            dailySummarySection.classList.add('hidden');

            if (item.textContent.includes('Configurações') || item.textContent.includes('ConfiguraÃ§Ãµes')) {
              settingsSection.classList.remove('hidden');
              listarPortasSeriais();
              loadEmailSettings();
            } else if (item.textContent.includes('Usuários') || item.textContent.includes('UsuÃ¡rios')) {
              usuariosSection.classList.remove('hidden');
              renderizarTabelaUsuarios();
            } else if (item.textContent.includes('Atividade')) {
              atividadesSection.classList.remove('hidden');
              renderizarTabelaAtividades();
            } else if (item.textContent.includes('Ajuda')) {
              /* Removed helpSection show */
            } else {
              dashboardSection.classList.remove('hidden');
            }
          });
        });

        // --- Help Command Interactivity ---
        document.querySelectorAll('.help-cmd').forEach(cmd => {
          cmd.addEventListener('click', () => {
            const textSpan = cmd.querySelector('span');
            if (!textSpan) return;

            const text = textSpan.textContent.replace(/"/g, ''); // Remove quotes

            // 1. Navigate to Dashboard (Index 0)
            if (typeof navItems !== 'undefined' && navItems[0]) navItems[0].click();

            // 2. Populate and Trigger Search
            setTimeout(() => {
              const aiInput = document.getElementById('dashboard-ai-input');
              if (aiInput) {
                aiInput.value = text;
                aiInput.focus();
                /* Auto-Enter disabled to prevent loops. User must press Enter manually. */
                // const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, bubbles: true });
                // aiInput.dispatchEvent(event);
              }
            }, 150); // Small delay for view transition
          });
        });

        // --- Funcionalidade do Calendário (Moved here) ---
        const monthYearEl = document.getElementById('month-year');
        const calendarGrid = document.getElementById('calendar-grid');
        const prevMonthBtn = document.getElementById('prev-month');
        const nextMonthBtn = document.getElementById('next-month');
        let currentDate = new Date(); // Local instance

        if (monthYearEl && calendarGrid) {
          const renderCalendar = () => {
            calendarGrid.innerHTML = '';
            const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
            weekDays.forEach(dia => {
              const th = document.createElement('div');
              th.className = 'text-zinc-500 text-center font-bold text-sm uppercase tracking-wider';
              th.textContent = dia;
              calendarGrid.appendChild(th);
            });
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            monthYearEl.textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 0; i < firstDay; i++) {
              calendarGrid.appendChild(document.createElement('div'));
            }
            for (let day = 1; day <= daysInMonth; day++) {
              const dayButton = document.createElement('button');
              dayButton.className = 'calendar-day h-10 w-10 text-zinc-300 text-sm font-medium rounded-full hover:bg-white/5 transition-all flex items-center justify-center';
              dayButton.innerHTML = `<div class="flex size-full items-center justify-center rounded-full pointer-events-none">${day}</div>`;

              const isToday = (day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear());
              let isActiveSelection = (selectedDay === day && selectedMonth === month && selectedYear === year);

              if (selectedDay === null && isToday) {
                selectedDay = day;
                selectedMonth = month;
                selectedYear = year;
                isActiveSelection = true;
                // Trigger initial load if needed? 
                // renderizarAtividadesPorData depends on global vars
              }

              if (isActiveSelection) {
                dayButton.classList.add('active');
              }

              dayButton.addEventListener('click', () => {
                const currentActive = document.querySelector('.calendar-day.active');
                if (currentActive) currentActive.classList.remove('active');
                dayButton.classList.add('active');
                selectedDay = day;
                selectedMonth = month;
                selectedYear = year;
                if (typeof renderizarAtividadesPorData === 'function') {
                  renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
                }
              });
              calendarGrid.appendChild(dayButton);
            }
          };

          if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
              currentDate.setMonth(currentDate.getMonth() - 1);
              renderCalendar();
            });
          }
          if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
              currentDate.setMonth(currentDate.getMonth() + 1);
              renderCalendar();
            });
          }
          renderCalendar();
        }

      });        // --- Server Info (Web Mode) ---
      const serverUrlDisplay = document.getElementById('server-url-display');
      if (serverUrlDisplay) {
        fetch('/api/server-info')
          .then(r => r.json())
          .then(data => {
            serverUrlDisplay.textContent = data.url;
          })
          .catch(err => {
            console.error('Erro ao buscar info do servidor:', err);
            serverUrlDisplay.textContent = 'IndisponÃ­vel';
          });
      }


      // Moved global state here
      let deleteMode = false;

      // Calendar logic moved to DOMContentLoaded
      let selectedDay = null;
      let selectedMonth = null;
      let selectedYear = null;

      // --- Cadastro de Aluno ---
      const btnAddUser = document.getElementById('add-user-btn');
      const modalCadastro = document.getElementById('cadastro-aluno');
      const btnFecharCadastro = document.getElementById('fechar-cadastro');
      const formAluno = document.getElementById('form-aluno');
      const statusDiv = document.getElementById('status-biometria');
      const btnSalvar = formAluno.querySelector('button[type="submit"]');
      const modalTitle = document.getElementById('modal-title');
      const alunoIdInput = document.getElementById('aluno-id');
      const deleteUserModalBtn = document.getElementById('delete-user-modal-btn');

      // --- Modal de Alerta ---
      const customAlertModal = document.getElementById('custom-alert-modal');
      const customAlertTitle = document.getElementById('custom-alert-title');
      const customAlertMessage = document.getElementById('custom-alert-message');
      const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
      const customAlertCancelBtn = document.getElementById('custom-alert-cancel-btn');

      function showCustomAlert(title, message) {
        return new Promise(resolve => {
          customAlertTitle.textContent = title;
          customAlertMessage.textContent = message;
          customAlertCancelBtn.classList.add('hidden');
          customAlertModal.classList.remove('hidden');

          customAlertOkBtn.onclick = () => {
            customAlertModal.classList.add('hidden');
            resolve(true);
          };
        });
      }

      function showCustomConfirm(title, message, isInput = false) {
        return new Promise(resolve => {
          customAlertTitle.textContent = title;
          customAlertMessage.innerHTML = '';

          const messageSpan = document.createElement('p');
          messageSpan.textContent = message;
          customAlertMessage.appendChild(messageSpan);

          if (isInput) {
            const inputField = document.createElement('input');
            inputField.type = isInput === 'text' ? 'text' : 'password';
            inputField.id = 'password-input';
            inputField.className = 'form-input rounded-xl bg-[#223549] text-white h-10 px-4 mt-2 w-full';
            inputField.placeholder = isInput === 'text' ? 'Digite para confirmar' : 'Digite a senha';
            customAlertMessage.appendChild(inputField);
            setTimeout(() => inputField.focus(), 100);
          }

          customAlertCancelBtn.classList.remove('hidden');
          customAlertModal.classList.remove('hidden');

          const okHandler = () => {
            const inputValue = isInput ? document.getElementById('password-input').value : true;
            resolve(inputValue);
            cleanup();
          };

          const cancelHandler = () => {
            resolve(false);
            cleanup();
          };

          const cleanup = () => {
            customAlertModal.classList.add('hidden');
            customAlertOkBtn.removeEventListener('click', okHandler);
            customAlertCancelBtn.removeEventListener('click', cancelHandler);
          };

          customAlertOkBtn.addEventListener('click', okHandler);
          customAlertCancelBtn.addEventListener('click', cancelHandler);
        });
      }

      async function abrirModalEdicao(userId) {
        const users = await window.api.invoke('get-users');
        const user = users.find(u => u.id === userId);
        if (!user) {
          await showCustomAlert('Erro', 'UsuÃ¡rio nÃ£o encontrado!');
          return;
        }

        formAluno.reset();
        alunoIdInput.value = user.id;
        formAluno.nome.value = user.nome || '';
        formAluno.matricula.value = user.matricula || '';
        formAluno.turma.value = user.turma || '';
        formAluno.turno.value = user.turno || '';
        formAluno.email.value = user.email || '';
        formAluno.genero.value = user.genero || '';
        formAluno.cabine.value = user.cabine || '';

        const diasSemanaCheckboxes = formAluno.querySelectorAll('input[name="dias-semana"]');
        diasSemanaCheckboxes.forEach(checkbox => {
          checkbox.checked = user.diasSemana && user.diasSemana.includes(parseInt(checkbox.value));
        });

        modalTitle.textContent = 'Editar Aluno';
        statusDiv.textContent = '';
        statusDiv.className = '';
        btnSalvar.disabled = false;
        deleteUserModalBtn.classList.remove('hidden');

        modalCadastro.classList.remove('hidden');
      }

      function abrirModalCadastro() {
        if (modalCadastro) {
          formAluno.reset();
          alunoIdInput.value = '';
          modalTitle.textContent = 'Adicionar Aluno';
          statusDiv.textContent = 'Preencha os dados do aluno e siga as instruÃ§Ãµes para o cadastro da digital.';
          statusDiv.className = 'text-white text-base font-medium mb-2';
          btnSalvar.disabled = false;
          deleteUserModalBtn.classList.add('hidden');
          modalCadastro.classList.remove('hidden');
        }
      }

      function fecharModalCadastro() {
        if (modalCadastro) modalCadastro.classList.add('hidden');
      }

      if (btnAddUser) btnAddUser.addEventListener('click', abrirModalCadastro);
      if (btnFecharCadastro) btnFecharCadastro.addEventListener('click', fecharModalCadastro);

      const searchByNameBtn = document.getElementById('search-by-name');
      const searchByMatriculaBtn = document.getElementById('search-by-matricula');

      async function searchAndFill(type) {
        const query = formAluno[type].value;
        if (!query) {
          showCustomAlert('Aviso', `Por favor, digite um(a) ${type} para buscar.`);
          return;
        }
        const result = await window.api.invoke('search-student-data', { query, type });

        if (result && result.error) {
          showCustomAlert('Erro', `Erro ao ler a planilha: ${result.error}`);
        } else if (result) {
          formAluno.nome.value = result.aluno || '';
          formAluno.matricula.value = result.matricula || '';
          formAluno.turma.value = result.turma || '';
          formAluno.turno.value = result.turno || '';
          formAluno.email.value = result.email || '';
          formAluno.genero.value = result.genero || '';
          formAluno.cabine.value = result.cabine || '';
          showCustomAlert('Sucesso', 'Dados do aluno preenchidos.');
        } else {
          showCustomAlert('NÃ£o encontrado', 'Nenhum aluno encontrado com os dados fornecidos. Prossiga com o cadastro manual.');
        }
      }

      searchByNameBtn.addEventListener('click', () => searchAndFill('nome'));
      searchByMatriculaBtn.addEventListener('click', () => searchAndFill('matricula'));

      formAluno.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSalvar.disabled = true;

        const formData = new FormData(formAluno);
        const id = formData.get('id');
        const diasSemana = Array.from(formAluno.querySelectorAll('input[name="dias-semana"]:checked')).map(cb => cb.value);

        const userData = {
          nome: formData.get('nome'),
          matricula: formData.get('matricula'),
          turma: formData.get('turma'),
          turno: formData.get('turno'),
          email: formData.get('email'),
          genero: formData.get('genero'),
          cabine: formData.get('cabine'),
          diasSemana,
        };

        if (id) {
          // --- MODO EDIÃ‡ÃƒO ---
          try {
            await window.api.invoke('update-user', { id, data: userData });
            await showCustomAlert('Sucesso!', 'UsuÃ¡rio atualizado com sucesso!');
            fecharModalCadastro();
            renderizarTabelaUsuarios();
          } catch (error) {
            await showCustomAlert('Erro', `Erro ao atualizar: ${error.message}`);
            btnSalvar.disabled = false;
          }
        } else {
          // --- MODO ADIÃ‡ÃƒO ---
          statusDiv.textContent = 'Iniciando processo de cadastro...';
          try {
            const result = await window.api.invoke('add-user-and-enroll', { userData });
            fecharModalCadastro();
            renderizarTabelaUsuarios();
            await showCustomAlert('Sucesso!', `UsuÃ¡rio ${result.user.nome} cadastrado com ID ${result.user.id}.`);
          } catch (error) {
            await showCustomAlert('Erro de Cadastro', error.message);
            btnSalvar.disabled = false;
          }
        }
      });

      if (deleteUserModalBtn) {
        deleteUserModalBtn.addEventListener('click', async () => {
          const userId = parseInt(alunoIdInput.value, 10);
          const confirmed = await showCustomConfirm('ConfirmaÃ§Ã£o', `Tem certeza que deseja excluir o usuÃ¡rio com ID ${userId} do banco de dados e do sensor?`);
          if (confirmed) {
            try {
              const result = await window.api.invoke('delete-user', userId);
              await showCustomAlert('Sucesso!', result.message);
              fecharModalCadastro();
              renderizarTabelaUsuarios();
            } catch (error) {
              await showCustomAlert('Erro', `Erro ao excluir usuÃ¡rio: ${error.message}`);
            }
          }
        });
      }

      // --- ComunicaÃ§Ã£o com Main Process (Refatorado para window.api) ---
      // Removido require('electron')

      const toggleBuzzer = document.getElementById('toggle-buzzer');

      function setBuzzerState(enabled) {
        window.api.invoke('set-buzzer-state', enabled);
        localStorage.setItem('buzzerEnabled', enabled);
        toggleBuzzer.checked = enabled;
      }

      if (toggleBuzzer) {
        toggleBuzzer.addEventListener('change', () => {
          setBuzzerState(toggleBuzzer.checked);
        });

        const savedBuzzerState = localStorage.getItem('buzzerEnabled') !== 'false';
        toggleBuzzer.checked = savedBuzzerState;
      }

      window.api.receive('serial-port-connected', () => {
        if (toggleBuzzer) {
          setBuzzerState(toggleBuzzer.checked);
        }
      });

      window.api.receive('activity-updated', () => {
        allActivitiesCache = [];
        renderizarTabelaAtividades({ turma: filterTurma.value, mes: filterMes.value });
      });

      window.api.receive('nova-atividade', (data) => {
        allActivitiesCache = [];
        renderizarTabelaAtividades();
        renderizarAtividadesRecentes();
        renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
        atualizarCardsDashboard();
      });

      window.api.receive('user-added', (data) => {
        renderizarTabelaUsuarios();
        atualizarCardsDashboard();
      });

      window.api.receive('user-updated', (data) => {
        renderizarTabelaUsuarios();
        atualizarCardsDashboard();
      });

      window.api.receive('user-deleted', (userId) => {
        renderizarTabelaUsuarios();
        atualizarCardsDashboard();
      });

      window.api.receive('users-cleared', () => {
        renderizarTabelaUsuarios();
        atualizarCardsDashboard();
      });

      window.api.receive('activities-cleared', () => {
        allActivitiesCache = [];
        renderizarTabelaAtividades();
        renderizarAtividadesRecentes();
        renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
        atualizarCardsDashboard();
      });

      window.api.receive('biometria-status', (data) => {
        if (!statusDiv) return;
        statusDiv.textContent = data.message;
        if (data.status === 'error') {
          statusDiv.className = 'text-red-400 text-base font-bold mb-2';
          btnSalvar.disabled = false;
        } else if (data.status === 'success') {
          statusDiv.className = 'text-green-400 text-base font-bold mb-2';
        } else {
          statusDiv.className = 'text-white text-base font-medium mb-2';
        }
      });

      // --- RenderizaÃ§Ã£o das Tabelas e Listas ---
      async function renderizarAtividadesRecentes() {
        const container = document.getElementById('recent-activities-container');
        if (!container) return;

        const allActivities = await window.api.invoke('get-activities');
        const recentActivities = allActivities.slice(-3).reverse();

        container.innerHTML = '';

        if (recentActivities.length === 0) {
          container.innerHTML = '<p class="text-[#9badc0] text-base font-normal leading-normal col-span-2 py-3">Nenhuma atividade recente.</p>';
          return;
        }

        recentActivities.forEach((activity, index) => {
          const time = new Date(activity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const isLast = index === recentActivities.length - 1;

          const activityHtml = `
        <div class="flex flex-col items-center gap-1 ${index === 0 ? 'pt-3' : ''} ${isLast ? 'pb-3' : ''}">
          ${index > 0 ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2"></div>' : ''}
          <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-6" style="background-image: url('https://i.pravatar.cc/24?u=${activity.userId}');"></div>
          ${!isLast ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2 grow"></div>' : ''}
        </div>
        <div class="flex flex-1 flex-col py-3">
          <p class="text-white text-base font-medium leading-normal">${activity.userName} registrou ${activity.type.toLowerCase()}</p>
          <p class="text-[#9badc0] text-base font-normal leading-normal">${time}</p>
        </div>
      `;
          container.innerHTML += activityHtml;
        });
      }

      async function renderizarTabelaAtividades(filters = {}) {
        const tbody = document.getElementById('atividades-tbody');
        let atividades;

        if (Object.keys(filters).length === 0 && allActivitiesCache.length > 0) {
          atividades = allActivitiesCache;
        } else {
          atividades = await window.api.invoke('get-activities');
          allActivitiesCache = atividades;
        }

        if (filters.turma) {
          atividades = atividades.filter(a => a.userTurma === filters.turma);
        }
        if (filters.turno) {
          atividades = atividades.filter(a => a.userTurno === filters.turno);
        }
        if (filters.nome) {
          const lowerNome = filters.nome.toLowerCase();
          atividades = atividades.filter(a => a.userName && a.userName.toLowerCase().includes(lowerNome));
        }
        if (filters.mes) {
          atividades = atividades.filter(a => {
            const activityDate = new Date(a.timestamp);
            const [filterYear, filterMonth] = filters.mes.split('-').map(Number);
            return activityDate.getMonth() === (filterMonth - 1) && activityDate.getFullYear() === filterYear;
          });
        }

        tbody.innerHTML = '';
        if (!atividades || atividades.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-[#9badc0]">Nenhuma atividade encontrada para os filtros selecionados.</td></tr>';
          return;
        }

        const dailyRecords = {};

        atividades.forEach(a => {
          const date = new Date(a.timestamp).toLocaleDateString('pt-BR');
          const key = `${a.userId}_${date}`;

          if (!dailyRecords[key]) {
            dailyRecords[key] = {
              userName: a.userName,
              userTurma: a.userTurma,
              date: date,
              entrada: null,
              saida: null,
            };
          }

          const record = dailyRecords[key];
          const activityTime = new Date(a.timestamp);

          if (a.type === 'Entrada') {
            if (!record.entrada || activityTime < new Date(record.entrada.timestamp)) {
              record.entrada = a;
            }
          } else if (a.type === 'SAIDA') {
            if (!record.saida || activityTime > new Date(record.saida.timestamp)) {
              record.saida = a;
            }
          }
        });

        const sortedRecords = Object.values(dailyRecords).sort((a, b) => {
          const dateA = new Date(a.date.split('/').reverse().join('-'));
          const dateB = new Date(b.date.split('/').reverse().join('-'));
          if (dateA > dateB) return -1;
          if (dateA < dateB) return 1;
          return 0;
        });

        let lastDate = null;
        sortedRecords.forEach(r => {
          if (r.date !== lastDate) {
            const dateHeader = document.createElement('tr');
            dateHeader.innerHTML = `<td colspan="4" class="bg-zinc-950/50 border-y border-white/5 text-indigo-400 p-3 font-semibold text-sm tracking-wide uppercase">${r.date}</td>`;
            tbody.appendChild(dateHeader);
            lastDate = r.date;
          }

          const tr = document.createElement('tr');
          tr.className = 'border-t border-t-[#314c68] group';

          const entradaTime = r.entrada ? new Date(r.entrada.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
          const saidaTime = r.saida ? new Date(r.saida.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';

          const editIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>`;

          const entradaContent = `
        <div class="flex items-center gap-2">
          <span class="text-white text-sm font-normal">${entradaTime}</span>
          ${r.entrada ? `
          <button class="edit-activity-btn opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/5" 
            data-timestamp="${r.entrada.timestamp}" data-userid="${r.entrada.userId}" title="Editar Entrada">
            ${editIconSvg}
          </button>` : ''}
        </div>
      `;

          const saidaContent = `
        <div class="flex items-center gap-2">
          <span class="text-white text-sm font-normal">${saidaTime}</span>
          ${r.saida ? `
          <button class="edit-activity-btn opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/5" 
            data-timestamp="${r.saida.timestamp}" data-userid="${r.saida.userId}" title="Editar SaÃ­da">
            ${editIconSvg}
          </button>` : ''}
        </div>
      `;

          tr.innerHTML = `
          <td class="h-[60px] px-4 py-2 text-white text-sm font-normal">${r.userName}</td>
          <td class="h-[60px] px-4 py-2 text-[#9badc0] text-sm font-normal">${r.userTurma}</td>
          <td class="h-[60px] px-4 py-2">${entradaContent}</td>
          <td class="h-[60px] px-4 py-2">${saidaContent}</td>
      `;
          tbody.appendChild(tr);
        });

        document.querySelectorAll('.edit-activity-btn').forEach(btn => {
          btn.addEventListener('click', handleEditActivityClick);
        });
      }

      /* deleteMode moved to top */

      async function renderizarTabelaUsuarios(filtro = "") {
        const tbody = document.getElementById('usuarios-tbody');
        let alunos = await window.api.invoke('get-users');

        alunos.sort((a, b) => a.nome.localeCompare(b.nome));

        const deleteModeCols = document.querySelectorAll('.delete-mode-col');
        deleteModeCols.forEach(col => col.style.display = deleteMode ? '' : 'none');

        let filteredAlunos = alunos;
        if (filtro) {
          const filtroLower = filtro.toLowerCase();
          filteredAlunos = alunos.filter(aluno =>
            (aluno.nome && aluno.nome.toLowerCase().includes(filtroLower)) ||
            (aluno.matricula && aluno.matricula.toLowerCase().includes(filtroLower)) ||
            (String(aluno.id) && String(aluno.id).includes(filtroLower))
          );
        }

        tbody.innerHTML = '';
        if (!filteredAlunos || filteredAlunos.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-[#9badc0]">Nenhum aluno cadastrado.</td></tr>';
          return;
        }

        const diasNomes = {
          0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'SÃ¡b'
        };

        filteredAlunos.forEach(aluno => {
          const tr = document.createElement('tr');
          tr.className = 'border-t border-t-[#314c68]';
          const dias = aluno.diasSemana ? aluno.diasSemana.map(d => diasNomes[d]).join(', ') : 'N/A';
          tr.innerHTML = `
        <td class="h-[72px] px-4 py-2 text-center delete-mode-col" style="display: ${deleteMode ? '' : 'none'};">
          <input type="checkbox" data-id="${aluno.id}" class="form-checkbox rounded bg-[#223549] text-blue-500 delete-checkbox">
        </td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.nome}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal text-center border-r border-[#314c68]">${aluno.matricula}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.turma}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.turno || 'N/A'}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal text-center border-r border-[#314c68]">${aluno.email}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.cabine || 'N/A'}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.genero || 'N/A'}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${aluno.id}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal text-center border-r border-[#314c68]">${dias}</td>
        <td class="h-[72px] px-4 py-2 text-center">
          <button data-id="${aluno.id}" class="edit-user-btn text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </td>
      `;
          tbody.appendChild(tr);
        });

        document.querySelectorAll('.edit-user-btn').forEach(button => {
          button.addEventListener('click', (e) => {
            const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
            abrirModalEdicao(userId);
          });
        });
      }

      const saveBtn = document.getElementById('save-serial-settings');
      if (saveBtn) {
        saveBtn.onclick = async () => {
          const porta = document.getElementById('select-serial-port').value;
          if (porta) {
            try {
              await window.api.invoke('setar-porta-serial', porta);
              localStorage.setItem('porta-esp', porta);
              atualizarStatusSerial(true);
            } catch (error) {
              console.error("Falha ao configurar a porta serial:", error);
              atualizarStatusSerial(false);
            }
          } else {
            localStorage.removeItem('porta-esp');
            atualizarStatusSerial(false);
          }
        };
      }

      // --- Configuracoes de Email ---
      // --- Configuracoes de Email (SMTP & OAuth) ---
      const saveSettingsBtn = document.getElementById('save-settings-btn');
      const emailModeSelect = document.getElementById('email-mode-select');
      const smtpFields = document.getElementById('smtp-fields');
      const oauthFields = document.getElementById('oauth-fields');

      const smtpHostInput = document.getElementById('smtp-host');
      const smtpPortInput = document.getElementById('smtp-port');
      const smtpUserInput = document.getElementById('smtp-user');
      const smtpPassInput = document.getElementById('smtp-pass');
      const smtpSecureInput = document.getElementById('smtp-secure');

      const oauthClientIdInput = document.getElementById('oauth-client-id');
      const oauthClientSecretInput = document.getElementById('oauth-client-secret');
      const connectGoogleBtn = document.getElementById('connect-google-btn');
      const oauthStatus = document.getElementById('oauth-status');

      // Toggle UI
      if (emailModeSelect) {
        emailModeSelect.addEventListener('change', () => {
          if (emailModeSelect.value === 'oauth2') {
            smtpFields.classList.add('hidden');
            oauthFields.classList.remove('hidden');
          } else {
            smtpFields.classList.remove('hidden');
            oauthFields.classList.add('hidden');
          }
        });
      }

      async function loadEmailSettings() {
        try {
          const res = await fetch('/api/settings');
          const settings = await res.json();

          if (settings.email_mode) {
            emailModeSelect.value = settings.email_mode;
            // Trigger change matches logic
            if (settings.email_mode === 'oauth2') {
              smtpFields.classList.add('hidden');
              oauthFields.classList.remove('hidden');
            }
          }

          // SMTP
          if (settings.smtp_host) smtpHostInput.value = settings.smtp_host;
          if (settings.smtp_port) smtpPortInput.value = settings.smtp_port;
          if (settings.smtp_user) smtpUserInput.value = settings.smtp_user;
          if (settings.smtp_pass) smtpPassInput.value = settings.smtp_pass;
          if (settings.smtp_secure) smtpSecureInput.checked = settings.smtp_secure === 'true';

          // OAuth
          if (settings.oauth_client_id) oauthClientIdInput.value = settings.oauth_client_id;
          if (settings.oauth_client_secret) oauthClientSecretInput.value = settings.oauth_client_secret;

          if (settings.oauth_user) {
            if (oauthStatus) {
              oauthStatus.textContent = `Conectado como ${settings.oauth_user}`;
              oauthStatus.className = "font-bold text-emerald-400";
            }
            if (connectGoogleBtn) connectGoogleBtn.textContent = "Reconectar Conta";
          } else {
            if (oauthStatus) {
              oauthStatus.textContent = "NÃ£o Conectado";
              oauthStatus.className = "font-bold text-white";
            }
          }

        } catch (err) {
          console.error("Erro ao carregar settings:", err);
        }
      }

      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
          const mode = emailModeSelect ? emailModeSelect.value : 'smtp';
          const data = {
            email_mode: mode,
            // SMTP
            smtp_host: smtpHostInput ? smtpHostInput.value : '',
            smtp_port: smtpPortInput ? smtpPortInput.value : '',
            smtp_user: smtpUserInput ? smtpUserInput.value : '',
            smtp_pass: smtpPassInput ? smtpPassInput.value : '',
            smtp_secure: smtpSecureInput ? smtpSecureInput.checked : false,
            // OAuth 
            oauth_client_id: oauthClientIdInput ? oauthClientIdInput.value : '',
            oauth_client_secret: oauthClientSecretInput ? oauthClientSecretInput.value : ''
          };

          try {
            const res = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const saved = await res.json();
            if (saved) {
              showCustomAlert('Sucesso', 'ConfiguraÃ§Ãµes salvas!');
            }
          } catch (err) {
            showCustomAlert('Erro', 'Falha ao salvar.');
          }
        });
      }

      if (connectGoogleBtn) {
        connectGoogleBtn.addEventListener('click', async () => {
          const clientId = oauthClientIdInput.value;
          const clientSecret = oauthClientSecretInput.value;

          if (!clientId || !clientSecret) {
            showCustomAlert('Erro', 'Preencha Client ID e Secret antes de conectar.');
            return;
          }

          try {
            const res = await fetch('/api/auth/google/url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, clientSecret })
            });
            const data = await res.json();

            if (data.url) {
              // Abre Login
              window.open(data.url, '_blank', 'width=500,height=600');
            }
          } catch (err) {
            showCustomAlert('Erro', 'Falha ao iniciar autenticaÃ§Ã£o Google.');
          }
        });
      }

      async function listarPortasSeriais() {
        const select = document.getElementById('select-serial-port');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione a porta serial do ESP</option>';
        const portas = await window.api.invoke('listar-portas');
        portas.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.path;
          opt.textContent = `${p.path} - ${p.manufacturer || 'N/A'}`;
          select.appendChild(opt);
        });
        const portaSalva = localStorage.getItem('porta-esp');
        if (portaSalva) {
          select.value = portaSalva;
          saveBtn.click();
        }
      }

      function atualizarStatusSerial(conectado) {
        const status = document.getElementById('status-serial');
        if (!status) return;
        status.className = 'size-3 rounded-full ' + (conectado ? 'bg-green-500' : 'bg-red-500');
      }

      const searchAluno = document.getElementById('search-aluno');
      if (searchAluno) {
        searchAluno.addEventListener('input', (e) => {
          renderizarTabelaUsuarios(e.target.value);
        });
      }

      const selectExcelPathBtn = document.getElementById('select-excel-path-btn');
      const excelPathDisplay = document.getElementById('excel-path-display');

      if (selectExcelPathBtn) {
        selectExcelPathBtn.addEventListener('click', async () => {
          const path = await window.api.invoke('select-csv-path');
          if (path) {
            localStorage.setItem('excel-export-path', path);
            excelPathDisplay.value = path;
          }
        });
      }

      const savedExcelPath = localStorage.getItem('excel-export-path');
      if (savedExcelPath && excelPathDisplay) {
        excelPathDisplay.value = savedExcelPath;
        window.api.send('set-csv-path', savedExcelPath);
      }

      const selectStudentDataBtn = document.getElementById('select-student-data-path-btn');
      const studentDataPathDisplay = document.getElementById('student-data-path-display');

      if (selectStudentDataBtn) {
        selectStudentDataBtn.addEventListener('click', async () => {
          const path = await window.api.invoke('select-student-data-path');
          if (path) {
            localStorage.setItem('student-data-path', path);
            studentDataPathDisplay.value = path;
            await showCustomAlert('Sucesso', 'Planilha de dados dos alunos selecionada.');
          }
        });
      }

      const savedStudentDataPath = localStorage.getItem('student-data-path');
      if (savedStudentDataPath && studentDataPathDisplay) {
        studentDataPathDisplay.value = savedStudentDataPath;
      }

      const userMenuBtn = document.getElementById('user-menu-btn');
      const userMenuDropdown = document.getElementById('user-menu-dropdown');
      const syncUsersMenuItem = document.getElementById('sync-users-menu-item');
      const deleteUsersMenuItem = document.getElementById('delete-users-menu-item');
      const removeDuplicatesMenuItem = document.getElementById('remove-duplicates-menu-item');

      if (syncUsersMenuItem) {
        syncUsersMenuItem.addEventListener('click', async (e) => {
          e.preventDefault();
          userMenuDropdown.classList.add('hidden');

          const confirmed = await showCustomConfirm(
            'Sincronizar com Sensor',
            'Esta aÃ§Ã£o buscarÃ¡ por digitais cadastradas diretamente no sensor e as importarÃ¡ para o aplicativo. Deseja continuar?'
          );

          if (confirmed) {
            showCustomAlert('Sincronizando...', 'Buscando por novos usuÃ¡rios no sensor. Isso pode levar alguns segundos.');
            try {
              const result = await window.api.invoke('sync-from-sensor');
              await showCustomAlert(
                'SincronizaÃ§Ã£o ConcluÃ­da',
                `${result.newUsers} novo(s) usuÃ¡rio(s) foram importados. O sensor possui um total de ${result.totalSensor} digitais.`
              );
              renderizarTabelaUsuarios();
            } catch (error) {
              await showCustomAlert('Erro de SincronizaÃ§Ã£o', error.message);
            }
          }
        });
      }

      if (userMenuBtn) {
        userMenuBtn.addEventListener('click', () => {
          userMenuDropdown.classList.toggle('hidden');
        });
      }

      if (deleteUsersMenuItem) {
        deleteUsersMenuItem.addEventListener('click', (e) => {
          e.preventDefault();
          deleteMode = !deleteMode;
          userMenuDropdown.classList.add('hidden');
          renderizarTabelaUsuarios();

          const header = document.querySelector('#usuarios-section .p-4');
          let actionContainer = document.getElementById('delete-action-container');

          if (deleteMode && !actionContainer) {
            document.getElementById('add-user-btn').classList.add('hidden');
            userMenuBtn.classList.add('hidden');

            actionContainer = document.createElement('div');
            actionContainer.id = 'delete-action-container';
            actionContainer.className = 'flex items-center gap-2 ml-auto';

            const selectAllBtn = document.createElement('button');
            selectAllBtn.textContent = 'Selecionar Todos';
            selectAllBtn.className = 'rounded-full bg-blue-600 text-white font-bold px-4 h-10';

            const cancelDeleteBtn = document.createElement('button');
            cancelDeleteBtn.textContent = 'Cancelar';
            cancelDeleteBtn.className = 'rounded-full bg-gray-600 text-white font-bold px-4 h-10';

            const deleteConfirmBtn = document.createElement('button');
            deleteConfirmBtn.textContent = 'Excluir Selecionados';
            deleteConfirmBtn.className = 'rounded-full bg-red-600 text-white font-bold px-4 h-10';

            actionContainer.appendChild(selectAllBtn);
            actionContainer.appendChild(cancelDeleteBtn);
            actionContainer.appendChild(deleteConfirmBtn);
            header.appendChild(actionContainer);

            selectAllBtn.addEventListener('click', () => {
              const checkboxes = document.querySelectorAll('.delete-checkbox');
              const allChecked = Array.from(checkboxes).every(cb => cb.checked);
              checkboxes.forEach(checkbox => {
                checkbox.checked = !allChecked;
              });
            });

            const exitDeleteMode = () => {
              deleteMode = false;
              document.getElementById('add-user-btn').classList.remove('hidden');
              userMenuBtn.classList.remove('hidden');
              if (actionContainer) {
                actionContainer.remove();
              }
              renderizarTabelaUsuarios();
            };

            cancelDeleteBtn.addEventListener('click', exitDeleteMode);

            deleteConfirmBtn.addEventListener('click', async () => {
              const checkboxes = document.querySelectorAll('.delete-checkbox:checked');
              const userIdsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id, 10));

              if (userIdsToDelete.length === 0) {
                await showCustomAlert('Aviso', 'Nenhum usuÃ¡rio selecionado para exclusÃ£o.');
                return;
              }

              const confirmed = await showCustomConfirm('ConfirmaÃ§Ã£o', `Tem certeza que deseja excluir ${userIdsToDelete.length} usuÃ¡rio(s)?`);
              if (confirmed) {
                try {
                  for (const userId of userIdsToDelete) {
                    await window.api.invoke('delete-user', userId);
                  }
                  await showCustomAlert('Sucesso!', `${userIdsToDelete.length} usuÃ¡rio(s) excluÃ­do(s) com sucesso.`);
                  exitDeleteMode();
                } catch (error) {
                  await showCustomAlert('Erro', `Erro ao excluir usuÃ¡rios: ${error.message}`);
                }
              }
            });
          } else if (!deleteMode && actionContainer) {
            actionContainer.remove();
          }
        });
      }

      if (removeDuplicatesMenuItem) {
        removeDuplicatesMenuItem.addEventListener('click', async (e) => {
          e.preventDefault();
          userMenuDropdown.classList.add('hidden');
          const confirmed = await showCustomConfirm('Remover Duplicados', 'Esta aÃ§Ã£o irÃ¡ verificar todos os usuÃ¡rios e remover aqueles com matrÃ­culas duplicadas, mantendo apenas a primeira ocorrÃªncia encontrada. Deseja continuar?');
          if (confirmed) {
            try {
              const result = await window.api.invoke('remove-duplicates');
              await showCustomAlert('Sucesso', `${result.count} usuÃ¡rio(s) duplicado(s) removido(s).`);
              renderizarTabelaUsuarios();
            } catch (error) {
              await showCustomAlert('Erro', `Erro ao remover duplicados: ${error.message}`);
            }
          }
        });
      }

      const dashboardCards = document.querySelectorAll('.dashboard-card');
      dashboardCards.forEach(card => {
        card.addEventListener('click', async (e) => {
          const target = e.currentTarget.dataset.target;
          navItems.forEach((el) => el.classList.remove('active', 'bg-[#293542]'));
          const usuariosNavItem = document.querySelector('.nav-item:nth-child(3)');

          dashboardSection.classList.add('hidden');
          settingsSection.classList.add('hidden');
          usuariosSection.classList.add('hidden');
          atividadesSection.classList.add('hidden');
          ajudaSection.classList.add('hidden');
          dailySummarySection.classList.add('hidden');

          let activeNavItem = null;

          if (target === 'presentes') {
            dailySummarySection.classList.remove('hidden');
            renderizarDailySummary('presentes');
            activeNavItem = document.querySelector('.nav-item:nth-child(1)');
          } else if (target === 'ausentes') {
            dailySummarySection.classList.remove('hidden');
            renderizarDailySummary('ausentes');
            activeNavItem = document.querySelector('.nav-item:nth-child(1)');
          } else if (target === 'todos') {
            usuariosSection.classList.remove('hidden');
            renderizarTabelaUsuarios();
            activeNavItem = document.querySelector('.nav-item:nth-child(3)');
          }

          if (activeNavItem) {
            activeNavItem.classList.add('active', 'bg-[#293542]');
          }
        });
      });

      const btnExportActivities = document.getElementById('export-activities-btn');
      if (btnExportActivities) {
        btnExportActivities.addEventListener('click', async () => {
          try {
            const filters = {
              turma: filterTurma.value,
              mes: filterMes.value,
              turno: filterTurno.value,
              nome: filterNome.value
            };
            const result = await window.api.invoke('export-activities-excel', filters);
            if (result.success) {
              await showCustomAlert('Sucesso', `Atividades exportadas para: ${result.filePath}`);
            } else {
              if (!result.canceled) {
                await showCustomAlert('Erro', `Erro ao exportar: ${result.error}`);
              }
            }
          } catch (error) {
            await showCustomAlert('Erro', `Erro ao exportar: ${error.message}`);
          }
        });
      }

      const filterTurma = document.getElementById('filter-turma');
      const filterMesSelect = document.getElementById('filter-mes-select'); // Novo Select de MÃªs
      const filterAnoInput = document.getElementById('filter-ano-input'); // Novo Input de Ano
      const filterTurno = document.getElementById('filter-turno');
      const filterNome = document.getElementById('filter-nome');
      const btnClearFilters = document.getElementById('clear-filters-btn');

      // Inicializar o Ano com o ano atual
      if (filterAnoInput) {
        filterAnoInput.value = new Date().getFullYear();
      }

      function getFilterMesValue() {
        if (!filterMesSelect || !filterMesSelect.value || !filterAnoInput || !filterAnoInput.value) return '';
        return `${filterAnoInput.value}-${filterMesSelect.value}`;
      }

      function applyFilters() {
        renderizarTabelaAtividades({
          turma: filterTurma ? filterTurma.value : '',
          mes: getFilterMesValue(),
          turno: filterTurno ? filterTurno.value : '',
          nome: filterNome ? filterNome.value : ''
        });
      }

      if (filterMesSelect && filterAnoInput) {
        filterMesSelect.addEventListener('change', () => {
          const selectedMonth = parseInt(filterMesSelect.value, 10);
          if (selectedMonth) {
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // 1-12
            const currentYear = now.getFullYear();

            // LÃ³gica Inteligente: Se selecionar um mÃªs que AINDA nÃ£o chegou no ano corrente, volta 1 ano.
            // Mas se o ano jÃ¡ estiver diferente do atual (ex: usuÃ¡rio mudou manualmente), respeita a escolha manual?
            // A regra diz: "por padrÃ£o Ã© o ano corrente, mas..."
            // Vamos aplicar a regra se o ano input estiver igual ao ano atual.
            if (parseInt(filterAnoInput.value) === currentYear) {
              if (selectedMonth > currentMonth) {
                filterAnoInput.value = currentYear - 1;
              } else {
                // Caso contrÃ¡rio (mÃªs Ã© passado ou atual), mantemos o ano corrente.
                // Mas se o usuÃ¡rio estava vendo 2025 e clicou em Janeiro (2026), deve voltar pra 2026?
                // "Caso seja selecionado um mÃªs que ainda nÃ£o chegou... passa a marcar o ano anterior"
                // Implica que Ã© uma transiÃ§Ã£o automÃ¡tica unidirecional ou bidirecional?
                // Geralmente resetar pra ano atual Ã© bom se o mÃªs for vÃ¡lido.
                filterAnoInput.value = currentYear;
              }
            }
          }
          applyFilters();
        });
        filterAnoInput.addEventListener('input', applyFilters);
      }

      if (filterTurma) {
        window.api.invoke('get-users').then(users => {
          const turmas = [...new Set(users.map(u => u.turma))];
          turmas.forEach(turma => {
            if (turma) {
              const option = document.createElement('option');
              option.value = turma;
              option.textContent = turma;
              filterTurma.appendChild(option);
            }
          });
        });

        filterTurma.addEventListener('change', applyFilters);
      }

      if (filterTurno) filterTurno.addEventListener('change', applyFilters);
      if (filterNome) filterNome.addEventListener('input', applyFilters);

      if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
          if (filterTurma) filterTurma.value = '';
          if (typeof filterMesSelect !== 'undefined' && filterMesSelect) filterMesSelect.value = '';
          if (typeof filterAnoInput !== 'undefined' && filterAnoInput) filterAnoInput.value = new Date().getFullYear();
          if (filterTurno) filterTurno.value = '';
          if (filterNome) filterNome.value = '';
          renderizarTabelaAtividades();
        });
      }

      async function atualizarCardsDashboard() {
        const users = await window.api.invoke('get-users');
        const activities = await window.api.invoke('get-activities');

        const totalAlunos = users.length;
        document.getElementById('total-alunos').textContent = totalAlunos;

        const today = new Date();
        const todayDay = today.getDay();
        const todayDate = today.toLocaleDateString('pt-BR');

        const usuariosHoje = users.filter(u => u.diasSemana && u.diasSemana.includes(todayDay));
        const totalHoje = usuariosHoje.length;

        const presencasHoje = new Set();
        const saidasHoje = new Set();

        activities.forEach(activity => {
          const activityDate = new Date(activity.timestamp).toLocaleDateString('pt-BR');
          if (activityDate === todayDate) {
            if (activity.type === 'Entrada') {
              presencasHoje.add(activity.userId);
              saidasHoje.delete(activity.userId);
            } else {
              saidasHoje.add(activity.userId);
              presencasHoje.delete(activity.userId);
            }
          }
        });

        const presentes = Array.from(presencasHoje).filter(userId => !saidasHoje.has(userId));
        const presencaHojeCount = presentes.length;

        document.getElementById('presenca-hoje').textContent = presencaHojeCount;
        document.getElementById('ausentes-hoje').textContent = totalHoje - presencaHojeCount;
      }

      const syncTimeBtn = document.getElementById('sync-time-btn');
      if (syncTimeBtn) {
        syncTimeBtn.addEventListener('click', async () => {
          try {
            await window.api.invoke('sync-time');
            await showCustomAlert('Sucesso', 'Data e hora sincronizadas com o dispositivo.');
          } catch (error) {
            await showCustomAlert('Erro', `NÃ£o foi possÃ­vel sincronizar a hora: ${error.message}`);
          }
        });
      }

      const clearActivitiesBtn = document.getElementById('clear-activities-btn');
      const emptySensorBtn = document.getElementById('empty-sensor-btn');

      if (emptySensorBtn) {
        emptySensorBtn.addEventListener('click', async () => {
          const password = await showCustomConfirm('ConfirmaÃ§Ã£o de SeguranÃ§a', 'Esta aÃ§Ã£o Ã© EXTREMAMENTE DESTRUTIVA e irÃ¡ apagar TODAS as digitais do sensor. Para continuar, digite a senha:', 'password');
          if (password) {
            if (password === '2909') {
              const finalConfirm = await showCustomConfirm('ConfirmaÃ§Ã£o Final', 'TEM CERTEZA? Todas as digitais no sensor serÃ£o perdidas permanentemente. Esta Ã© sua Ãºltima chance de cancelar.');
              if (finalConfirm) {
                try {
                  const result = await window.api.invoke('empty-sensor-database');
                  await showCustomAlert('Sucesso', result.message);
                } catch (error) {
                  await showCustomAlert('Erro', `NÃ£o foi possÃ­vel apagar a memÃ³ria do sensor: ${error.message}`);
                }
              }
            } else {
              await showCustomAlert('Erro', 'Senha incorreta!');
            }
          }
        });
      }

      if (clearActivitiesBtn) {
        clearActivitiesBtn.addEventListener('click', async () => {
          const password = await showCustomConfirm('ConfirmaÃ§Ã£o', 'Para apagar todos os registros de atividades, digite a senha:', 'password');

          if (password) {
            if (password === '2909') {
              const confirmed = await showCustomConfirm('ConfirmaÃ§Ã£o', 'Tem certeza que deseja apagar TODOS os registros de atividades? Esta aÃ§Ã£o Ã© irreversÃ­vel.');
              if (confirmed) {
                try {
                  const result = await window.api.invoke('clear-all-activities');
                  await showCustomAlert('Sucesso!', result.message);
                  renderizarTabelaAtividades();
                  renderizarAtividadesRecentes();
                  renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
                  atualizarCardsDashboard();
                } catch (error) {
                  await showCustomAlert('Erro', `Erro ao apagar atividades: ${error.message}`);
                }
              }
            } else {
              await showCustomAlert('Erro', 'Senha incorreta!');
            }
          }
        });
      }

      async function renderizarDailySummary(filterType) {
        const tbody = document.getElementById('daily-summary-tbody');
        const users = await window.api.invoke('get-users');
        const activities = await window.api.invoke('get-activities');

        const today = new Date();
        const todayDay = today.getDay();
        const todayDate = today.toLocaleDateString('pt-BR');

        const usuariosComDiaHoje = users.filter(u => u.diasSemana && u.diasSemana.includes(todayDay));

        const presencasHoje = new Set();
        const saidasHoje = new Set();

        activities.forEach(activity => {
          const activityDate = new Date(activity.timestamp).toLocaleDateString('pt-BR');
          if (activityDate === todayDate) {
            if (activity.type === 'Entrada') {
              presencasHoje.add(activity.userId);
              saidasHoje.delete(activity.userId);
            } else {
              saidasHoje.add(activity.userId);
              presencasHoje.delete(activity.userId);
            }
          }
        });

        let filteredUsers = [];
        if (filterType === 'presentes') {
          document.getElementById('daily-summary-title').textContent = 'Alunos Presentes Hoje';
          const presentesIds = Array.from(presencasHoje).filter(userId => !saidasHoje.has(userId));
          filteredUsers = users.filter(user => presentesIds.includes(user.id));
        } else if (filterType === 'ausentes') {
          document.getElementById('daily-summary-title').textContent = 'Alunos Ausentes Hoje';
          const presentesIds = Array.from(presencasHoje).filter(userId => !saidasHoje.has(userId));
          filteredUsers = usuariosComDiaHoje.filter(user => !presentesIds.includes(user.id));
        }

        tbody.innerHTML = '';
        if (filteredUsers.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-[#9badc0]">Nenhum aluno encontrado.</td></tr>';
          return;
        }

        const diasNomes = {
          0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'SÃ¡b'
        };

        filteredUsers.forEach(aluno => {
          const tr = document.createElement('tr');
          tr.className = 'border-t border-t-[#314c68]';
          const dias = aluno.diasSemana ? aluno.diasSemana.map(d => diasNomes[d]).join(', ') : 'N/A';
          tr.innerHTML = `
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal">${aluno.nome}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${aluno.matricula}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal">${aluno.turma}</td>
        <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${aluno.email}</td>
        <td class="h-[72px] px-4 py-2 text-white text-sm font-normal">${dias}</td>
      `;
          tbody.appendChild(tr);
        });
      }

      async function renderizarAtividadesPorData(date) {
        const dailyActivitiesTitle = document.getElementById('daily-activities-title');
        const dailyActivitiesContainer = document.getElementById('daily-activities-container');

        if (!dailyActivitiesContainer) return;

        const allActivities = await window.api.invoke('get-activities');
        const targetDateString = date.toLocaleDateString('pt-BR');

        const filteredActivities = allActivities.filter(activity => {
          return new Date(activity.timestamp).toLocaleDateString('pt-BR') === targetDateString;
        }).reverse();

        dailyActivitiesTitle.textContent = `Atividades do Dia: ${targetDateString}`;
        dailyActivitiesContainer.innerHTML = '';

        if (filteredActivities.length === 0) {
          dailyActivitiesContainer.innerHTML = '<p class="text-[#9badc0] text-base font-normal leading-normal col-span-2 py-3">Nenhuma atividade para este dia.</p>';
          return;
        }

        filteredActivities.forEach((activity, index) => {
          const time = new Date(activity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const isLast = index === filteredActivities.length - 1;

          const activityHtml = `
        <div class="flex flex-col items-center gap-1 ${index === 0 ? 'pt-3' : ''} ${isLast ? 'pb-3' : ''}">
          ${index > 0 ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2"></div>' : ''}
          <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-6" style="background-image: url('https://i.pravatar.cc/24?u=${activity.userId}');"></div>
          ${!isLast ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2 grow"></div>' : ''}
        </div>
        <div class="flex flex-1 flex-col py-3">
          <p class="text-white text-base font-medium leading-normal">${activity.userName} registrou ${activity.type.toLowerCase()}</p>
          <p class="text-[#9badc0] text-base font-normal leading-normal">${time}</p>
        </div>
      `;
          dailyActivitiesContainer.innerHTML += activityHtml;
        });

        // --- LÃ³gica de Ausentes ---
        const dailyAbsencesContainer = document.getElementById('daily-absences-container');
        if (dailyAbsencesContainer) {
          dailyAbsencesContainer.innerHTML = '';
          const dayOfWeek = date.getDay();
          const allUsers = await window.api.invoke('get-users');
          const expectedUsers = allUsers.filter(u => u.diasSemana && u.diasSemana.includes(dayOfWeek));

          const presentUserIds = new Set(filteredActivities
            .filter(a => a.type === 'Entrada')
            .map(a => a.userId)
          );

          const absentUsers = expectedUsers.filter(u => !presentUserIds.has(u.id));

          if (absentUsers.length === 0) {
            dailyAbsencesContainer.innerHTML = '<p class="text-[#9badc0] text-base font-normal leading-normal col-span-2 py-3">Todos presentes!</p>';
          } else {
            absentUsers.forEach((user, index) => {
              const isLast = index === absentUsers.length - 1;
              const userHtml = `
            <div class="flex flex-col items-center gap-1 ${index === 0 ? 'pt-3' : ''} ${isLast ? 'pb-3' : ''}">
              ${index > 0 ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2"></div>' : ''}
               <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-6" style="background-image: url('https://i.pravatar.cc/24?u=${user.id}'); border: 2px solid #ef4444;"></div>
              ${!isLast ? '<div class="w-[1.5px] bg-[#3b4c5e] h-2 grow"></div>' : ''}
            </div>
            <div class="flex flex-1 flex-col py-3">
              <p class="text-white text-base font-medium leading-normal">${user.nome}</p>
              <p class="text-[#9badc0] text-base font-normal leading-normal">${user.turma || 'Sem turma'}</p>
            </div>
          `;
              dailyAbsencesContainer.innerHTML += userHtml;
            });
          }
        }
      }

      const btnEditActivities = document.getElementById('edit-activities-btn');
      const editActivityModal = document.getElementById('edit-activity-modal');
      const closeEditActivityModalBtn = document.getElementById('close-edit-activity-modal');
      const editActivityForm = document.getElementById('form-edit-activity');



      if (closeEditActivityModalBtn) {
        closeEditActivityModalBtn.addEventListener('click', () => editActivityModal.classList.add('hidden'));
      }

      async function handleEditActivityClick(event) {
        const button = event.currentTarget;
        const timestamp = button.dataset.timestamp;
        const userId = parseInt(button.dataset.userid, 10);

        const activityToEdit = allActivitiesCache.find(a => a.timestamp === timestamp && a.userId === userId);

        if (!activityToEdit) {
          showCustomAlert('Erro', 'NÃ£o foi possÃ­vel encontrar a atividade para editar.');
          return;
        }

        document.getElementById('edit-activity-original-timestamp').value = activityToEdit.timestamp;
        document.getElementById('edit-activity-user-id').value = activityToEdit.userId;
        document.getElementById('edit-activity-user-name').value = activityToEdit.userName;
        document.getElementById('edit-activity-type').value = activityToEdit.type;

        const localDate = new Date(activityToEdit.timestamp);
        const timezoneOffset = localDate.getTimezoneOffset() * 60000;
        const localISOTime = new Date(localDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
        document.getElementById('edit-activity-timestamp').value = localISOTime;

        editActivityModal.classList.remove('hidden');
      }

      if (editActivityForm) {
        editActivityForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const originalTimestamp = document.getElementById('edit-activity-original-timestamp').value;
          const userId = document.getElementById('edit-activity-user-id').value;

          const newTimestampLocal = document.getElementById('edit-activity-timestamp').value;
          const newTimestampUTC = new Date(newTimestampLocal).toISOString();

          const newData = {
            type: document.getElementById('edit-activity-type').value,
            timestamp: newTimestampUTC
          };

          try {
            const result = await window.api.invoke('update-activity', { originalTimestamp, userId, newData });
            if (result && !result.error) {
              showCustomAlert('Sucesso', 'Atividade atualizada com sucesso.');
              editActivityModal.classList.add('hidden');
              allActivitiesCache = [];
              renderizarTabelaAtividades({ turma: filterTurma.value, mes: filterMes.value });
            } else {
              showCustomAlert('Erro', result ? result.error : 'Falha ao atualizar a atividade.');
            }
          } catch (error) {
            showCustomAlert('Erro', `Erro: ${error.message}`);
          }
        });
      }

      // --- Load Email Settings (New Implementation) ---
      async function loadEmailSettings() {
        try {
          const res = await fetch('/api/settings');
          const settings = await res.json();

          // Update OAuth Status Text
          const oauthStatus = document.getElementById('oauth-status');
          const connectBtn = document.getElementById('connect-google-btn');

          if (settings.oauth_user) {
            if (oauthStatus) {
              oauthStatus.textContent = `Conectado como: ${settings.oauth_user}`;
              oauthStatus.classList.remove('text-zinc-500');
              oauthStatus.classList.add('text-emerald-400', 'font-bold');
            }
            if (connectBtn) connectBtn.textContent = 'Reconectar Conta Google';
          } else {
            if (oauthStatus) {
              oauthStatus.textContent = 'NÃ£o Conectado';
              oauthStatus.classList.remove('text-emerald-400', 'font-bold');
              oauthStatus.classList.add('text-zinc-500');
            }
          }
        } catch (err) {
          console.error('[LoadSettings] Erro:', err);
        }
      }

      // --- Google OAuth Logic ---
      const connectGoogleAuthBtn = document.getElementById('connect-google-btn');
      console.log('[DEBUG] BotÃ£o Google encontrado?', !!connectGoogleAuthBtn);

      if (connectGoogleAuthBtn) {
        connectGoogleAuthBtn.addEventListener('click', async () => {
          console.log('[DEBUG] BotÃ£o Google Clicado!');
          // NÃ£o lÃª mais inputs da tela, confia no servidor ter os dados (client_secret.json)

          connectGoogleAuthBtn.disabled = true;
          connectGoogleAuthBtn.textContent = 'Gerando Link...';

          try {
            const response = await fetch('/api/auth/google/url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-auth-user': 'admin'
              },
              body: JSON.stringify({}) // Envia vazio para forÃ§ar uso do banco
            });

            if (!response.ok) throw new Error('Falha ao gerar URL de autenticaÃ§Ã£o');

            const data = await response.json();
            if (data.url) {
              // Redireciona na mesma aba para evitar bloqueio de pop-up
              window.location.href = data.url;
            } else {
              throw new Error('URL invÃ¡lida recebida do servidor');
            }

          } catch (error) {
            showCustomAlert('Erro', error.message);
          } finally {
            connectGoogleAuthBtn.disabled = false;
            // Restore text based on connection status (simplified here)
            connectGoogleAuthBtn.textContent = 'Conectar Conta Google';
          }
        });
      }


      // --- Manual Frequency Logic (Scoped) ---
      {
        const manualFrequencyBtn = document.getElementById('manual-frequency-btn');
        const manualFrequencyModal = document.getElementById('manual-frequency-modal');
        const closeManualFrequencyModalBtn = document.getElementById('close-manual-frequency-modal');
        const cancelManualFrequencyBtn = document.getElementById('cancel-manual-frequency');
        const manualFrequencyForm = document.getElementById('form-manual-frequency');
        const manualFrequencyUserSearch = document.getElementById('manual-frequency-user-search');
        const manualFrequencyUserId = document.getElementById('manual-frequency-user-id');
        const manualFrequencyUserResults = document.getElementById('manual-frequency-user-results');
        const settingsManualFrequencyBtn = document.getElementById('settings-manual-frequency-btn');

        let manualFrequencyUserList = [];

        const openManualFrequencyModal = async () => {
          if (!manualFrequencyForm) return;
          manualFrequencyForm.reset();
          if (manualFrequencyUserSearch) manualFrequencyUserSearch.value = '';
          if (manualFrequencyUserId) manualFrequencyUserId.value = '';
          if (manualFrequencyUserResults) {
            manualFrequencyUserResults.innerHTML = '';
            manualFrequencyUserResults.classList.add('hidden');
          }

          const now = new Date();
          const timezoneOffset = now.getTimezoneOffset() * 60000;
          const localISOTime = new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
          const tsInput = document.getElementById('manual-frequency-timestamp');
          if (tsInput) tsInput.value = localISOTime;

          if (manualFrequencyModal) manualFrequencyModal.classList.remove('hidden');

          try {
            manualFrequencyUserList = await window.api.invoke('get-users');
            manualFrequencyUserList.sort((a, b) => a.nome.localeCompare(b.nome));
          } catch (error) {
            manualFrequencyUserList = [];
            showCustomAlert('Erro', 'Não foi possível carregar a lista de alunos.');
          }
        };

        const closeManualFrequencyModal = () => {
          if (manualFrequencyModal) manualFrequencyModal.classList.add('hidden');
        };

        if (manualFrequencyBtn) manualFrequencyBtn.addEventListener('click', openManualFrequencyModal);
        if (settingsManualFrequencyBtn) settingsManualFrequencyBtn.addEventListener('click', () => {
          // Logic for settings button specific if needed, else same
          openManualFrequencyModal();
        });

        if (closeManualFrequencyModalBtn) closeManualFrequencyModalBtn.addEventListener('click', closeManualFrequencyModal);
        if (cancelManualFrequencyBtn) cancelManualFrequencyBtn.addEventListener('click', closeManualFrequencyModal);

        if (manualFrequencyUserSearch) {
          manualFrequencyUserSearch.addEventListener('input', () => {
            const query = manualFrequencyUserSearch.value.toLowerCase();
            if (manualFrequencyUserResults) manualFrequencyUserResults.innerHTML = '';

            if (query.length < 2) {
              if (manualFrequencyUserResults) manualFrequencyUserResults.classList.add('hidden');
              return;
            }

            const filteredUsers = manualFrequencyUserList.filter(user =>
              (user.nome && user.nome.toLowerCase().includes(query)) ||
              (user.matricula && user.matricula.toLowerCase().includes(query))
            );

            if (filteredUsers.length > 0 && manualFrequencyUserResults) {
              filteredUsers.forEach(user => {
                const div = document.createElement('div');
                div.className = 'p-2 hover:bg-[#293542] cursor-pointer text-white';
                div.textContent = `${user.nome} (${user.matricula})`;
                div.dataset.id = user.id;
                div.dataset.name = user.nome;
                manualFrequencyUserResults.appendChild(div);
              });
              manualFrequencyUserResults.classList.remove('hidden');
            } else if (manualFrequencyUserResults) {
              manualFrequencyUserResults.classList.add('hidden');
            }
          });

          document.addEventListener('click', (e) => {
            if (manualFrequencyUserResults && !manualFrequencyUserResults.contains(e.target) && e.target !== manualFrequencyUserSearch) {
              manualFrequencyUserResults.classList.add('hidden');
            }
          });
        }

        if (manualFrequencyUserResults) {
          manualFrequencyUserResults.addEventListener('click', (e) => {
            if (e.target && e.target.matches('div.p-2')) {
              manualFrequencyUserSearch.value = e.target.dataset.name;
              manualFrequencyUserId.value = e.target.dataset.id;
              manualFrequencyUserResults.classList.add('hidden');
            }
          });
        }

        if (manualFrequencyForm) {
          manualFrequencyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = manualFrequencyUserId.value;
            const timestampLocal = document.getElementById('manual-frequency-timestamp').value;
            const type = document.getElementById('manual-frequency-type').value;

            if (!userId) {
              showCustomAlert('Erro', 'Por favor, selecione um aluno válido da lista.');
              return;
            }

            const activityData = {
              userId: parseInt(userId, 10),
              timestamp: new Date(timestampLocal).toISOString(),
              type: type,
            };

            try {
              await window.api.invoke('add-manual-activity', activityData);
              showCustomAlert('Sucesso', 'Frequência adicionada manualmente.');
              closeManualFrequencyModal();

              // Refresh Lists
              if (typeof allActivitiesCache !== 'undefined') allActivitiesCache = [];
              if (typeof renderizarTabelaAtividades === 'function') renderizarTabelaAtividades();
              if (typeof renderizarAtividadesRecentes === 'function') renderizarAtividadesRecentes();
              if (typeof atualizarCardsDashboard === 'function') atualizarCardsDashboard();

              const activityDate = new Date(activityData.timestamp);
              if (typeof selectedDay !== 'undefined' && selectedDay === activityDate.getDate() && selectedMonth === activityDate.getMonth() && selectedYear === activityDate.getFullYear()) {
                if (typeof renderizarAtividadesPorData === 'function') renderizarAtividadesPorData(activityDate);
              }
            } catch (error) {
              showCustomAlert('Erro', `Falha ao adicionar frequência: ${error.message}`);
            }
          });
        }
      }

      listarPortasSeriais();
      renderizarTabelaUsuarios();
      renderizarTabelaAtividades();
      renderizarAtividadesRecentes();
      atualizarCardsDashboard();

      if (selectedDay === null || selectedMonth === null || selectedYear === null) {
        const today = new Date();
        selectedDay = today.getDate();
        selectedMonth = today.getMonth();
        selectedYear = today.getFullYear();
      }

      renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));

      window.api.receive('web-server-started', (data) => {
        console.log(`Servidor web acessÃ­vel em: http://${data.ipAddress}:${data.port}`);
        showCustomAlert('Servidor Web', `Interface web acessÃ­vel em: http://${data.ipAddress}:${data.port}`);
      });
      // --- Event Listeners para os novos botÃµs da pÃ¡gina de ConfiguraÃ§Ãµes ---
      const settingsSyncUsersBtn = document.getElementById('settings-sync-users-btn');
      const settingsRemoveDuplicatesBtnLocal = document.getElementById('settings-remove-duplicates-btn');

      if (settingsSyncUsersBtn) {
        settingsSyncUsersBtn.addEventListener('click', async () => {
          const confirmed = await showCustomConfirm(
            'Sincronizar com Sensor',
            'Esta aÃ§Ã£o buscarÃ¡ por digitais cadastradas diretamente no sensor e as importarÃ¡ para o aplicativo. Deseja continuar?'
          );

          if (confirmed) {
            showCustomAlert('Sincronizando...', 'Buscando por novos usuÃ¡rios no sensor. Isso pode levar alguns segundos.');
            try {
              const result = await window.api.invoke('sync-from-sensor');
              await showCustomAlert(
                'SincronizaÃ§Ã£o ConcluÃ­da',
                `${result.newUsers} novo(s) usuÃ¡rio(s) foram importados. O sensor possui um total de ${result.totalSensor} digitais.`
              );
              renderizarTabelaUsuarios();
            } catch (error) {
              await showCustomAlert('Erro de SincronizaÃ§Ã£o', error.message);
            }
          }
        });
      }

      if (settingsRemoveDuplicatesBtnLocal) {
        settingsRemoveDuplicatesBtnLocal.addEventListener('click', async () => {
          const confirmed = await showCustomConfirm('Remover Duplicados', 'Esta aÃ§Ã£o irÃ¡ verificar todos os usuÃ¡rios e remover aqueles com matrÃ­culas duplicadas, mantendo apenas a primeira ocorrÃªncia encontrada. Deseja continuar?');
          if (confirmed) {
            try {
              const result = await window.api.invoke('remove-duplicates');
              await showCustomAlert('Sucesso', `${result.count} usuÃ¡rio(s) duplicado(s) removido(s).`);
              renderizarTabelaUsuarios();
            } catch (error) {
              await showCustomAlert('Erro', `Erro ao remover duplicados: ${error.message}`);
            }
          }
        });
      }

      // --- AI Chat Logic ---
      const toggleAiChatBtn = document.getElementById('toggle-ai-chat');
      const closeAiChatBtn = document.getElementById('close-ai-chat');
      const aiChatWindow = document.getElementById('ai-chat-window');
      const aiInput = document.getElementById('ai-input');
      const aiSendBtn = document.getElementById('ai-send-btn');
      const aiMessages = document.getElementById('ai-messages');

      if (toggleAiChatBtn && aiChatWindow) {
        toggleAiChatBtn.addEventListener('click', () => {
          aiChatWindow.classList.toggle('hidden');
          if (!aiChatWindow.classList.contains('hidden')) {
            aiInput.focus();
            if (aiMessages) aiMessages.scrollTop = aiMessages.scrollHeight;

            // Renderiza sugestÃµes se o chat estiver vazio
            if (aiMessages.children.length === 0) {
              const suggestions = [
                "Quem faltou hoje?",
                "Quem atende [Nome]?",
                "Resumo do dia",
                "Status do Sistema"
              ];

              const chipsContainer = document.createElement('div');
              chipsContainer.className = 'flex flex-wrap gap-2 p-2 justify-center mb-4';
              suggestions.forEach(sug => {
                const chip = document.createElement('button');
                chip.className = 'text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-full hover:bg-indigo-500/40 transition-colors';
                chip.textContent = sug;
                chip.onclick = () => {
                  aiInput.value = sug.replace('[Nome]', '').trim();
                  aiInput.focus();
                };
                chipsContainer.appendChild(chip);
              });

              const welcomeDiv = document.createElement('div');
              welcomeDiv.className = 'flex flex-col gap-2 items-center text-zinc-500 text-xs mt-4 mb-2';
              welcomeDiv.innerHTML = '<span>Experimente perguntar:</span>';
              welcomeDiv.appendChild(chipsContainer);
              aiMessages.appendChild(welcomeDiv);
            }
          }
        });
      }

      if (closeAiChatBtn) {
        closeAiChatBtn.addEventListener('click', () => {
          aiChatWindow.classList.add('hidden');
        });
      }

      async function sendAiMessage() {
        const text = aiInput.value.trim();
        if (!text) return;

        // 1. User Message
        const userDiv = document.createElement('div');
        userDiv.className = 'flex flex-col gap-1 items-end max-w-[85%] self-end';
        userDiv.innerHTML = `
      <div class="bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm shadow-sm">
        ${text}
      </div>
      <span class="text-[10px] text-zinc-600 mr-1">VocÃª</span>
    `;
        aiMessages.appendChild(userDiv);

        aiInput.value = '';
        aiInput.disabled = true;
        aiSendBtn.disabled = true;
        aiMessages.scrollTop = aiMessages.scrollHeight;

        // 2. Loading Indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex flex-col gap-1 items-start max-w-[85%] loading-bubble';
        loadingDiv.innerHTML = `
       <div class="bg-zinc-800 border border-white/5 text-zinc-400 px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-sm flex items-center gap-2">
         <span class="animate-pulse">Pensando...</span>
       </div>
    `;
        aiMessages.appendChild(loadingDiv);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        try {
          const response = await window.api.invoke('ai-query', text);

          loadingDiv.remove();

          // 3. AI Response (Simple Formatting)
          const formattedResponse = response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

          const aiDiv = document.createElement('div');
          aiDiv.className = 'flex flex-col gap-1 items-start max-w-[85%]';
          aiDiv.innerHTML = `
        <div class="bg-zinc-800 border border-white/5 text-zinc-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-sm leading-relaxed">
          ${formattedResponse}
        </div>
        <span class="text-[10px] text-zinc-600 ml-1">Veritas AI</span>
      `;
          aiMessages.appendChild(aiDiv);

        } catch (error) {
          loadingDiv.remove();
          const errorDiv = document.createElement('div');
          errorDiv.className = 'flex flex-col gap-1 items-start max-w-[85%]';
          errorDiv.innerHTML = `
        <div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-sm">
          Erro ao processar mensagem.
        </div>
      `;
          aiMessages.appendChild(errorDiv);
        } finally {
          aiInput.disabled = false;
          aiSendBtn.disabled = false;
          aiInput.focus();
          aiMessages.scrollTop = aiMessages.scrollHeight;
        }
      }

      if (aiSendBtn) {
        aiSendBtn.addEventListener('click', sendAiMessage);
      }

      if (aiInput) {
        aiInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            sendAiMessage();
          }
        });
      }


      async function initCharts() {
        const weeklyCtx = document.getElementById('chart-weekly');
        const dailyCtx = document.getElementById('chart-daily');

        if (!weeklyCtx || !dailyCtx) return;

        try {
          if (typeof Chart === 'undefined') {
            console.warn('Chart.js não carregado (Modo Offline?). Gráficos desativados.');
            return;
          }

          // 1. Fetch Data
          const [weeklyRes, usersRes] = await Promise.all([
            fetch('/api/stats/weekly'),
            fetch('/api/users')
          ]);

          const weeklyData = await weeklyRes.json();
          const users = await usersRes.json();
          const totalUsers = users.length;

          // 2. Process Data
          const todayStats = weeklyData[weeklyData.length - 1]; // Ãšltimo dia (Hoje)
          const presentToday = todayStats ? todayStats.count : 0;
          const absentToday = Math.max(0, totalUsers - presentToday);
          const presencePercentage = totalUsers > 0 ? Math.round((presentToday / totalUsers) * 100) : 0;

          // 3. Update UI Cards
          const elPresenca = document.getElementById('presenca-hoje');
          const elAusentes = document.getElementById('ausentes-hoje');
          const elTotal = document.getElementById('total-alunos');
          const elChartText = document.getElementById('chart-total-text');

          if (elPresenca) elPresenca.textContent = presentToday;
          if (elAusentes) elAusentes.textContent = absentToday;
          if (elTotal) elTotal.textContent = totalUsers;
          if (elChartText) elChartText.textContent = `${presencePercentage}%`;

          // 4. Render Weekly Chart (Line)
          new Chart(weeklyCtx.getContext('2d'), {
            type: 'line',
            data: {
              labels: weeklyData.map(d => {
                const part = d.date.split('-');
                return `${part[2]}/${part[1]}`; // dd/mm
              }),
              datasets: [{
                label: 'Alunos Presentes',
                data: weeklyData.map(d => d.count),
                borderColor: '#6366f1', // Indigo 500
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#18181b',
                pointBorderColor: '#6366f1',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#27272a',
                  titleColor: '#e4e4e7',
                  bodyColor: '#e4e4e7',
                  padding: 10,
                  cornerRadius: 8,
                  displayColors: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgba(255, 255, 255, 0.05)' },
                  ticks: { color: '#71717a', stepSize: 1 }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#71717a' }
                }
              }
            }
          });

          // 5. Render Daily Chart (Doughnut)
          new Chart(dailyCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: ['Presentes', 'Ausentes'],
              datasets: [{
                data: [presentToday, absentToday],
                backgroundColor: ['#6366f1', '#27272a'], // Indigo 500, Zinc 800
                borderWidth: 0,
                hoverOffset: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '75%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#27272a',
                  bodyColor: '#e4e4e7',
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${ctx.raw}`
                  }
                }
              }
            }
          });

        } catch (err) {
          console.error("Erro ao carregar Dashboard:", err);
        }
      }

      // --- Dashboard AI Search Logic ---
      async function initDashboardAI() {
        const aiInput = document.getElementById('dashboard-ai-input');
        const resultCard = document.getElementById('ai-result-area');
        const resultContent = document.getElementById('ai-result-content');
        const closeResultBtn = document.getElementById('close-ai-result');
        const loadingIndicator = document.getElementById('ai-loading-indicator');
        const chipsContainer = document.getElementById('dashboard-chips');

        if (!aiInput) return;

        // 1. Suggestion Chips
        const suggestions = [
          "Quem faltou hoje?",
          "Quem atende [Nome]?",
          "Resumo do dia",
          "Status do Sistema"
        ];

        if (chipsContainer) {
          chipsContainer.innerHTML = '';
          suggestions.forEach(sug => {
            const chip = document.createElement('button');
            chip.className = 'text-xs bg-zinc-800 border border-white/5 text-zinc-500 px-3 py-1.5 rounded-full hover:bg-zinc-700 hover:text-zinc-300 transition-all';
            chip.textContent = sug;
            chip.onclick = () => {
              aiInput.value = sug.replace('[Nome]', '').trim();
              aiInput.focus();
            };
            chipsContainer.appendChild(chip);
          });
        }

        // 2. Search Handler
        // 2. Search Handler
        const performSearch = async () => {
          const text = aiInput.value.trim();
          if (!text) return;

          // Show loading
          if (loadingIndicator) loadingIndicator.classList.remove('hidden');
          const aiSearchBox = document.getElementById('ai-search-box');
          if (aiSearchBox) aiSearchBox.classList.add('ai-loading');
          aiInput.disabled = true;

          try {
            // 1.5s minimum delay for animation
            const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

            const [response] = await Promise.all([
              window.api.invoke('ai-query', text),
              minLoadTime
            ]);

            // Format response (Enhanced Markdown)
            let formatted = response
              // 1. Sanitize HTML (Basic)
              .replace(/</g, '&lt;').replace(/>/g, '&gt;')
              // 2. Bold (**text**)
              .replace(/\*\*(.*?)\*\*/g, '<span class="text-indigo-400 font-bold">$1</span>')
              // 3. Lists (- item) -> Wrapped in a div for spacing
              .replace(/^- (.*$)/gm, '<div class="flex gap-2 ml-4 my-1"><span class="text-indigo-500">•</span><span>$1</span></div>')
              // 4. Headings (### Title)
              .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
              // 5. Tables (Simple rendering for Markdown tables)
              // This is a naive implementation, but helps with structure
              .replace(/\|/g, '<span class="text-zinc-600 mx-1">|</span>') 
              // 6. Newlines
              .replace(/\n/g, '<br>');

            // Show Result
            if (resultContent) resultContent.innerHTML = formatted;
            if (resultContent) resultContent.className = 'text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none';
            if (resultCard) {
              resultCard.classList.remove('hidden');

              // Connect UI
              const container = document.getElementById('ai-search-container');
              if (container) container.classList.add('ai-connected');

              // Animation fix
              requestAnimationFrame(() => {
                resultCard.classList.add('opacity-100', 'translate-y-0');
              });
            }

          } catch (error) {
            console.error(error);
            if (resultContent) resultContent.innerHTML = '<span class="text-red-400">Erro ao consultar a IA. Tente novamente.</span>';
            if (resultCard) resultCard.classList.remove('hidden');
          } finally {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            const aiSearchBox = document.getElementById('ai-search-box');
            if (aiSearchBox) aiSearchBox.classList.remove('ai-loading');
            aiInput.disabled = false;
            aiInput.focus();
          }
        };

        aiInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') performSearch();
        });

        if (closeResultBtn) {
          closeResultBtn.addEventListener('click', () => {
            if (resultCard) {
              resultCard.classList.add('hidden');
              const container = document.getElementById('ai-search-container');
              if (container) container.classList.remove('ai-connected');
            }
            aiInput.value = '';
          });
        }
      }


      // Alias para compatibilidade com chamadas antigas
      async function atualizarCardsDashboard() {
        await initCharts();
      }

      document.addEventListener('DOMContentLoaded', () => {
        initCharts();
        initDashboardAI();
        loadEmailSettings();


        // --- Smart Year Selection Logic ---
        const monthSelect = document.getElementById('filter-mes-select');
        const yearInput = document.getElementById('filter-ano-input');

        if (monthSelect && yearInput) {
          const today = new Date();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth() + 1;

          // Set default year
          if (!yearInput.value) yearInput.value = currentYear;

          monthSelect.addEventListener('change', () => {
            if (!monthSelect.value) return;
            const selectedMonth = parseInt(monthSelect.value, 10);
            const yearValue = parseInt(yearInput.value, 10);

            if (selectedMonth > currentMonth) {
              if (yearValue === currentYear) yearInput.value = currentYear - 1;
            } else {
              if (yearValue === currentYear - 1) yearInput.value = currentYear;
            }
          });
        }
      });
    })();
  }
}
