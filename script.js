document.addEventListener('DOMContentLoaded', () => {
  // --- Funcionalidade da Navegação Lateral ---
  const navItems = document.querySelectorAll('#sidebar-nav .nav-item');
  const dashboardSection = document.getElementById('dashboard-section');
  const settingsSection = document.getElementById('settings-section');
  const usuariosSection = document.getElementById('usuarios-section');
  const atividadesSection = document.getElementById('atividades-section');
  const ajudaSection = document.getElementById('ajuda-section');
  const dailySummarySection = document.getElementById('daily-summary-section'); // Nova referência

  navItems.forEach((item, idx) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove 'active' de todos os itens de navegação
      navItems.forEach((el) => el.classList.remove('active', 'bg-[#293542]'));
      // Adiciona 'active' ao item clicado
      item.classList.add('active', 'bg-[#293542]');
      
      // Esconde todas as seções e mostra a relevante
      dashboardSection.classList.add('hidden');
      settingsSection.classList.add('hidden');
      usuariosSection.classList.add('hidden');
      atividadesSection.classList.add('hidden');
      ajudaSection.classList.add('hidden');
      dailySummarySection.classList.add('hidden'); // Esconde a nova seção por padrão

      if (item.textContent.includes('Configurações')) {
        settingsSection.classList.remove('hidden');
        listarPortasSeriais();
      } else if (item.textContent.includes('Usuários')) {
        usuariosSection.classList.remove('hidden');
        renderizarTabelaUsuarios();
      } else if (item.textContent.includes('Atividade')) {
        atividadesSection.classList.remove('hidden');
        renderizarTabelaAtividades();
      } else if (item.textContent.includes('Ajuda')) {
        ajudaSection.classList.remove('hidden');
      } else { // Início (Dashboard)
        dashboardSection.classList.remove('hidden');
      }
    });
  });

  // --- Funcionalidade do Calendário (4x3 fixo) ---
  const monthYearEl = document.getElementById('month-year');
  const calendarGrid = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  let currentDate = new Date();

  let selectedDay = null;
  let selectedMonth = null;
  let selectedYear = null;

  const dailyActivitiesTitle = document.getElementById('daily-activities-title');
  const dailyActivitiesContainer = document.getElementById('daily-activities-container');

  const renderCalendar = () => {
    calendarGrid.innerHTML = '';
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    weekDays.forEach(dia => {
      const th = document.createElement('div');
      th.className = 'text-white text-center font-bold';
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
      dayButton.className = 'calendar-day h-12 w-12 text-white text-sm font-medium leading-normal';
      dayButton.innerHTML = `<div class="flex size-full items-center justify-center rounded-full">${day}</div>`;
      
      const isToday = (day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear());
      let isActiveSelection = (selectedDay === day && selectedMonth === month && selectedYear === year);

      if (selectedDay === null && isToday) { // Seleciona o dia atual por padrão se nenhuma seleção prévia
        selectedDay = day;
        selectedMonth = month;
        selectedYear = year;
        isActiveSelection = true;
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
        renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay)); // Renderiza atividades para a data clicada
      });
      calendarGrid.appendChild(dayButton);
    }
  };
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
  renderCalendar();

  // --- Cadastro de Aluno: abrir/fechar modal ---
  const btnAddUser = document.getElementById('add-user-btn');
  const modalCadastro = document.getElementById('cadastro-aluno');
  const btnFecharCadastro = document.getElementById('fechar-cadastro');
  const formAluno = document.getElementById('form-aluno');
  const statusDiv = document.getElementById('status-biometria');
  const btnSalvar = formAluno.querySelector('button[type="submit"]');
  const modalTitle = document.getElementById('modal-title');
  const alunoIdInput = document.getElementById('aluno-id');
  const deleteUserModalBtn = document.getElementById('delete-user-modal-btn');

  // --- Modal de Alerta/Confirmação Customizado ---
  const customAlertModal = document.getElementById('custom-alert-modal');
  const customAlertTitle = document.getElementById('custom-alert-title');
  const customAlertMessage = document.getElementById('custom-alert-message');
  const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
  const customAlertCancelBtn = document.getElementById('custom-alert-cancel-btn');

  function showCustomAlert(title, message) {
    return new Promise(resolve => {
      customAlertTitle.textContent = title;
      customAlertMessage.textContent = message;
      customAlertCancelBtn.classList.add('hidden'); // Esconde o botão Cancelar para alertas
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
      customAlertMessage.innerHTML = ''; // Limpa o conteúdo

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
    const users = await ipcRenderer.invoke('get-users');
    const user = users.find(u => u.id === userId);
    if (!user) {
      await showCustomAlert('Erro', 'Usuário não encontrado!');
      return;
    }

    formAluno.reset();
    alunoIdInput.value = user.id;
    formAluno.nome.value = user.nome || '';
    formAluno.matricula.value = user.matricula || '';
    formAluno.turma.value = user.turma || '';
    formAluno.email.value = user.email || '';
    formAluno.genero.value = user.genero || '';
    formAluno.cabine.value = user.cabine || '';
    
    // Marca os checkboxes dos dias da semana
    const diasSemanaCheckboxes = formAluno.querySelectorAll('input[name="dias-semana"]');
    diasSemanaCheckboxes.forEach(checkbox => {
      checkbox.checked = user.diasSemana && user.diasSemana.includes(parseInt(checkbox.value));
    });

    modalTitle.textContent = 'Editar Aluno';
    statusDiv.textContent = ''; // Removido o aviso
    statusDiv.className = ''; // Limpa a classe para remover estilo de aviso
    btnSalvar.disabled = false; // Habilita o botão para salvar
    deleteUserModalBtn.classList.remove('hidden'); // Mostra o botão de excluir
    
    modalCadastro.classList.remove('hidden');
  }

  function abrirModalCadastro() {
    if (modalCadastro) {
      formAluno.reset();
      alunoIdInput.value = ''; // Limpa o ID para garantir que está em modo de adição
      modalTitle.textContent = 'Adicionar Aluno';
      statusDiv.textContent = 'Preencha os dados do aluno e siga as instruções para o cadastro da digital.';
      statusDiv.className = 'text-white text-base font-medium mb-2';
      btnSalvar.disabled = false;
      deleteUserModalBtn.classList.add('hidden'); // Esconde o botão de excluir
      modalCadastro.classList.remove('hidden');
    }
  }

  function fecharModalCadastro() {
    if (modalCadastro) modalCadastro.classList.add('hidden');
  }

  if (btnAddUser) btnAddUser.addEventListener('click', abrirModalCadastro);
  if (btnFecharCadastro) btnFecharCadastro.addEventListener('click', fecharModalCadastro);
  
  // Lógica de busca e preenchimento automático no modal de cadastro
  const searchByNameBtn = document.getElementById('search-by-name');
  const searchByMatriculaBtn = document.getElementById('search-by-matricula');

  async function searchAndFill(type) {
    const query = formAluno[type].value;
    if (!query) {
        showCustomAlert('Aviso', `Por favor, digite um(a) ${type} para buscar.`);
        return;
    }
    const result = await ipcRenderer.invoke('search-student-data', { query, type });

    if (result && result.error) {
        showCustomAlert('Erro', `Erro ao ler a planilha: ${result.error}`);
    } else if (result) {
        formAluno.nome.value = result.aluno || '';
        formAluno.matricula.value = result.matricula || '';
        formAluno.turma.value = result.turma || '';
        formAluno.email.value = result.email || '';
        formAluno.genero.value = result.genero || '';
        formAluno.cabine.value = result.cabine || '';
        showCustomAlert('Sucesso', 'Dados do aluno preenchidos.');
    } else {
        showCustomAlert('Não encontrado', 'Nenhum aluno encontrado com os dados fornecidos. Prossiga com o cadastro manual.');
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
      email: formData.get('email'),
      genero: formData.get('genero'),
      cabine: formData.get('cabine'),
      diasSemana,
    };

    if (id) {
      // --- MODO EDIÇÃO ---
      try {
        await ipcRenderer.invoke('update-user', { id, data: userData });
        await showCustomAlert('Sucesso!', 'Usuário atualizado com sucesso!');
        fecharModalCadastro();
        renderizarTabelaUsuarios();
      } catch (error) {
        await showCustomAlert('Erro', `Erro ao atualizar: ${error.message}`);
        btnSalvar.disabled = false;
      }
    } else {
      // --- MODO ADIÇÃO ---
      statusDiv.textContent = 'Iniciando processo de cadastro...';
      try {
        const result = await ipcRenderer.invoke('add-user-and-enroll', { userData });
        if (result.error) {
          await showCustomAlert('Erro', result.error);
          btnSalvar.disabled = false;
        } else if (result.status === 'success') {
            // A mensagem de sucesso já é enviada pelo listener 'biometria-status'
            // Apenas fechamos o modal e atualizamos a tabela.
            fecharModalCadastro();
            renderizarTabelaUsuarios(); // Atualiza a tabela principal
            await showCustomAlert('Sucesso!', `Usuário ${result.user.nome} cadastrado com ID ${result.user.id}.`);
        }
      } catch (error) {
        // O erro já é exibido pelo listener 'biometria-status'
        // Apenas reabilitamos o botão
        btnSalvar.disabled = false;
      }
    }
  });

  // Listener para o botão de exclusão dentro do modal
  if (deleteUserModalBtn) {
    deleteUserModalBtn.addEventListener('click', async () => {
      const userId = parseInt(alunoIdInput.value, 10);
      const confirmed = await showCustomConfirm('Confirmação', `Tem certeza que deseja excluir o usuário com ID ${userId} do banco de dados e do sensor?`);
      if (confirmed) {
        try {
          const result = await ipcRenderer.invoke('delete-user', userId);
          await showCustomAlert('Sucesso!', result.message);
          fecharModalCadastro();
          renderizarTabelaUsuarios();
        } catch (error) {
          await showCustomAlert('Erro', `Erro ao excluir usuário: ${error.message}`);
        }
      }
    });
  }

  // --- Comunicação com Main Process ---
  const { ipcRenderer } = require('electron');

  // Controle do Buzzer
  const toggleBuzzer = document.getElementById('toggle-buzzer');

  function setBuzzerState(enabled) {
    ipcRenderer.invoke('set-buzzer-state', enabled);
    localStorage.setItem('buzzerEnabled', enabled);
    toggleBuzzer.checked = enabled;
  }

  if (toggleBuzzer) {
    toggleBuzzer.addEventListener('change', () => {
      setBuzzerState(toggleBuzzer.checked);
    });

    // Carrega o estado salvo ao iniciar
    const savedBuzzerState = localStorage.getItem('buzzerEnabled') !== 'false'; // Padrão é true
    toggleBuzzer.checked = savedBuzzerState;
    // Não envia o estado aqui, espera a conexão serial
  }

  // Listener para quando a porta serial é conectada com sucesso
  ipcRenderer.on('serial-port-connected', () => {
    // Envia o estado atual do buzzer para o dispositivo assim que ele se conecta
    if (toggleBuzzer) {
      setBuzzerState(toggleBuzzer.checked);
    }
  });

  // Listener para atualizações em tempo real
  ipcRenderer.on('nova-atividade', (event, data) => {
    // Atualiza as seções de atividade e dashboard
    renderizarTabelaAtividades();
    renderizarAtividadesRecentes();
    renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-added', (event, data) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-updated', (event, data) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('user-deleted', (event, userId) => {
    // Atualiza a tabela de usuários e o dashboard
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('users-cleared', () => {
    renderizarTabelaUsuarios();
    atualizarCardsDashboard();
  });

  ipcRenderer.on('activities-cleared', () => {
    // Atualiza as seções de atividade e dashboard
    renderizarTabelaAtividades();
    renderizarAtividadesRecentes();
    renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay));
    atualizarCardsDashboard();
  });

  // Listener para o fluxo de cadastro
  ipcRenderer.on('biometria-status', (event, data) => {
    if (!statusDiv) return;
    statusDiv.textContent = data.message;
    if (data.status === 'error') {
      statusDiv.className = 'text-red-400 text-base font-bold mb-2';
      btnSalvar.disabled = false;
    } else if (data.status === 'success') {
      statusDiv.className = 'text-green-400 text-base font-bold mb-2';
      // Não fecha o modal automaticamente para sucesso no cadastro biométrico
      // Apenas mostra a mensagem de sucesso e o usuário pode fechar manualmente
    } else {
      statusDiv.className = 'text-white text-base font-medium mb-2';
    }
  });

  // --- Renderização das Tabelas e Listas ---
  async function renderizarAtividadesRecentes() {
    const container = document.getElementById('recent-activities-container');
    if (!container) return;

    const allActivities = await ipcRenderer.invoke('get-activities');
    // Pega as últimas 3 atividades
    const recentActivities = allActivities.slice(-3).reverse();

    container.innerHTML = ''; // Limpa o conteúdo atual

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
    let atividades = await ipcRenderer.invoke('get-activities');
    
    // Aplica filtros
    if (filters.turma) {
      atividades = atividades.filter(a => a.userTurma === filters.turma);
    }
    if (filters.mes) {
      atividades = atividades.filter(a => {
        const activityDate = new Date(a.timestamp);
        const filterDate = new Date(filters.mes);
        return activityDate.getMonth() === filterDate.getMonth() && activityDate.getFullYear() === filterDate.getFullYear();
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
        if (!record.entrada || activityTime < record.entrada) {
          record.entrada = activityTime;
        }
      } else if (a.type === 'SAIDA') {
        if (!record.saida || activityTime > record.saida) {
          record.saida = activityTime;
        }
      }
    });

    const sortedRecords = Object.values(dailyRecords).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;
      return a.userName.localeCompare(b.userName);
    });

    let lastDate = null;
    sortedRecords.forEach(r => {
      if (r.date !== lastDate) {
        const dateHeader = document.createElement('tr');
        dateHeader.innerHTML = `<td colspan="4" class="bg-[#182634] text-white p-2 font-bold">${r.date}</td>`;
        tbody.appendChild(dateHeader);
        lastDate = r.date;
      }

      const tr = document.createElement('tr');
      tr.className = 'border-t border-t-[#314c68]';
      const entradaStr = r.entrada ? r.entrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
      const saidaStr = r.saida ? r.saida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
      tr.innerHTML = `
          <td class="h-[72px] px-4 py-2 text-white text-sm font-normal">${r.userName}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${r.userTurma}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${entradaStr}</td>
          <td class="h-[72px] px-4 py-2 text-[#9badc0] text-sm font-normal">${saidaStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  let deleteMode = false;

  async function renderizarTabelaUsuarios(filtro = "") {
    const tbody = document.getElementById('usuarios-tbody');
    const alunos = await ipcRenderer.invoke('get-users');
    
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
      0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb'
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

    // Adiciona os event listeners para os novos botões de editar
    document.querySelectorAll('.edit-user-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
        abrirModalEdicao(userId);
      });
    });

  }
  
  // --- Configurações: Serial ---
  const saveBtn = document.getElementById('save-serial-settings');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const porta = document.getElementById('select-serial-port').value;
      if (porta) {
        try {
          await ipcRenderer.invoke('setar-porta-serial', porta);
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

  async function listarPortasSeriais() {
    const select = document.getElementById('select-serial-port');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a porta serial do ESP</option>';
    const portas = await ipcRenderer.invoke('listar-portas');
    portas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = `${p.path} - ${p.manufacturer || 'N/A'}`;
      select.appendChild(opt);
    });
    const portaSalva = localStorage.getItem('porta-esp');
    if (portaSalva) {
      select.value = portaSalva;
      // Tenta reconectar automaticamente
      saveBtn.click();
    }
  }

  function atualizarStatusSerial(conectado) {
    const status = document.getElementById('status-serial');
    if (!status) return;
    status.className = 'size-3 rounded-full ' + (conectado ? 'bg-green-500' : 'bg-red-500');
  }

  // Busca de Usuários
  const searchAluno = document.getElementById('search-aluno');
  if (searchAluno) {
    searchAluno.addEventListener('input', (e) => {
      renderizarTabelaUsuarios(e.target.value);
    });
  }

  // Seleção de pasta para Excel
  const selectExcelPathBtn = document.getElementById('select-excel-path-btn');
  const excelPathDisplay = document.getElementById('excel-path-display');

  if (selectExcelPathBtn) {
    selectExcelPathBtn.addEventListener('click', async () => {
      const path = await ipcRenderer.invoke('select-csv-path');
      if (path) {
        localStorage.setItem('excel-export-path', path);
        excelPathDisplay.value = path;
      }
    });
  }

  // Carregar caminho salvo
  const savedExcelPath = localStorage.getItem('excel-export-path');
  if (savedExcelPath && excelPathDisplay) {
    excelPathDisplay.value = savedExcelPath;
    ipcRenderer.send('set-csv-path', savedExcelPath); // Envia o caminho para o main process
  }

  // Seleção de planilha de dados de alunos
  const selectStudentDataBtn = document.getElementById('select-student-data-path-btn');
  const studentDataPathDisplay = document.getElementById('student-data-path-display');

  if (selectStudentDataBtn) {
    selectStudentDataBtn.addEventListener('click', async () => {
      const path = await ipcRenderer.invoke('select-student-data-path');
      if (path) {
        localStorage.setItem('student-data-path', path);
        studentDataPathDisplay.value = path;
        await showCustomAlert('Sucesso', 'Planilha de dados dos alunos selecionada.');
      }
    });
  }

  // Carregar caminho da planilha salvo
  const savedStudentDataPath = localStorage.getItem('student-data-path');
  if (savedStudentDataPath && studentDataPathDisplay) {
    studentDataPathDisplay.value = savedStudentDataPath;
    // Não precisa enviar para o main process na inicialização, o main process vai ler quando precisar
  }

  // Menu de Opções de Usuário
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenuDropdown = document.getElementById('user-menu-dropdown');
  const deleteUsersMenuItem = document.getElementById('delete-users-menu-item');
  const removeDuplicatesMenuItem = document.getElementById('remove-duplicates-menu-item');

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
      renderizarTabelaUsuarios(); // Re-renderiza a tabela para mostrar/ocultar checkboxes

      // Adiciona um botão para confirmar a exclusão
      const header = document.querySelector('#usuarios-section .p-4');
      let actionContainer = document.getElementById('delete-action-container');

      if (deleteMode && !actionContainer) {
        // Oculta os botões principais e mostra os de ação de exclusão
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
          // Mostra os botões principais novamente
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
            await showCustomAlert('Aviso', 'Nenhum usuário selecionado para exclusão.');
            return;
          }

          const confirmed = await showCustomConfirm('Confirmação', `Tem certeza que deseja excluir ${userIdsToDelete.length} usuário(s)?`);
          if (confirmed) {
            try {
              for (const userId of userIdsToDelete) {
                await ipcRenderer.invoke('delete-user', userId);
              }
              await showCustomAlert('Sucesso!', `${userIdsToDelete.length} usuário(s) excluído(s) com sucesso.`);
              exitDeleteMode();
            } catch (error) {
              await showCustomAlert('Erro', `Erro ao excluir usuários: ${error.message}`);
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
      const confirmed = await showCustomConfirm('Remover Duplicados', 'Esta ação irá verificar todos os usuários e remover aqueles com matrículas duplicadas, mantendo apenas a primeira ocorrência encontrada. Deseja continuar?');
      if (confirmed) {
        try {
          const result = await ipcRenderer.invoke('remove-duplicates');
          await showCustomAlert('Sucesso', `${result.count} usuário(s) duplicado(s) removido(s).`);
          renderizarTabelaUsuarios();
        } catch (error) {
          await showCustomAlert('Erro', `Erro ao remover duplicados: ${error.message}`);
        }
      }
    });
  }

  

  // Funcionalidade dos Cards do Dashboard
  const dashboardCards = document.querySelectorAll('.dashboard-card');
  dashboardCards.forEach(card => {
    card.addEventListener('click', async (e) => {
      const target = e.currentTarget.dataset.target;
      // Ativa a seção de usuários
      navItems.forEach((el) => el.classList.remove('active', 'bg-[#293542]'));
      const usuariosNavItem = document.querySelector('.nav-item:nth-child(3)'); // "Usuários" é o terceiro item
      // Esconde todas as seções e mostra a relevante
      dashboardSection.classList.add('hidden');
      settingsSection.classList.add('hidden');
      usuariosSection.classList.add('hidden');
      atividadesSection.classList.add('hidden');
      ajudaSection.classList.add('hidden');
      dailySummarySection.classList.add('hidden'); // Esconde a nova seção

      // Ativa o item de navegação correspondente (se houver)
      let activeNavItem = null;

      if (target === 'presentes') {
        dailySummarySection.classList.remove('hidden');
        renderizarDailySummary('presentes');
        activeNavItem = document.querySelector('.nav-item:nth-child(1)'); // "Início"
      } else if (target === 'ausentes') {
        dailySummarySection.classList.remove('hidden');
        renderizarDailySummary('ausentes');
        activeNavItem = document.querySelector('.nav-item:nth-child(1)'); // "Início"
      } else if (target === 'todos') {
        usuariosSection.classList.remove('hidden');
        renderizarTabelaUsuarios();
        activeNavItem = document.querySelector('.nav-item:nth-child(3)'); // "Usuários"
      }

      if (activeNavItem) {
        activeNavItem.classList.add('active', 'bg-[#293542]');
      }
    });
  });

  // Exportar Atividades
  const btnExportActivities = document.getElementById('export-activities-btn');
  if (btnExportActivities) {
    btnExportActivities.addEventListener('click', async () => {
      try {
        const filters = {
          turma: filterTurma.value,
          mes: filterMes.value
        };
        const result = await ipcRenderer.invoke('export-activities-excel', filters);
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

  // Filtros de Atividades
  const filterTurma = document.getElementById('filter-turma');
  const filterMes = document.getElementById('filter-mes');
  const btnClearFilters = document.getElementById('clear-filters-btn');

  if(filterTurma) {
    // Popula o select de turmas
    ipcRenderer.invoke('get-users').then(users => {
      const turmas = [...new Set(users.map(u => u.turma))];
      turmas.forEach(turma => {
        if(turma) {
          const option = document.createElement('option');
          option.value = turma;
          option.textContent = turma;
          filterTurma.appendChild(option);
        }
      });
    });

    filterTurma.addEventListener('change', () => {
      renderizarTabelaAtividades({ turma: filterTurma.value, mes: filterMes.value });
    });
  }

  if(filterMes) {
    filterMes.addEventListener('change', () => {
      renderizarTabelaAtividades({ turma: filterTurma.value, mes: filterMes.value });
    });
  }

  if(btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      filterTurma.value = '';
      filterMes.value = '';
      renderizarTabelaAtividades();
    });
  }

  // --- Funções de Atualização dos Cards do Dashboard ---
  async function atualizarCardsDashboard() {
    const users = await ipcRenderer.invoke('get-users');
    const activities = await ipcRenderer.invoke('get-activities');

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
          saidasHoje.delete(activity.userId); // Remove se houver uma saída anterior
        } else {
          saidasHoje.add(activity.userId);
          presencasHoje.delete(activity.userId); // Remove se houver uma entrada anterior
        }
      }
    });

    // Filtra os usuários que têm uma entrada e não uma saída para o dia de hoje
    const presentes = Array.from(presencasHoje).filter(userId => !saidasHoje.has(userId));
    const presencaHojeCount = presentes.length;
    
    document.getElementById('presenca-hoje').textContent = presencaHojeCount;
    document.getElementById('ausentes-hoje').textContent = totalHoje - presencaHojeCount;
  }

  // Adiciona o event listener para o botão de sincronizar a hora
  const syncTimeBtn = document.getElementById('sync-time-btn');
  if (syncTimeBtn) {
    syncTimeBtn.addEventListener('click', async () => {
      try {
        await ipcRenderer.invoke('sync-time');
        await showCustomAlert('Sucesso', 'Data e hora sincronizadas com o dispositivo.');
      } catch (error) {
        await showCustomAlert('Erro', `Não foi possível sincronizar a hora: ${error.message}`);
      }
    });
  }

  // Adiciona o event listener para o botão de apagar atividades
  const clearActivitiesBtn = document.getElementById('clear-activities-btn');
  if (clearActivitiesBtn) {
    clearActivitiesBtn.addEventListener('click', async () => {
      const password = await showCustomConfirm('Confirmação', 'Para apagar todos os registros de atividades, digite a senha:', true);
      
      if (password) {
        if (password === '2909') { // Senha fixa
          const confirmed = await showCustomConfirm('Confirmação', 'Tem certeza que deseja apagar TODOS os registros de atividades? Esta ação é irreversível.');
          if (confirmed) {
            try {
              const result = await ipcRenderer.invoke('clear-all-activities');
              await showCustomAlert('Sucesso!', result.message);
              // Atualiza todas as tabelas e cards após apagar
              renderizarTabelaAtividades();
              renderizarAtividadesRecentes();
              renderizarAtividadesPorData(new Date(selectedYear, selectedMonth, selectedDay)); // Atualiza o dashboard do dia
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
    const users = await ipcRenderer.invoke('get-users');
    const activities = await ipcRenderer.invoke('get-activities');

    const today = new Date();
    const todayDay = today.getDay();
    const todayDate = today.toLocaleDateString('pt-BR');

    // Usuários que deveriam estar presentes hoje (com base nos dias da semana cadastrados)
    const usuariosComDiaHoje = users.filter(u => u.diasSemana && u.diasSemana.includes(todayDay));

    const presencasHoje = new Set();
    const saidasHoje = new Set();

    activities.forEach(activity => {
      const activityDate = new Date(activity.timestamp).toLocaleDateString('pt-BR');
      if (activityDate === todayDate) {
        if (activity.type === 'Entrada') {
          presencasHoje.add(activity.userId);
          saidasHoje.delete(activity.userId); // Se entrou, não está mais ausente
        } else {
          saidasHoje.add(activity.userId);
          presencasHoje.delete(activity.userId); // Se saiu, não está mais presente
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
      0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb'
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
  
    const allActivities = await ipcRenderer.invoke('get-activities');
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
  }

  // Inicialização
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

  ipcRenderer.on('web-server-started', (event, data) => {
    console.log(`Servidor web acessível em: http://${data.ipAddress}:${data.port}`);
    showCustomAlert('Servidor Web', `Interface web acessível em: http://${data.ipAddress}:${data.port}`);
  });
});
