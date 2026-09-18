(function () {
  const form = document.querySelector('#pollForm');
  const status = document.querySelector('#selectionStatus');
  const authStatus = document.querySelector('#authStatus');
  const success = document.querySelector('#success');
  const results = document.querySelector('#results');
  const nameInput = document.querySelector('#studentName');
  const emailInput = document.querySelector('#studentEmail');
  const nameMessage = document.querySelector('#nameMessage');
  const emailMessage = document.querySelector('#emailMessage');
  const changeEmail = document.querySelector('#changeEmail');
  let supabaseClient = null;
  let currentSession = null;
  let authReady = false;
  let isSubmitting = false;

  function setMessage(element, message) {
    if (element) element.textContent = message;
  }

  function setAuthMessage(message) {
    setMessage(authStatus, message);
  }

  function showVote(number, name) {
    const votedName = document.querySelector('#votedName');
    const votedShirt = document.querySelector('#votedShirt');
    const actions = form && form.querySelector('.poll-actions');
    if (votedName) votedName.textContent = name;
    if (votedShirt) votedShirt.textContent = 'Modelo ' + String(number).padStart(2, '0');
    if (success) {
      success.hidden = false;
      success.focus();
    }
    if (actions) actions.hidden = true;
  }

  function setSubmitting(submitting, label) {
    isSubmitting = submitting;
    const button = form && form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = submitting;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = submitting ? label : button.dataset.originalText;
  }

  function currentPageUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function applySession(session) {
    currentSession = session || null;
    if (currentSession && currentSession.user && typeof currentSession.user.email === 'string') {
      if (emailInput) {
        emailInput.value = currentSession.user.email;
        emailInput.disabled = true;
      }
      if (changeEmail) changeEmail.hidden = false;
      setAuthMessage('E-mail confirmado. Você já pode registrar seu voto.');
      return;
    }

    if (emailInput) emailInput.disabled = false;
    if (changeEmail) changeEmail.hidden = true;
    if (authReady) setAuthMessage('Informe seu e-mail para receber um link de acesso.');
  }

  async function initializeAuth() {
    const config = window.SUPABASE_CONFIG;
    if (!config || !config.url || !config.publishableKey) {
      setAuthMessage('A autenticação está indisponível no momento.');
      authReady = true;
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setAuthMessage('A autenticação está indisponível no momento.');
      authReady = true;
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
      supabaseClient.auth.onAuthStateChange(function (event, session) {
        applySession(session);
      });
      const result = await supabaseClient.auth.getSession();
      if (result.error) {
        currentSession = null;
        setAuthMessage('Não foi possível verificar sua sessão.');
      } else {
        applySession(result.data && result.data.session);
      }
    } catch (error) {
      supabaseClient = null;
      currentSession = null;
      setAuthMessage('A autenticação está indisponível no momento.');
    }
    authReady = true;
    if (!currentSession && (!authStatus || !authStatus.textContent)) {
      setAuthMessage('Informe seu e-mail para receber um link de acesso.');
    }
  }

  const authReadyPromise = initializeAuth();

  if (form) {
    form.addEventListener('change', function (event) {
      if (status && event.target && event.target.matches('input[name="shirt"]') && event.target.value) {
        status.textContent = 'Camisa ' + event.target.value.padStart(2, '0') + ' selecionada';
        status.classList.remove('needs-choice');
      }
    });
  }

  if (nameInput) {
    nameInput.addEventListener('invalid', function () {
      setMessage(nameMessage, 'Informe seu nome para confirmar o voto.');
    });
    nameInput.addEventListener('input', function () {
      nameInput.setCustomValidity('');
      setMessage(nameMessage, '');
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', function () {
      emailInput.setCustomValidity('');
      setMessage(emailMessage, '');
    });
  }

  async function sendMagicLink(email) {
    if (!supabaseClient) {
      setAuthMessage('A autenticação está indisponível no momento.');
      return false;
    }

    setMessage(status, 'Enviando o link de acesso…');
    setAuthMessage('Verifique seu e-mail para continuar.');
    try {
      const result = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: currentPageUrl() }
      });
      if (result.error) {
        setAuthMessage('Não foi possível enviar o link. Tente novamente.');
        setMessage(emailMessage, 'Não foi possível enviar o link para este e-mail.');
        return false;
      }
      setMessage(emailMessage, 'Link enviado. Abra o e-mail para confirmar seu acesso.');
      return true;
    } catch (error) {
      setAuthMessage('Não foi possível enviar o link. Tente novamente.');
      setMessage(emailMessage, 'Não foi possível enviar o link para este e-mail.');
      return false;
    }
  }

  async function signOutAndReleaseEmail(resetForm) {
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (error) { /* estado local será restaurado abaixo */ }
    }
    currentSession = null;
    applySession(null);
    if (emailInput) {
      emailInput.value = '';
      emailInput.disabled = false;
    }
    if (resetForm) {
      if (nameInput) {
        nameInput.value = '';
        nameInput.setCustomValidity('');
      }
      if (form) {
        form.querySelectorAll('input[name="shirt"]').forEach(function (option) {
          option.checked = false;
        });
        const actions = form.querySelector('.poll-actions');
        if (actions) actions.hidden = false;
      }
      if (success) success.hidden = true;
      if (results) results.hidden = true;
      setMessage(status, 'Nenhuma camisa selecionada');
      setMessage(nameMessage, '');
      setMessage(emailMessage, '');
    }
  }

  if (changeEmail) {
    changeEmail.addEventListener('click', async function (event) {
      event.preventDefault();
      if (isSubmitting) return;
      changeEmail.disabled = true;
      setAuthMessage('Saindo da sessão…');
      await signOutAndReleaseEmail(true);
      changeEmail.disabled = false;
    });
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (isSubmitting) return;

      const selected = form.querySelector('input[name="shirt"]:checked');
      if (!selected) {
        setMessage(status, 'Escolha uma camisa para continuar');
        if (status) status.classList.add('needs-choice');
        return;
      }

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      if (!name || Array.from(name).length > 80) {
        if (nameInput) nameInput.setCustomValidity('Informe um nome válido para votar.');
        setMessage(nameMessage, 'Informe um nome entre 1 e 80 caracteres.');
        if (nameInput) nameInput.focus();
        return;
      }
      if (!emailInput) {
        setMessage(status, 'O campo de e-mail é necessário para continuar.');
        return;
      }
      if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.setCustomValidity('Informe um e-mail válido.');
        setMessage(emailMessage, 'Informe um e-mail válido para continuar.');
        emailInput.focus();
        return;
      }

      if (!authReady) {
        setMessage(status, 'Verificando autenticação…');
        await authReadyPromise;
      }

      if (!supabaseClient) {
        setAuthMessage('A autenticação está indisponível no momento.');
        setMessage(status, 'Não foi possível iniciar a autenticação.');
        return;
      }

      if (!currentSession) {
        setSubmitting(true, 'Enviando link…');
        try {
          await sendMagicLink(email);
        } finally {
          setSubmitting(false);
        }
        return;
      }

      setMessage(nameMessage, '');
      setMessage(emailMessage, '');
      setMessage(status, 'Registrando seu voto…');
      setSubmitting(true, 'Registrando…');

      try {
        const latest = await supabaseClient.auth.getSession();
        const session = latest.data && latest.data.session;
        if (latest.error || !session || !session.access_token) {
          await signOutAndReleaseEmail(false);
          setAuthMessage('Sua sessão expirou. Solicite um novo link de acesso.');
          return;
        }
        applySession(session);

        const response = await fetch('/api/votes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token
          },
          body: JSON.stringify({ name: name, shirtNumber: Number(selected.value) })
        });
        let payload = null;
        try { payload = await response.json(); } catch (error) { payload = null; }

        if (!response.ok) {
          if (response.status === 401) {
            await signOutAndReleaseEmail(false);
            setAuthMessage('Sua sessão expirou. Solicite um novo link de acesso.');
          } else if (response.status === 409) {
            setMessage(emailMessage, 'Este usuário já registrou um voto.');
          } else {
            setMessage(status, (payload && payload.error) || 'Não foi possível registrar o voto. Tente novamente.');
          }
          return;
        }

        setMessage(status, 'Voto registrado com sucesso.');
        showVote(Number(selected.value), name);
      } catch (error) {
        setMessage(status, 'Não foi possível conectar ao serviço. Tente novamente.');
      } finally {
        setSubmitting(false);
      }
    });
  }

  const showResults = document.querySelector('#showResults');
  if (showResults) {
    showResults.addEventListener('click', async function () {
      if (results) results.hidden = false;
      await renderResults();
      if (results) results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function renderResults() {
    const totalVotes = document.querySelector('#totalVotes');
    const bars = document.querySelector('#bars');
    if (!bars) return;

    try {
      const response = await fetch('/api/votes', { method: 'GET', headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok || !payload || !Array.isArray(payload.totals)) throw new Error('results');

      const counts = Array.from({ length: 7 }, function (_, index) {
        const item = payload.totals.find(function (entry) {
          return Number(entry.shirtNumber) === index + 1;
        });
        return item && Number.isSafeInteger(Number(item.total)) ? Number(item.total) : 0;
      });
      const total = counts.reduce(function (sum, value) { return sum + value; }, 0);
      setMessage(totalVotes, total + (total === 1 ? ' voto na turma' : ' votos na turma'));
      const maximum = Math.max.apply(null, counts.concat([1]));
      bars.textContent = '';
      counts.forEach(function (count, index) {
        const row = document.createElement('div');
        row.className = 'bar-row';
        row.innerHTML = '<span>Modelo ' + String(index + 1).padStart(2, '0') + '</span><span class="bar-track"><span class="bar-fill"></span></span><strong></strong>';
        row.querySelector('.bar-fill').style.width = Math.round((count / maximum) * 100) + '%';
        row.querySelector('strong').textContent = count;
        bars.appendChild(row);
      });
    } catch (error) {
      setMessage(totalVotes, 'Resultados indisponíveis no momento.');
      bars.textContent = '';
    }
  }
}());
