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

    if (request.method === "GET" && url.pathname === "/profile") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const userInfo = await env.DB
        .prepare(`
          SELECT id, username, role, status, created_at
          FROM users
          WHERE id = ?
        `)
        .bind(user.id)
        .first();

      const warrantySummary = await env.DB
        .prepare(`
          SELECT
            COUNT(*) as warrantyCount,
            COALESCE(SUM(warranty_price), 0) as warrantyRevenue,
            COALESCE(AVG(warranty_price), 0) as averageWarrantyPrice,
            COALESCE(MAX(warranty_price), 0) as highestWarrantyPrice
          FROM sold_warranties
          WHERE user_id = ?
        `)
        .bind(user.id)
        .first();

      const topWarranty = await env.DB
        .prepare(`
          SELECT warranty_type, COUNT(*) as count
          FROM sold_warranties
          WHERE user_id = ?
          GROUP BY warranty_type
          ORDER BY count DESC
          LIMIT 1
        `)
        .bind(user.id)
        .first();

      const lastWarranty = await env.DB
        .prepare(`
          SELECT sale_date, product_name, warranty_type, warranty_price
          FROM sold_warranties
          WHERE user_id = ?
          ORDER BY sale_date DESC, created_at DESC
          LIMIT 1
        `)
        .bind(user.id)
        .first();

      const notesCount = await env.DB
        .prepare("SELECT COUNT(*) as count FROM notes WHERE user_id = ?")
        .bind(user.id)
        .first();

      return json({
        username: userInfo?.username || user.username,
        role: userInfo?.role || user.role,
        status: userInfo?.status || user.status,
        createdAt: userInfo?.created_at || null,
        warrantyCount: Number(warrantySummary?.warrantyCount || 0),
        warrantyRevenue: Number(warrantySummary?.warrantyRevenue || 0),
        averageWarrantyPrice: Number(warrantySummary?.averageWarrantyPrice || 0),
        highestWarrantyPrice: Number(warrantySummary?.highestWarrantyPrice || 0),
        topWarranty: topWarranty?.warranty_type || "-",
        notesCount: Number(notesCount?.count || 0),
        lastWarranty: lastWarranty || null
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

    if (request.method === "POST" && url.pathname === "/shift-requests") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await request.json();
      const requestDate = (body.request_date || "").trim();
      const weekday = (body.weekday || "").trim();
      const shiftType = (body.shift_type || "").trim();
      const reason = (body.reason || "").trim();
      const now = new Date().toISOString();

      const allowedShifts = ["jutro", "popodne", "slobodno"];

      if (!requestDate || !weekday || !allowedShifts.includes(shiftType)) {
        return json({ error: "Datum i smjena su obavezni" }, 400);
      }

      const firstAllowedDate = getNextScheduleWeekStartISO();

      if (requestDate < firstAllowedDate) {
        return json({ error: "Zahtjev je moguće poslati tek za sljedeći rasporedni tjedan" }, 400);
      }

      const existingRequest = await env.DB
        .prepare(`
          SELECT id
          FROM shift_requests
          WHERE user_id = ?
          AND request_date = ?
        `)
        .bind(user.id, requestDate)
        .first();

      if (existingRequest) {
        return json({ error: "Već postoji zahtjev za odabrani datum." }, 409);
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO shift_requests (
            user_id,
            request_date,
            weekday,
            shift_type,
            reason,
            status,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `)
        .bind(user.id, requestDate, weekday, shiftType, reason, now)
        .run();

      return json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    if (request.method === "GET" && url.pathname === "/my-shift-requests") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const requests = await env.DB
        .prepare(`
          SELECT
            id,
            request_date,
            weekday,
            shift_type,
            reason,
            admin_note,
            status,
            created_at
          FROM shift_requests
          WHERE user_id = ?
          ORDER BY request_date DESC
        `)
        .bind(user.id)
        .all();

      return json({
        requests: requests.results || []
      });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/shift-requests/")) {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const requestId = url.pathname.split("/")[2];

      const existingRequest = await env.DB
        .prepare(`
          SELECT id, status, user_id
          FROM shift_requests
          WHERE id = ?
        `)
        .bind(requestId)
        .first();

      if (!existingRequest) {
        return json({ error: "Zahtjev ne postoji" }, 404);
      }

      if (String(existingRequest.user_id) !== String(user.id)) {
        return json({ error: "Ne možeš povući tuđi zahtjev" }, 403);
      }

      if (existingRequest.status !== "pending") {
        return json({ error: "Možeš povući samo zahtjev koji je na čekanju" }, 400);
      }

      await env.DB
        .prepare(`
          DELETE FROM shift_requests
          WHERE id = ?
          AND user_id = ?
          AND status = 'pending'
        `)
        .bind(requestId, user.id)
        .run();

      return json({ success: true });
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/shift-requests/") && url.pathname.endsWith("/status")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const parts = url.pathname.split("/");
      const requestId = parts[2];
      const body = await request.json();
      const status = (body.status || "").trim();
      const adminNote = (body.admin_note || "").trim();
      const now = new Date().toISOString();

      if (!["approved", "rejected"].includes(status)) {
        return json({ error: "Neispravan status zahtjeva" }, 400);
      }

      const existingRequest = await env.DB
        .prepare(`
          SELECT id, status
          FROM shift_requests
          WHERE id = ?
        `)
        .bind(requestId)
        .first();

      if (!existingRequest) {
        return json({ error: "Zahtjev ne postoji" }, 404);
      }

      if (existingRequest.status !== "pending") {
        return json({ error: "Samo zahtjevi na čekanju mogu se obraditi" }, 400);
      }

      await env.DB
        .prepare(`
          UPDATE shift_requests
          SET status = ?,
              admin_note = ?,
              processed_at = ?,
              processed_by = ?
          WHERE id = ?
        `)
        .bind(status, adminNote, now, admin.id, requestId)
        .run();

      return json({ success: true });
    }

    if (request.method === "GET" && url.pathname === "/shift-requests") {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const status = url.searchParams.get("status") || "pending";
      const selectedWeek = url.searchParams.get("week");

      let query = `
        SELECT
          shift_requests.id,
          shift_requests.request_date,
          shift_requests.weekday,
          shift_requests.shift_type,
          shift_requests.reason,
          shift_requests.admin_note,
          shift_requests.status,
          shift_requests.created_at,
          users.username
        FROM shift_requests
        JOIN users ON users.id = shift_requests.user_id
      `;

      const conditions = [];
      const bindings = [];

      if (status !== "all") {
        conditions.push(`shift_requests.status = ?`);
        bindings.push(status);
      }

      if (selectedWeek) {
        const [yearText, weekText] = selectedWeek.split("-W");
        const year = Number(yearText);
        const week = Number(weekText);

        const firstDay = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
        const day = firstDay.getUTCDay() || 7;

        if (day <= 4) {
          firstDay.setUTCDate(firstDay.getUTCDate() - day + 1);
        } else {
          firstDay.setUTCDate(firstDay.getUTCDate() + 8 - day);
        }

        const lastDay = new Date(firstDay);
        lastDay.setUTCDate(firstDay.getUTCDate() + 6);

        const startDate = firstDay.toISOString().split("T")[0];
        const endDate = lastDay.toISOString().split("T")[0];

        conditions.push(`shift_requests.request_date BETWEEN ? AND ?`);
        bindings.push(startDate, endDate);
      }

      if (conditions.length) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += ` ORDER BY shift_requests.request_date ASC`;

      const requests = await env.DB.prepare(query).bind(...bindings).all();

      return json({
        requests: requests.results || []
      });
    }

    if (request.method === "GET" && url.pathname === "/offers") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const offers = await env.DB
        .prepare(`
          SELECT
            offers.id,
            offers.title,
            offers.discount,
            offers.conditions,
            offers.duration,
            offers.created_at,
            offers.updated_at,
            users.username
          FROM offers
          JOIN users ON users.id = offers.user_id
          ORDER BY offers.updated_at DESC
        `)
        .all();

      return json(offers.results || []);
    }

    if (request.method === "POST" && url.pathname === "/offers") {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const body = await request.json();
      const title = (body.title || "").trim();
      const discount = (body.discount || "").trim();
      const conditions = (body.conditions || "").trim();
      const duration = (body.duration || "").trim();
      const now = new Date().toISOString();

      if (!title || !discount) {
        return json({ error: "Naziv ponude i popust su obavezni" }, 400);
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO offers (
            user_id,
            title,
            discount,
            conditions,
            duration,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(admin.id, title, discount, conditions, duration, now, now)
        .run();

      return json({ success: true, id: result.meta.last_row_id });
    }

    if (request.method === "PUT" && url.pathname.startsWith("/offers/")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const offerId = url.pathname.split("/")[2];
      const body = await request.json();
      const now = new Date().toISOString();

      await env.DB
        .prepare(`
          UPDATE offers
          SET
            title = ?,
            discount = ?,
            conditions = ?,
            duration = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          (body.title || "").trim(),
          (body.discount || "").trim(),
          (body.conditions || "").trim(),
          (body.duration || "").trim(),
          now,
          offerId
        )
        .run();

      return json({ success: true });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/offers/")) {
      const admin = await getAdminUser(request, env);

      if (!admin) {
        return json({ error: "Forbidden" }, 403);
      }

      const offerId = url.pathname.split("/")[2];

      await env.DB
        .prepare("DELETE FROM offers WHERE id = ?")
        .bind(offerId)
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

function getNextScheduleWeekStartISO() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);

  const year = nextMonday.getFullYear();
  const month = String(nextMonday.getMonth() + 1).padStart(2, "0");
  const date = String(nextMonday.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

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
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
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

  if (
    !user ||
    !["admin", "superadmin"].includes(user.role) ||
    user.status !== "active"
  ) {
    return null;
  }

  return user;
}
