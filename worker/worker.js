export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    if (request.method === "POST" && url.pathname === "/login") {
      const body = await request.json();

      const username = (body.username || "").trim();
      const password = body.password || "";

      if (!username || !password) {
        return json({
          error: "Username i lozinka su obavezni"
        }, 400);
      }

      const user = await env.DB
        .prepare("SELECT * FROM users WHERE username = ?")
        .bind(username)
        .first();

      if (!user) {
        return json({
          error: "Neispravni podaci"
        }, 401);
      }

      const validPassword = await verifyPassword(
        password,
        user.password_hash
      );

      if (!validPassword) {
        return json({
          error: "Neispravni podaci"
        }, 401);
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB
        .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(token, user.id, expiresAt)
        .run();

      return json({
        success: true,
        token,
        username: user.username
      });
    }

    if (request.method === "GET" && url.pathname === "/me") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "");

      if (!token) {
        return json({ authenticated: false }, 401);
      }

      const session = await env.DB
        .prepare(
          `SELECT users.username
           FROM sessions
           JOIN users ON users.id = sessions.user_id
           WHERE sessions.token = ?
           AND sessions.expires_at > datetime('now')`
        )
        .bind(token)
        .first();

      if (!session) {
        return json({ authenticated: false }, 401);
      }

      return json({
        authenticated: true,
        username: session.username
      });
    }

    if (request.method === "POST" && url.pathname === "/logout") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "");

      if (token) {
        await env.DB
          .prepare("DELETE FROM sessions WHERE token = ?")
          .bind(token)
          .run();
      }

      return json({ success: true });
    }

    if (request.method === "GET" && url.pathname === "/tools") {
      const setting = await env.DB
        .prepare("SELECT value FROM settings WHERE key = ?")
        .bind("tools")
        .first();

      if (!setting) {
        return json({
          warrantyCalculator: true
        });
      }

      return json(JSON.parse(setting.value));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true
      });
    }

    return json(
      { error: "Not found" },
      404
    );
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hashBuffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password, passwordHash) {
  const hash = await hashPassword(password);
  return hash === passwordHash;
}
