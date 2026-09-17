(function () {
  const form = document.querySelector('#pollForm');
  const status = document.querySelector('#selectionStatus');
  const success = document.querySelector('#success');
  const results = document.querySelector('#results');
  const countsKey = 'enquete-camisas-contagem';
  const votedKey = 'enquete-camisas-voto';
  const defaultCounts = [18, 27, 14, 22, 11, 19, 16];
  let counts = JSON.parse(localStorage.getItem(countsKey) || 'null') || defaultCounts.slice();

  form.addEventListener('change', function (event) {
    const number = event.target.value;
    status.textContent = 'Camisa ' + number.padStart(2, '0') + ' selecionada';
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const selected = form.querySelector('input:checked');
    if (!selected) {
      status.textContent = 'Escolha uma camisa para continuar';
      status.classList.add('needs-choice');
      return;
    }
    const number = Number(selected.value);
    if (!localStorage.getItem(votedKey)) {
      counts[number - 1] += 1;
      localStorage.setItem(countsKey, JSON.stringify(counts));
      localStorage.setItem(votedKey, String(number));
    }
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
    document.querySelector('#totalVotes').textContent = total + ' votos demonstrativos';
    document.querySelector('#bars').innerHTML = counts.map(function (count, index) {
      const percent = Math.round((count / Math.max(...counts)) * 100);
      return '<div class="bar-row"><span>Modelo ' + String(index + 1).padStart(2, '0') + '</span><span class="bar-track"><span class="bar-fill" style="width:' + percent + '%"></span></span><strong>' + count + '</strong></div>';
    }).join('');
  }

  const previousVote = localStorage.getItem(votedKey);
  if (previousVote) {
    const option = document.querySelector('#shirt-' + previousVote);
    if (option) {
      option.checked = true;
      status.textContent = 'Seu voto já foi registrado neste dispositivo';
      document.querySelector('#votedShirt').textContent = 'Modelo ' + String(previousVote).padStart(2, '0');
      success.hidden = false;
      form.querySelector('.poll-actions').hidden = true;
    }
  }
}());
