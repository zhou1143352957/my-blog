/*
 * 本地模型配置助手
 * 说明：页面级脚本，必须带 data-pjax 才会在 Pjax 跳转后被重新执行；
 * 首次加载时会被执行两次，入口先销毁上一个实例。
 */
(function () {
    'use strict';

    if (typeof window.__lmToolDestroy === 'function') window.__lmToolDestroy();

    var root = document.getElementById('lm-tool');
    if (!root) return;

    var vramEl = document.getElementById('lm-vram');
    var ramEl = document.getElementById('lm-ram');
    var unifiedEl = document.getElementById('lm-unified');
    var vramField = document.getElementById('lm-vram-field');
    var resultEl = document.getElementById('lm-result');

    // 量化档：按「质量从低到高」排列，bpw = 每权重比特数，用于估算权重体积
    var QUANTS = [
        { key: 'Q4_K_M', bpw: 0.60 },
        { key: 'Q5_K_M', bpw: 0.72 },
        { key: 'Q6_K', bpw: 0.86 },
        { key: 'Q8_0', bpw: 1.10 },
        { key: 'FP16', bpw: 2.05 }
    ];

    // 内置模型库（静态数据，可自行增删）
    // params = 总参数量（MoE 模型显存按总参数算）；active = 实际参与计算的参数量（决定速度）
    var MODELS = [
        { name: 'Llama 3.2 1B', params: 1.2, active: 1.2, type: 'Dense', note: '英文轻量助手，中文较弱' },
        { name: 'Qwen3 4B', params: 4.0, active: 4.0, type: 'Dense', note: '小杯通用，支持思考模式' },
        { name: 'Qwen2.5 3B', params: 3.1, active: 3.1, type: 'Dense', note: '中文小模型首选' },
        { name: 'Llama 3.2 3B', params: 3.2, active: 3.2, type: 'Dense', note: '英文通用小模型' },
        { name: 'Phi-3.5 Mini', params: 3.8, active: 3.8, type: 'Dense', note: '偏推理，英文为主' },
        { name: 'Nomic Embed Text', params: 0.1, active: 0.1, type: 'Embedding', note: '向量检索用，不是对话模型' },
        { name: 'Qwen2.5 7B', params: 7.6, active: 7.6, type: 'Dense', note: '中文通用主力，性价比高' },
        { name: 'Qwen3 8B', params: 8.2, active: 8.2, type: 'Dense', note: '通用，支持思考模式' },
        { name: 'Llama 3.1 8B', params: 8.0, active: 8.0, type: 'Dense', note: '英文通用主力' },
        { name: 'Qwen2.5 Coder 7B', params: 7.6, active: 7.6, type: 'Dense', note: '代码生成与补全' },
        { name: 'Mistral 7B v0.3', params: 7.2, active: 7.2, type: 'Dense', note: '英文老牌基础款' },
        { name: 'GLM-4 9B', params: 9.4, active: 9.4, type: 'Dense', note: '中文对话优化' },
        { name: 'Gemma 2 9B', params: 9.2, active: 9.2, type: 'Dense', note: '英文质量高' },
        { name: 'R1 Distill Qwen 7B', params: 7.6, active: 7.6, type: 'Dense', note: '带推理链，中英均可' },
        { name: 'Qwen2.5-VL 7B', params: 8.3, active: 8.3, type: 'Vision', note: '看图，中文强' },
        { name: 'Gemma 3 4B', params: 4.3, active: 4.3, type: 'Vision', note: '轻量多模态' },
        { name: 'InternLM 2.5 7B', params: 7.7, active: 7.7, type: 'Dense', note: '中文对话' },
        { name: 'Qwen2.5 14B', params: 14.8, active: 14.8, type: 'Dense', note: '中文质量明显提升' },
        { name: 'Phi-4 14B', params: 14.7, active: 14.7, type: 'Dense', note: '推理与数学较强' },
        { name: 'Gemma 3 12B', params: 12.2, active: 12.2, type: 'Vision', note: '多模态中杯' },
        { name: 'Gemma 2 27B', params: 27.2, active: 27.2, type: 'Dense', note: '英文大杯' },
        { name: 'Qwen3 30B-A3B', params: 30.5, active: 3.3, type: 'MoE', note: '跑起来快，但显存按 30B 算' },
        { name: 'Qwen2.5 32B', params: 32.8, active: 32.8, type: 'Dense', note: '中文接近本地可用上限' },
        { name: 'Qwen2.5 Coder 32B', params: 32.8, active: 32.8, type: 'Dense', note: '本地代码最强档' },
        { name: 'Mixtral 8x7B', params: 46.7, active: 12.9, type: 'MoE', note: 'MoE 经典款，显存吃满' },
        { name: 'Llama 3.3 70B', params: 70.6, active: 70.6, type: 'Dense', note: '本地顶配才有戏' },
        { name: 'Qwen2.5 72B', params: 72.7, active: 72.7, type: 'Dense', note: '中文天花板' },
        { name: 'Llama 4 Scout', params: 109, active: 17, type: 'MoE', note: 'MoE，超长上下文' },
        { name: 'Mixtral 8x22B', params: 141, active: 39, type: 'MoE', note: 'MoE 大杯' },
        { name: 'Qwen3 235B-A22B', params: 235, active: 22, type: 'MoE', note: 'MoE 超大杯，本地几乎不现实' }
    ];

    var STATUS = {
        ok: { label: '可流畅运行', rank: 0 },
        warn: { label: '可以运行', rank: 1 },
        slow: { label: '内存混合，较慢', rank: 2 },
        no: { label: '跑不动', rank: 3 }
    };

    var onlyRunnable = false;
    var flashTimer = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // 单个模型在指定量化档下的显存/内存占用（GB）
    function vramFor(model, bpw) {
        var weights = model.params * bpw;
        var kvFactor = model.type === 'MoE' ? 0.02 : 0.045;
        var runtime = model.params * kvFactor + 0.7;
        return weights + runtime;
    }

    // 汇总当前配置：可用于模型的资源池
    function configPool() {
        var ram = parseInt(ramEl.value, 10) || 0;
        if (unifiedEl.checked) return { pool: ram * 0.7, ram: ram, cpu: false, unified: true };
        var vram = parseInt(vramEl.value, 10) || 0;
        if (vram > 0) return { pool: vram, ram: ram, cpu: false, unified: false };
        return { pool: ram * 0.6, ram: ram, cpu: true, unified: false };
    }

    // 从高到低挑第一个放得下的量化档
    function bestQuant(model, pool) {
        for (var i = QUANTS.length - 1; i >= 0; i--) {
            if (vramFor(model, QUANTS[i].bpw) <= pool * 0.92) return QUANTS[i];
        }
        return null;
    }

    function evaluate(model, cfg) {
        var quant = bestQuant(model, cfg.pool);
        if (quant) {
            var need = vramFor(model, quant.bpw);
            return { quant: quant.key, need: need, status: cfg.pool / need >= 1.3 ? 'ok' : 'warn' };
        }
        var base = vramFor(model, QUANTS[0].bpw);
        if (!cfg.cpu && cfg.ram >= base * 0.9) {
            return { quant: QUANTS[0].key, need: base, status: 'slow' };
        }
        return { quant: null, need: base, status: 'no' };
    }

    function speedLabel(active, status, cpu) {
        if (status === 'no') return '';
        var lo, hi;
        if (active <= 1.5) { lo = 40; hi = 110; }
        else if (active <= 4) { lo = 25; hi = 65; }
        else if (active <= 9) { lo = 15; hi = 38; }
        else if (active <= 15) { lo = 8; hi = 22; }
        else if (active <= 35) { lo = 4; hi = 11; }
        else { lo = 1; hi = 5; }
        if (cpu || status === 'slow') {
            lo = Math.max(1, Math.round(lo / 4));
            hi = Math.max(lo + 1, Math.round(hi / 3));
        }
        return lo + '–' + hi + ' tokens/s';
    }

    // 「能好好跑」的模型优先（流畅与可以运行同档），同档里挑参数量最大的
    function tierOf(status) {
        if (status === 'ok' || status === 'warn') return 0;
        return status === 'slow' ? 1 : 2;
    }

    function pickTop(rows) {
        var best = null;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.res.status === 'no') continue;
            var better = !best ||
                tierOf(row.res.status) < tierOf(best.res.status) ||
                (tierOf(row.res.status) === tierOf(best.res.status) && row.model.params > best.model.params);
            if (better) best = row;
        }
        return best;
    }

    function summaryHtml(top, cfg) {
        if (!top) {
            return '<div class="lm-summary"><div class="lm-summary-main">当前配置下没有能跑起来的模型。可以把量化降到 Q4_K_M，或者换一台内存更大的机器再试。</div></div>';
        }
        var file = top.model.name.replace(/[^A-Za-z0-9.]+/g, '-').replace(/-+$/, '') + '-' + top.res.quant + '.gguf';
        var cmd = 'llama-server -m ' + file + ' -ngl 99 -c 8192 --port 8080';
        var speed = speedLabel(top.model.active, top.res.status, cfg.cpu);

        return '' +
            '<div class="lm-summary">' +
            '<div class="lm-summary-main">推荐主力：<b>' + escapeHtml(top.model.name) + '</b>' +
            ' · ' + top.res.quant +
            ' · 约 ' + top.res.need.toFixed(1) + ' / ' + cfg.pool.toFixed(1) + ' GB' +
            (speed ? ' · ' + speed : '') +
            '</div>' +
            '<pre class="lm-cmd" id="lm-cmd">' + escapeHtml(cmd) + '</pre>' +
            '<div class="lm-actions"><button class="lm-copy" id="lm-copy" type="button">复制命令</button></div>' +
            '<p class="lm-tip">显存不够时把 <code>-ngl</code> 调小（24 甚至 0，0 表示纯 CPU）。模型文件在 Hugging Face 搜索「bartowski + 模型名 + GGUF」。' +
            '所有数值为估算，实际速度取决于显卡带宽、上下文长度与驱动版本。</p>' +
            '</div>';
    }

    function rowHtml(model, res, cfg) {
        var pct = Math.min(100, Math.round((res.need / cfg.pool) * 100));
        var barClass = res.status === 'warn' ? ' is-warn' : (res.status === 'no' ? ' is-no' : '');
        var usage = res.quant
            ? res.quant + ' · ' + res.need.toFixed(1) + ' / ' + cfg.pool.toFixed(1) + ' GB'
            : '至少 ' + res.need.toFixed(1) + ' GB';

        return '' +
            '<div class="lm-row is-' + res.status + '">' +
            '<div class="lm-row-left">' +
            '<div class="lm-row-name">' + escapeHtml(model.name) + '<span class="lm-tag">' + model.type + '</span></div>' +
            '<div class="lm-row-note">' + escapeHtml(model.note) + '</div>' +
            '</div>' +
            '<div class="lm-row-right">' +
            '<div class="lm-vram">' + usage + '</div>' +
            '<div class="lm-bar' + barClass + '"><i style="width:' + pct + '%"></i></div>' +
            '<div class="lm-status is-' + res.status + '">' + STATUS[res.status].label + '</div>' +
            '</div>' +
            '</div>';
    }

    function render() {
        var cfg = configPool();
        var rows = MODELS.map(function (model) {
            return { model: model, res: evaluate(model, cfg) };
        }).sort(function (a, b) {
            var ra = STATUS[a.res.status].rank;
            var rb = STATUS[b.res.status].rank;
            if (ra !== rb) return ra - rb;
            return b.model.params - a.model.params;
        });

        var runnable = rows.filter(function (row) { return row.res.status !== 'no'; });

        var html = summaryHtml(pickTop(rows), cfg);
        html += '<div class="lm-list-head">' +
            '<span>共 ' + MODELS.length + ' 个模型，' + runnable.length + ' 个可运行</span>' +
            '<label class="lm-filter"><input type="checkbox" id="lm-only"' + (onlyRunnable ? ' checked' : '') +
            '><span>只看可运行</span></label>' +
            '</div>';
        html += '<div class="lm-list' + (onlyRunnable ? ' is-only' : '') + '">';
        html += rows.length
            ? rows.map(function (row) { return rowHtml(row.model, row.res, cfg); }).join('')
            : '<div class="lm-empty">暂无数据。</div>';
        html += '</div>';

        resultEl.innerHTML = html;
    }

    function syncUnified() {
        if (unifiedEl.checked) {
            vramField.classList.add('is-off');
        } else {
            vramField.classList.remove('is-off');
        }
    }

    function flash(btn, text) {
        if (flashTimer) clearTimeout(flashTimer);
        btn.textContent = text;
        flashTimer = setTimeout(function () { btn.textContent = '复制命令'; }, 1500);
    }

    function copyText(text, btn) {
        var done = function () { flash(btn, '已复制'); };
        var failed = function () { flash(btn, '复制失败'); };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, failed);
            return;
        }
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
            document.execCommand('copy') ? done() : failed();
        } catch (error) {
            failed();
        }
        document.body.removeChild(area);
    }

    function handleChange() {
        syncUnified();
        render();
    }

    function handleResultClick(event) {
        var btn = event.target && event.target.closest ? event.target.closest('#lm-copy') : null;
        if (!btn) return;
        var cmd = resultEl.querySelector('#lm-cmd');
        if (cmd) copyText(cmd.textContent, btn);
    }

    function handleResultInput(event) {
        if (!event.target || event.target.id !== 'lm-only') return;
        onlyRunnable = event.target.checked;
        var list = resultEl.querySelector('.lm-list');
        if (!list) return;
        if (onlyRunnable) list.classList.add('is-only');
        else list.classList.remove('is-only');
    }

    function destroy() {
        vramEl.removeEventListener('change', handleChange);
        ramEl.removeEventListener('change', handleChange);
        unifiedEl.removeEventListener('change', handleChange);
        resultEl.removeEventListener('click', handleResultClick);
        resultEl.removeEventListener('change', handleResultInput);
        if (flashTimer) clearTimeout(flashTimer);
        document.removeEventListener('pjax:send', destroy);
        window.__lmToolDestroy = null;
    }

    vramEl.addEventListener('change', handleChange);
    ramEl.addEventListener('change', handleChange);
    unifiedEl.addEventListener('change', handleChange);
    resultEl.addEventListener('click', handleResultClick);
    resultEl.addEventListener('change', handleResultInput);
    document.addEventListener('pjax:send', destroy);

    window.__lmToolDestroy = destroy;

    syncUnified();
    render();
})();
