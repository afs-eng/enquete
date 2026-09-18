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
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

async function readJson(response) {
  try {
    return JSON.parse(await response.text());
  } catch (error) {
    return null;
  }
}

function bearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

function validateVote(body) {
  if (!body || Array.isArray(body)) return null;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const shirtNumber = body.shirtNumber;
  if (!name || Array.from(name).length > 80) return null;
  if (typeof shirtNumber !== 'number' || !Number.isInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 7) return null;

  return { name: name, shirt_number: shirtNumber };
}

async function authenticatedUser(token) {
  const response = await fetch(endpoint('/auth/v1/user'), {
    method: 'GET',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    await readJson(response);
    return { invalid: true };
  }

  const user = await readJson(response);
  if (!user || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || !user.email) {
    return { invalid: true };
  }
  return { user: user };
}

async function createVote(req, res) {
  if (!configured()) {
    json(res, 500, { error: 'Serviço de votação indisponível.' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    json(res, 401, { error: 'Autenticação necessária.' });
    return;
  }

  let identity;
  try {
    identity = await authenticatedUser(token);
  } catch (error) {
    json(res, 502, { error: 'Não foi possível validar a sessão.' });
    return;
  }
  if (identity.invalid) {
    json(res, 401, { error: 'Sessão inválida ou expirada.' });
    return;
  }

  const vote = validateVote(parseBody(req.body));
  if (!vote) {
    json(res, 400, { error: 'Dados de voto inválidos.' });
    return;
  }

  const user = identity.user;
  const record = {
    user_id: user.id,
    name: vote.name,
    email: user.email,
    shirt_number: vote.shirt_number
  };

  try {
    const response = await fetch(endpoint('/rest/v1/votes'), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(record)
    });

    const errorBody = response.ok ? null : await readJson(response);
    if (errorBody && errorBody.code === '23505') {
      json(res, 409, { error: 'Este usuário já registrou um voto.' });
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
    json(res, 200, { totals: totals });
  } catch (error) {
    json(res, 502, { error: 'Não foi possível consultar os resultados.' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === 'POST') {
    await createVote(req, res);
    return;
  }
  if (req.method === 'GET') {
    await getTotals(res);
    return;
  }
  json(res, 405, { error: 'Método não permitido.' });
};
