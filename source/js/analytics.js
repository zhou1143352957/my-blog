/*
 * 站点访问统计
 * 说明：
 *   - 通过主题配置 extends.body 全站注入，只在首次加载时执行一次；
 *     Pjax 换页不会重新执行，因此这里自己监听 pjax:complete。
 *   - ENDPOINT / STATS_URL 部署 Worker 后替换成实际地址。
 *   - 本地调试（localhost）不统计，避免污染线上数据。
 */
(function () {
    'use strict';

    if (window.__blogAnalyticsDestroy) window.__blogAnalyticsDestroy();

    var ENDPOINT = 'https://REPLACE_WITH_WORKER_URL/collect';
    var STATS_URL = 'https://REPLACE_WITH_WORKER_URL/stats';
    var VID_KEY = 'blog.visitor_id';
    var lastPath = null;
    var statsTimer = null;

    var configured = ENDPOINT.indexOf('REPLACE_WITH_WORKER_URL') === -1
        && STATS_URL.indexOf('REPLACE_WITH_WORKER_URL') === -1;
    var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);

    function visitorId() {
        try {
            var id = localStorage.getItem(VID_KEY);
            if (!id) {
                id = (window.crypto && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : String(Date.now()) + Math.random().toString(36).slice(2, 10);
                localStorage.setItem(VID_KEY, id);
            }
            return id;
        } catch (error) {
            return 'anonymous';
        }
    }

    // 每次路径变化上报一次；同一路径不重复计数（Pjax 首次加载可能触发两次 complete）
    function track() {
        if (!configured || isLocal) return;
        var path = location.pathname + location.search;
        if (path === lastPath) return;
        lastPath = path;

        var payload = JSON.stringify({
            path: path,
            vid: visitorId(),
            ref: document.referrer || ''
        });

        if (navigator.sendBeacon) {
            // text/plain 不会触发 CORS 预检
            var blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
            if (navigator.sendBeacon(ENDPOINT, blob)) return;
        }

        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: payload,
            keepalive: true
        }).catch(function () { /* 统计失败不影响页面 */ });
    }

    // 渲染 About 页统计卡片：
    // 主题自带的统计脚本没有 data-pjax，Pjax 换页后不会执行；
    // 这里在接口返回后统一覆盖写入，保证首次加载与 Pjax 换页后的行一致。
    function renderStats() {
        if (!configured) return;
        var box = document.getElementById('statistic');
        if (!box) return;

        fetch(STATS_URL, { cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var box2 = document.getElementById('statistic');
                if (!box2) return;
                var labels = {
                    this_month_pv: '本月访问',
                    today_pv: '今日访问',
                    today_uv: '今日人数',
                    yesterday_pv: '昨日访问',
                    yesterday_uv: '昨日人数',
                    last_year_pv: '最近年访问'
                };
                var html = '';
                Object.keys(labels).forEach(function (key) {
                    if (data[key] == null) return;
                    html += '<div><span>' + labels[key] + '</span><span>' + data[key] + '</span></div>';
                });
                if (html) box2.innerHTML = html;
            })
            .catch(function () { /* 接口未配置或不支持跨域时静默失败 */ });
    }

    function scheduleStats() {
        if (statsTimer) clearTimeout(statsTimer);
        // 让主题自带脚本先尝试渲染，避免重复插入
        statsTimer = setTimeout(renderStats, 1500);
    }

    function onPjaxComplete() {
        track();
        scheduleStats();
    }

    function destroy() {
        document.removeEventListener('pjax:complete', onPjaxComplete);
        if (statsTimer) clearTimeout(statsTimer);
        window.__blogAnalyticsDestroy = null;
    }

    document.addEventListener('pjax:complete', onPjaxComplete);
    window.__blogAnalyticsDestroy = destroy;

    track();
    scheduleStats();
})();
