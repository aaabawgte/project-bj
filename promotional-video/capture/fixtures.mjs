// Demo data served to the REAL Project BJ frontend during capture.
//
// Every object below mirrors the exact JSON shape returned by worker/worker.js,
// so the unmodified production HTML/CSS/JS renders it exactly as it would render
// live data. No production API, account or private user data is ever touched:
// requests to the worker URL are intercepted by Playwright and answered locally.
//
// All names are fictional demo users.

export const TODAY = "2026-11-06";

export const me = {
  authenticated: true,
  username: "Ana",
  role: "admin",
  status: "approved",
};

export const announcements = [
  {
    id: 3,
    content: "Od ponedjeljka nova akcija na televizore – provjerite cijene na policama.",
    created_at: "2026-11-05T08:12:00Z",
    username: "Marko",
  },
  {
    id: 2,
    content: "Raspored za sljedeći tjedan je objavljen. Zahtjeve za smjene šaljite do petka.",
    created_at: "2026-11-03T07:40:00Z",
    username: "Marko",
  },
  {
    id: 1,
    content: "Bravo svima – rekordan mjesec u prodaji jamstava! 🎉",
    created_at: "2026-10-31T16:05:00Z",
    username: "Ana",
  },
];

const W = {
  m32: "Produženo održavanje 3+2 god",
  m23: "Produženo održavanje 2+3 god",
  m52: "Produženo održavanje 5+2 god",
  m23z5: "Produženo održavanje 2+3 god + zaštita od oštećenja 5 god",
  m32z5: "Produženo održavanje 3+2 god + zaštita od oštećenja 5 god",
  m52z7: "Produženo održavanje 5+2 god + zaštita od oštećenja 7 god",
  z1: "Zaštita od oštećenja i loma 1 god",
  z2: "Zaštita od oštećenja i loma 2 god",
  m21: "Produženo održavanje 2+1 god",
};

// [id, receipt, date, product, type, price, user]
const rows = [
  [24, "R-48213", "2026-11-06", "Televizor Samsung 65\"", W.m52z7, 259.74, "Ana"],
  [23, "R-48197", "2026-11-06", "Laptop Lenovo IdeaPad 5", W.m32z5, 143.82, "Ana"],
  [22, "R-48180", "2026-11-06", "iPhone 16 128 GB", W.z2, 215.76, "Luka"],
  [21, "R-48152", "2026-11-05", "Perilica rublja Bosch", W.m52, 77.87, "Petra"],
  [20, "R-48141", "2026-11-05", "Monitor LG 27\"", W.m32, 26.91, "Ana"],
  [19, "R-48120", "2026-11-05", "Samsung Galaxy S25", W.z1, 107.88, "Luka"],
  [18, "R-48099", "2026-11-04", "Hladnjak Gorenje", W.m23z5, 107.82, "Marko"],
  [17, "R-48077", "2026-11-04", "PlayStation 5", W.m32, 49.41, "Petra"],
  [16, "R-48063", "2026-11-04", "MacBook Air 13\"", W.m52z7, 337.74, "Ana"],
  [15, "R-48041", "2026-11-03", "Električni romobil Xiaomi", W.m21, 62.86, "Luka"],
  [14, "R-48022", "2026-11-03", "Sušilica rublja Beko", W.m52, 90.87, "Marko"],
  [13, "R-48010", "2026-11-03", "iPad 11\"", W.z2, 95.76, "Petra"],
  [12, "R-47987", "2026-11-02", "Televizor LG OLED 55\"", W.m52z7, 337.74, "Ana"],
  [11, "R-47960", "2026-11-02", "Printer HP LaserJet", W.m32, 17.91, "Marko"],
  [10, "R-47944", "2026-10-31", "Soundbar Sony", W.m23, 35.91, "Luka"],
  [9, "R-47921", "2026-10-31", "Pametni sat Garmin", W.z1, 41.88, "Petra"],
  [8, "R-47903", "2026-10-30", "Perilica posuđa Candy", W.m32z5, 89.82, "Ana"],
  [7, "R-47889", "2026-10-30", "Klima uređaj Vivax", W.m52, 103.87, "Marko"],
  [6, "R-47861", "2026-10-29", "Laptop ASUS Vivobook", W.m32, 62.91, "Ana"],
  [5, "R-47840", "2026-10-29", "Samsung Galaxy A56", W.z2, 95.76, "Luka"],
];

export const soldWarranties = rows.map(([id, receipt, date, product, type, price, user]) => ({
  id,
  receipt_number: receipt,
  sale_date: date,
  product_name: product,
  warranty_type: type,
  warranty_price: price,
  created_at: `${date}T10:00:00Z`,
  username: user,
}));

// Stats are derived from the same rows with the same grouping the worker's SQL uses,
// so every number on the statistics page is internally consistent.
function group(key) {
  const map = new Map();
  for (const w of soldWarranties) {
    const k = w[key];
    const e = map.get(k) || { count: 0, revenue: 0 };
    e.count += 1;
    e.revenue += w.warranty_price;
    map.set(k, e);
  }
  return [...map.entries()].map(([k, v]) => ({ [key]: k, count: v.count, revenue: Math.round(v.revenue * 100) / 100 }));
}

const byType = group("warranty_type").sort((a, b) => b.count - a.count);
const byUser = group("username").sort((a, b) => b.count - a.count);
const byDay = group("sale_date").sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1));
const totalRevenue = soldWarranties.reduce((s, w) => s + w.warranty_price, 0);

export const warrantyStats = {
  totalSold: soldWarranties.length,
  totalRevenue: Math.round(totalRevenue * 100) / 100,
  averagePrice: totalRevenue / soldWarranties.length,
  highestWarranty: Math.max(...soldWarranties.map(w => w.warranty_price)),
  todaySold: soldWarranties.filter(w => w.sale_date === TODAY).length,
  topWarranty: byType[0].warranty_type,
  byType,
  byDay,
  byUser,
};

export const notes = [
  {
    id: 4,
    title: "Inventura – četvrtak",
    content: "Početak u 7:00.\nProvjeriti skladište TV-a i malih kućanskih aparata.",
    updated_at: "2026-11-06T09:20:00Z",
    created_at: "2026-11-06T09:20:00Z",
  },
  {
    id: 3,
    title: "Kupac – Galaxy S25",
    content: "Javiti se kad stigne plava boja. Zainteresiran za zaštitu od loma 2 god.",
    updated_at: "2026-11-05T14:02:00Z",
    created_at: "2026-11-05T14:02:00Z",
  },
  {
    id: 2,
    title: "Ciljevi za studeni",
    content: "Jamstva uz svaki TV iznad 500 €.\nPonuditi izračun rata svakom kupcu.",
    updated_at: "2026-11-02T08:45:00Z",
    created_at: "2026-11-02T08:45:00Z",
  },
  {
    id: 1,
    title: "Narudžba – police",
    content: "Nove police za odjel mobitela dolaze u utorak.",
    updated_at: "2026-10-30T11:30:00Z",
    created_at: "2026-10-30T11:30:00Z",
  },
];

export const shiftRequests = [
  { id: 31, request_date: "2026-11-09", weekday: "ponedjeljak", shift_type: "jutro", reason: "Liječnički pregled popodne", admin_note: null, status: "pending", created_at: "2026-11-04T09:00:00Z", username: "Petra" },
  { id: 32, request_date: "2026-11-11", weekday: "srijeda", shift_type: "slobodno", reason: "Obiteljske obveze", admin_note: null, status: "pending", created_at: "2026-11-04T12:00:00Z", username: "Luka" },
  { id: 33, request_date: "2026-11-13", weekday: "petak", shift_type: "popodne", reason: "Zamjena smjene s Markom", admin_note: null, status: "pending", created_at: "2026-11-05T08:00:00Z", username: "Ana" },
];

export const dashboardPreferences = { layout: null };

export const profile = {
  username: "Ana",
  role: "admin",
  status: "approved",
  createdAt: "2026-06-05T08:00:00Z",
  warrantyCount: soldWarranties.filter(w => w.username === "Ana").length,
  warrantyRevenue: soldWarranties.filter(w => w.username === "Ana").reduce((s, w) => s + w.warranty_price, 0),
  averageWarrantyPrice: 0,
  highestWarrantyPrice: 337.74,
  topWarranty: W.m52z7,
  notesCount: notes.length,
  lastWarranty: null,
};
