(function () {
  const form = document.querySelector('#pollForm');
  const status = document.querySelector('#selectionStatus');
  const success = document.querySelector('#success');
  const results = document.querySelector('#results');
  const nameInput = document.querySelector('#studentName');
  const emailInput = document.querySelector('#studentEmail');
  const nameMessage = document.querySelector('#nameMessage');
  const emailMessage = document.querySelector('#emailMessage');
  let isSubmitting = false;

  function setMessage(element, message) {
    if (element) element.textContent = message;
  }

  function showVote(number, name) {
    const votedName = document.querySelector('#votedName');
    const votedShirt = document.querySelector('#votedShirt');
    const actions = form && form.querySelector('.poll-actions');
    if (votedName) votedName.textContent = name;
    if (votedShirt) votedShirt.textContent = 'Modelo ' + String(number).padStart(2, '0');
    if (success) { success.hidden = false; success.focus(); }
    if (actions) actions.hidden = true;
  }

  function setSubmitting(submitting) {
    isSubmitting = submitting;
    const button = form && form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = submitting;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = submitting ? 'Registrando…' : button.dataset.originalText;
  }

  if (!form) return;

  form.addEventListener('change', function (event) {
    if (status && event.target && event.target.matches('input[name="shirt"]') && event.target.value) {
      status.textContent = 'Camisa ' + event.target.value.padStart(2, '0') + ' selecionada';
      status.classList.remove('needs-choice');
    }
  });

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
      setMessage(status, 'O campo de e-mail é necessário para votar.');
      return;
    }
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.setCustomValidity('Informe um e-mail válido.');
      setMessage(emailMessage, 'Informe um e-mail válido para confirmar o voto.');
      emailInput.focus();
      return;
    }

    if (nameInput) nameInput.setCustomValidity('');
    emailInput.setCustomValidity('');
    setMessage(nameMessage, '');
    setMessage(emailMessage, '');
    setMessage(status, 'Enviando seu voto…');
    setSubmitting(true);

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, shirtNumber: Number(selected.value) })
      });
      let payload = null;
      try { payload = await response.json(); } catch (e) { payload = null; }

      if (!response.ok) {
        if (response.status === 409) {
          setMessage(emailMessage, 'Este e-mail já registrou um voto.');
          emailInput.focus();
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

  async function openResults() {
    if (results) results.hidden = false;
    await renderResults();
    if (results) results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const watchResults = document.querySelector('#watchResults');
  if (watchResults) {
    watchResults.addEventListener('click', openResults);
  }

  const showResults = document.querySelector('#showResults');
  if (showResults) {
    showResults.addEventListener('click', openResults);
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
