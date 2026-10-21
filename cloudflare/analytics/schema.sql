-- 博客访问统计表
-- 在 Cloudflare D1 中执行：wrangler d1 execute blog-analytics --remote --file schema.sql

CREATE TABLE IF NOT EXISTS pageviews (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ts       INTEGER NOT NULL,           -- 毫秒时间戳
    day      TEXT    NOT NULL,           -- 按 UTC+8 划分的自然日 YYYY-MM-DD
    path     TEXT    NOT NULL,           -- 页面路径（含查询串）
    vid      TEXT    NOT NULL,           -- 浏览器本地生成的访客 ID，用于算 UV
    referrer TEXT                        -- 来源页
);

CREATE INDEX IF NOT EXISTS idx_pageviews_day ON pageviews (day);
CREATE INDEX IF NOT EXISTS idx_pageviews_vid_day ON pageviews (vid, day);
