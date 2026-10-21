/**
 * 博客访问统计 Worker
 *
 * 两条路由：
 *   POST /collect  接收前端埋点，写入 D1
 *   GET  /stats    返回 About 页统计模块需要的聚合数据
 *
 * 数据按 Asia/Shanghai（UTC+8）划分自然日，而不是 UTC。
 */

const ALLOWED_ORIGIN = 'https://blog.zhoujie.de5.net';
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      ...headers,
    },
  });
}

// 按 UTC+8 取自然日，格式 YYYY-MM-DD
function dayKey(time = Date.now()) {
  return new Date(time + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

// 每天附加的随机访问量：用日期做种子的固定哈希，
// 同一天多次请求结果一致，不会每次刷新都跳动。
function dayNoise(day, min, max) {
  let hash = 2166136261;
  for (let i = 0; i < day.length; i++) {
    hash ^= day.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const span = Math.max(1, max - min + 1);
  return min + ((hash >>> 0) % span);
}

// 从 from 到 to（含两端）逐日累加随机量
function noiseBetween(from, to, min, max) {
  let total = 0;
  const cursor = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (cursor <= end) {
    total += dayNoise(cursor.toISOString().slice(0, 10), min, max);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

function intVar(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}


async function collect(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== ALLOWED_ORIGIN) return json({ ok: false }, 403);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  const path = String(body.path || '/').slice(0, 200);
  const vid = String(body.vid || '').slice(0, 64);
  if (!vid) return json({ ok: false, error: 'missing vid' }, 400);

  const ts = Date.now();
  await env.DB.prepare(
    'INSERT INTO pageviews (ts, day, path, vid, referrer) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(ts, dayKey(ts), path, vid, String(body.ref || '').slice(0, 300))
    .run();

  return json({ ok: true });
}

async function stats(env) {
  const now = Date.now();
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);
  const monthStart = today.slice(0, 7) + '-01';
  const monthAgo = dayKey(now - 29 * DAY_MS);
  const yearAgo = dayKey(now - 364 * DAY_MS);

  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN day = ?1 THEN 1 ELSE 0 END)             AS today_pv,
       COUNT(DISTINCT CASE WHEN day = ?1 THEN vid END)       AS today_uv,
       SUM(CASE WHEN day = ?2 THEN 1 ELSE 0 END)             AS yesterday_pv,
       COUNT(DISTINCT CASE WHEN day = ?2 THEN vid END)       AS yesterday_uv,
       SUM(CASE WHEN day >= ?3 THEN 1 ELSE 0 END)            AS this_month_pv,
       SUM(CASE WHEN day >= ?4 THEN 1 ELSE 0 END)            AS last_month_pv,
       SUM(CASE WHEN day >= ?5 THEN 1 ELSE 0 END)            AS last_year_pv,
       COUNT(*)                                              AS total_pv,
       COUNT(DISTINCT vid)                                   AS total_uv
     FROM pageviews`
  )
    .bind(today, yesterday, monthStart, monthAgo, yearAgo)
    .first();

  const value = (key) => Number((row && row[key]) || 0);

  // 每天附加的模拟访问量，真实量 + 模拟量合并展示；把上下限都设为 0 即可关闭
  const noiseMin = Math.max(0, intVar(env.DAILY_RANDOM_MIN, 12));
  const noiseMax = Math.max(noiseMin, intVar(env.DAILY_RANDOM_MAX, 45));
  const todayNoise = dayNoise(today, noiseMin, noiseMax);
  const yesterdayNoise = dayNoise(yesterday, noiseMin, noiseMax);

  return json(
    {
      // 人数取模拟访问量的一半左右，保证 UV 始终小于 PV，观感才自然
      today_uv: value('today_uv') + Math.round(todayNoise * 0.5),
      today_pv: value('today_pv') + todayNoise,
      yesterday_uv: value('yesterday_uv') + Math.round(yesterdayNoise * 0.5),
      yesterday_pv: value('yesterday_pv') + yesterdayNoise,
      this_month_pv: value('this_month_pv') + noiseBetween(monthStart, today, noiseMin, noiseMax),
      last_month_pv: value('last_month_pv') + noiseBetween(monthAgo, today, noiseMin, noiseMax),
      last_year_pv: value('last_year_pv') + noiseBetween(yearAgo, today, noiseMin, noiseMax),
      total_uv: value('total_uv'),
      total_pv: value('total_pv'),
    },
    200,
    // 统计不需要实时到秒，短缓存能大幅降低 D1 读取次数
    { 'Cache-Control': 'public, max-age=60' }
  );
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { pathname } = new URL(request.url);

    try {
      if (pathname === '/collect' && request.method === 'POST') {
        return await collect(request, env);
      }
      if (pathname === '/stats' && request.method === 'GET') {
        return await stats(env);
      }
      return json({ ok: false, error: 'not found' }, 404);
    } catch (error) {
      return json({ ok: false, error: String(error && error.message || error) }, 500);
    }
  },
};
