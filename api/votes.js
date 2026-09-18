const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

function endpoint(path) {
  return SUPABASE_URL.replace(/\/$/, '') + path;
}

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string' || !body.trim()) return null;
  try { return JSON.parse(body); } catch (e) { return null; }
}

async function readJson(response) {
  try { return JSON.parse(await response.text()); } catch (e) { return null; }
}

function validEmail(email) {
  return email.length >= 3 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateVote(body) {
  if (!body || Array.isArray(body)) return null;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const shirtNumber = body.shirtNumber;
  if (!name || Array.from(name).length > 80) return null;
  if (!email || !validEmail(email)) return null;
  if (typeof shirtNumber !== 'number' || !Number.isInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 7) return null;
  return { name: name, email: email, shirt_number: shirtNumber };
}

async function createVote(req, res) {
  if (!configured()) {
    json(res, 500, { error: 'Serviço de votação indisponível.' });
    return;
  }

  const vote = validateVote(parseBody(req.body));
  if (!vote) {
    json(res, 400, { error: 'Dados de voto inválidos.' });
    return;
  }

  try {
    const response = await fetch(endpoint('/rest/v1/votes'), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(vote)
    });

    const errorBody = response.ok ? null : await readJson(response);
    if (errorBody && errorBody.code === '23505') {
      json(res, 409, { error: 'Este e-mail já registrou um voto.' });
      return;
    }
    if (!response.ok) {
      json(res, 502, { error: 'Não foi possível registrar o voto.' });
      return;
    }
    json(res, 201, { success: true });
  } catch (error) {
    json(res, 502, { error: 'Não foi possível registrar o voto.' });
  }
}

async function getTotals(res) {
  if (!configured()) {
    json(res, 500, { error: 'Serviço de votação indisponível.' });
    return;
  }

  try {
    const response = await fetch(endpoint('/rest/v1/rpc/vote_totals'), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: '{}'
    });

    if (!response.ok) {
      await readJson(response);
      json(res, 502, { error: 'Não foi possível consultar os resultados.' });
      return;
    }

    const rows = await readJson(response);
    if (!Array.isArray(rows)) {
      json(res, 502, { error: 'Não foi possível consultar os resultados.' });
      return;
    }

    const totalsByShirt = new Map();
    rows.forEach(function (row) {
      const shirtNumber = Number(row && row.shirt_number);
      const total = Number(row && row.total);
      if (Number.isInteger(shirtNumber) && shirtNumber >= 1 && shirtNumber <= 7 && Number.isSafeInteger(total) && total >= 0) {
        totalsByShirt.set(shirtNumber, total);
      }
    });

    const totals = Array.from({ length: 7 }, function (_, index) {
      const shirtNumber = index + 1;
      return { shirtNumber: shirtNumber, total: totalsByShirt.get(shirtNumber) || 0 };
    });

    // Busca lista de votos individuais
    let votes = [];
    try {
      const listRes = await fetch(endpoint('/rest/v1/rpc/vote_list'), {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: '{}'
      });
      if (listRes.ok) {
        const rows = await readJson(listRes);
        if (Array.isArray(rows)) {
          votes = rows.map(function (row) {
            return { name: String(row.name || ''), shirtNumber: Number(row.shirt_number) };
          }).filter(function (v) { return v.name && Number.isInteger(v.shirtNumber); });
        }
      } else {
        console.error('vote_list falhou:', listRes.status, await readJson(listRes));
      }
    } catch (e) {
      // votes fica vazio, totais continuam disponíveis
      console.error('vote_list erro:', e && e.message);
    }

    json(res, 200, { totals: totals, votes: votes });
  } catch (error) {
    json(res, 502, { error: 'Não foi possível consultar os resultados.' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method === 'POST') { await createVote(req, res); return; }
  if (req.method === 'GET') { await getTotals(res); return; }
  json(res, 405, { error: 'Método não permitido.' });
};
