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

      if (user.status === "pending") {
        return json({
          error: "Račun čeka odobrenje administratora"
        }, 403);
      }

      if (user.status !== "active") {
        return json({
          error: "Račun nije aktivan"
        }, 403);
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
        username: user.username,
        role: user.role,
        status: user.status
      });
    }

    if (request.method === "POST" && url.pathname === "/register") {
      const body = await request.json();
      const username = (body.username || "").trim();
      const password = body.password || "";

      if (!username || !password) {
        return json({ error: "Username i lozinka su obavezni" }, 400);
      }

      if (username.length < 3 || password.length < 6) {
        return json({ error: "Username mora imati barem 3 znaka, a lozinka barem 6" }, 400);
      }

      const existingUser = await env.DB
        .prepare("SELECT id FROM users WHERE username = ?")
        .bind(username)
        .first();

      if (existingUser) {
        return json({ error: "Korisnik već postoji" }, 409);
      }

      const passwordHash = await hashPassword(password);

      await env.DB
        .prepare(`
          INSERT INTO users (
            username,
            password_hash,
            created_at,
            role,
            status
          )
          VALUES (?, ?, datetime('now'), 'user', 'pending')
        `)
        .bind(username, passwordHash)
        .run();

      return json({
        success: true,
        message: "Registracija je poslana na odobrenje"
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
          `SELECT users.username, users.role, users.status
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
        username: session.username,
        role: session.role,
        status: session.status
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

    if (request.method === "GET" && url.pathname === "/admin/users") {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const users = await env.DB
        .prepare(`
          SELECT id, username, role, status, created_at
          FROM users
          ORDER BY created_at DESC
        `)
        .all();

      return json(users.results || []);
    }

    if (request.method === "PUT" && url.pathname.startsWith("/admin/users/")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const userId = url.pathname.split("/")[3];
      const body = await request.json();
      const username = (body.username || "").trim();
      const role = body.role === "admin" ? "admin" : "user";
      const status = body.status === "active" ? "active" : "pending";

      if (!username) {
        return json({ error: "Username je obavezan" }, 400);
      }

      if (body.password) {
        const passwordHash = await hashPassword(body.password);

        await env.DB
          .prepare(`
            UPDATE users
            SET username = ?, role = ?, status = ?, password_hash = ?
            WHERE id = ?
          `)
          .bind(username, role, status, passwordHash, userId)
          .run();
      } else {
        await env.DB
          .prepare(`
            UPDATE users
            SET username = ?, role = ?, status = ?
            WHERE id = ?
          `)
          .bind(username, role, status, userId)
          .run();
      }

      return json({ success: true });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/admin/users/")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const userId = url.pathname.split("/")[3];

      if (String(admin.id) === String(userId)) {
        return json({ error: "Ne možeš obrisati sam sebe" }, 400);
      }

      await env.DB
        .prepare("DELETE FROM sessions WHERE user_id = ?")
        .bind(userId)
        .run();

      await env.DB
        .prepare("DELETE FROM notes WHERE user_id = ?")
        .bind(userId)
        .run();

      await env.DB
        .prepare("DELETE FROM sold_warranties WHERE user_id = ?")
        .bind(userId)
        .run();

      await env.DB
        .prepare("DELETE FROM users WHERE id = ?")
        .bind(userId)
        .run();

      return json({ success: true });
    }

    if (request.method === "GET" && url.pathname === "/notes") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const notes = await env.DB
        .prepare(`
          SELECT id, title, content, updated_at
          FROM notes
          WHERE user_id = ?
          ORDER BY updated_at DESC
        `)
        .bind(user.id)
        .all();

      return json(notes.results || []);
    }

    if (request.method === "POST" && url.pathname === "/notes") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await request.json();
      const title = (body.title || "Nova bilješka").trim();
      const content = body.content || "";
      const now = new Date().toISOString();

      const result = await env.DB
        .prepare(`
          INSERT INTO notes (
            user_id,
            title,
            content,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(user.id, title, content, now, now)
        .run();

      return json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    if (request.method === "PUT" && url.pathname.startsWith("/notes/")) {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const noteId = url.pathname.split("/")[2];
      const body = await request.json();
      const title = (body.title || "Nova bilješka").trim();
      const content = body.content || "";
      const now = new Date().toISOString();

      await env.DB
        .prepare(`
          UPDATE notes
          SET title = ?, content = ?, updated_at = ?
          WHERE id = ?
          AND user_id = ?
        `)
        .bind(title, content, now, noteId, user.id)
        .run();

      return json({ success: true });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/notes/")) {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const noteId = url.pathname.split("/")[2];

      await env.DB
        .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
        .bind(noteId, user.id)
        .run();

      return json({ success: true });
    }

    if (request.method === "GET" && url.pathname === "/sold-warranties") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const soldWarranties = await env.DB
        .prepare(`
          SELECT
            id,
            receipt_number,
            sale_date,
            product_name,
            warranty_type,
            warranty_price,
            created_at
          FROM sold_warranties
          WHERE user_id = ?
          ORDER BY sale_date DESC, created_at DESC
        `)
        .bind(user.id)
        .all();

      return json(soldWarranties.results || []);
    }

    if (request.method === "POST" && url.pathname === "/sold-warranties") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await request.json();
      const receiptNumber = (body.receiptNumber || "").trim();
      const saleDate = body.saleDate || "";
      const productName = (body.productName || "").trim();
      const warrantyType = (body.warrantyType || "").trim();
      const warrantyPrice = Number(body.warrantyPrice);
      const now = new Date().toISOString();

      if (!receiptNumber || !saleDate || !productName || !warrantyType || !Number.isFinite(warrantyPrice) || warrantyPrice <= 0) {
        return json({ error: "Sva polja su obavezna" }, 400);
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO sold_warranties (
            user_id,
            receipt_number,
            sale_date,
            product_name,
            warranty_type,
            warranty_price,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          user.id,
          receiptNumber,
          saleDate,
          productName,
          warrantyType,
          warrantyPrice,
          now
        )
        .run();

      return json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/sold-warranties/")) {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const soldWarrantyId = url.pathname.split("/")[2];

      await env.DB
        .prepare("DELETE FROM sold_warranties WHERE id = ? AND user_id = ?")
        .bind(soldWarrantyId, user.id)
        .run();

      return json({ success: true });
    }

    if (request.method === "GET" && url.pathname === "/warranty-stats") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const summary = await env.DB
        .prepare(`
          SELECT
            COUNT(*) as totalSold,
            COALESCE(SUM(warranty_price),0) as totalRevenue,
            COALESCE(AVG(warranty_price),0) as averagePrice,
            COALESCE(MAX(warranty_price),0) as highestWarranty
          FROM sold_warranties
        `)
        .first();

      const topWarranty = await env.DB
        .prepare(`
          SELECT warranty_type, COUNT(*) as count
          FROM sold_warranties
          GROUP BY warranty_type
          ORDER BY count DESC
          LIMIT 1
        `)
        .first();

      const todaySold = await env.DB
        .prepare(`
          SELECT COUNT(*) as count
          FROM sold_warranties
          WHERE sale_date = date('now')
        `)
        .first();

      const byType = await env.DB
        .prepare(`
          SELECT
            warranty_type,
            COUNT(*) as count,
            SUM(warranty_price) as revenue
          FROM sold_warranties
          GROUP BY warranty_type
          ORDER BY count DESC
        `)
        .all();

      const byDay = await env.DB
        .prepare(`
          SELECT
            sale_date,
            COUNT(*) as count,
            SUM(warranty_price) as revenue
          FROM sold_warranties
          GROUP BY sale_date
          ORDER BY sale_date DESC
          LIMIT 30
        `)
        .all();

      const byUser = await env.DB
        .prepare(`
          SELECT
            users.username,
            COUNT(*) as count,
            SUM(sold_warranties.warranty_price) as revenue
          FROM sold_warranties
          JOIN users ON users.id = sold_warranties.user_id
          GROUP BY users.username
          ORDER BY count DESC
        `)
        .all();

      return json({
        totalSold: Number(summary?.totalSold || 0),
        totalRevenue: Number(summary?.totalRevenue || 0),
        averagePrice: Number(summary?.averagePrice || 0),
        highestWarranty: Number(summary?.highestWarranty || 0),
        todaySold: Number(todaySold?.count || 0),
        topWarranty: topWarranty?.warranty_type || "-",
        byType: byType.results || [],
        byDay: byDay.results || [],
        byUser: byUser.results || []
      });
    }

    if (request.method === "GET" && url.pathname === "/announcements") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const announcements = await env.DB
        .prepare(`
          SELECT
            announcements.id,
            announcements.content,
            announcements.created_at,
            users.username
          FROM announcements
          JOIN users ON users.id = announcements.user_id
          ORDER BY announcements.created_at DESC
          LIMIT 50
        `)
        .all();

      return json(announcements.results || []);
    }

    if (request.method === "POST" && url.pathname === "/announcements") {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const body = await request.json();
      const content = (body.content || "").trim();
      const now = new Date().toISOString();

      if (!content) {
        return json({ error: "Obavijest ne može biti prazna" }, 400);
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO announcements (
            user_id,
            content,
            created_at
          )
          VALUES (?, ?, ?)
        `)
        .bind(admin.id, content, now)
        .run();

      return json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/announcements/")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const announcementId = url.pathname.split("/")[2];

      await env.DB
        .prepare("DELETE FROM announcements WHERE id = ?")
        .bind(announcementId)
        .run();

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
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
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

async function getAuthenticatedUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  return await env.DB
    .prepare(`
      SELECT users.id, users.username, users.role, users.status
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      AND sessions.expires_at > datetime('now')
    `)
    .bind(token)
    .first();
}

async function getAdminUser(request, env) {
  const user = await getAuthenticatedUser(request, env);

  if (!user || user.role !== "admin" || user.status !== "active") {
    return null;
  }

  return user;
}
