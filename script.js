(function () {
  const form = document.querySelector('#pollForm');
  const status = document.querySelector('#selectionStatus');
  const success = document.querySelector('#success');
  const results = document.querySelector('#results');
  const nameInput = document.querySelector('#studentName');
  const nameMessage = document.querySelector('#nameMessage');
  const countsKey = 'enquete-camisas-contagem-v2';
  const votedKey = 'enquete-camisas-voto-v2';
  const defaultCounts = Array(7).fill(0);
  let counts = JSON.parse(localStorage.getItem(countsKey) || 'null') || defaultCounts.slice();

  form.addEventListener('change', function (event) {
    const number = event.target.value;
    status.textContent = 'Camisa ' + number.padStart(2, '0') + ' selecionada';
  });

  nameInput.addEventListener('invalid', function () {
    nameMessage.textContent = 'Informe seu nome para confirmar o voto.';
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const selected = form.querySelector('input:checked');
    if (!selected) {
      status.textContent = 'Escolha uma camisa para continuar';
      status.classList.add('needs-choice');
      return;
    }
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.setCustomValidity('Informe seu nome para votar.');
      nameMessage.textContent = 'Informe seu nome para confirmar o voto.';
      nameInput.focus();
      return;
    }
    nameInput.setCustomValidity('');
    nameMessage.textContent = '';
    const number = Number(selected.value);
    if (!localStorage.getItem(votedKey)) {
      counts[number - 1] += 1;
      localStorage.setItem(countsKey, JSON.stringify(counts));
      localStorage.setItem(votedKey, JSON.stringify({ number: number, name: name }));
    }
    document.querySelector('#votedName').textContent = name;
    document.querySelector('#votedShirt').textContent = 'Modelo ' + String(number).padStart(2, '0');
    success.hidden = false;
    form.querySelector('.poll-actions').hidden = true;
    success.focus();
  });

  document.querySelector('#showResults').addEventListener('click', function () {
    renderResults();
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function renderResults() {
    const total = counts.reduce((sum, value) => sum + value, 0);
    document.querySelector('#totalVotes').textContent = total + (total === 1 ? ' voto neste navegador' : ' votos neste navegador');
    document.querySelector('#bars').innerHTML = counts.map(function (count, index) {
      const percent = Math.round((count / Math.max(...counts, 1)) * 100);
      return '<div class="bar-row"><span>Modelo ' + String(index + 1).padStart(2, '0') + '</span><span class="bar-track"><span class="bar-fill" style="width:' + percent + '%"></span></span><strong>' + count + '</strong></div>';
    }).join('');
  }

  const previousVote = localStorage.getItem(votedKey);
  if (previousVote) {
    let record;
    try { record = JSON.parse(previousVote); } catch (error) { record = { number: previousVote, name: 'Este aluno' }; }
    const option = document.querySelector('#shirt-' + record.number);
    if (option) {
      option.checked = true;
      status.textContent = (record.name || 'Este aluno') + ', seu voto já foi registrado neste dispositivo';
      nameInput.value = record.name || '';
      nameInput.disabled = true;
      document.querySelector('#votedName').textContent = record.name || 'Este aluno';
      document.querySelector('#votedShirt').textContent = 'Modelo ' + String(record.number).padStart(2, '0');
      success.hidden = false;
      form.querySelector('.poll-actions').hidden = true;
    }
  }
}());
