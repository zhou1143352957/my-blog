/*
 * 贪吃蛇 · 像素霓虹
 *
 * 页面级脚本，必须带 data-pjax 才会在 Pjax 跳转后被重新执行；
 * 首次加载时 Pjax 还会再执行一次同名脚本，所以入口先销毁上一个实例。
 *
 * 渲染分两级：
 *   1. 棋盘、蛇、食物画进 210×210 的「设计像素」离屏缓冲（1 设计像素 = 2 屏幕像素），
 *      再按设备像素比整数倍最近邻放大上屏 —— 像素边缘永远清晰，
 *      不会像原来那样在 Retina 屏上被浏览器拉伸糊掉；
 *   2. 粒子、弹字、遮罩画在屏幕层，保持顺滑。
 *
 * 蛇身是「管状剪影」：把插值后的中心点连成折线，栅格化成 6 设计像素宽的管道，
 * 再按「上方为空」的像素加 1px 顶光、下方加 1px 暗边（和废土余生同一套手法）。
 *
 * 手感：格子推进逻辑完全没动，只在绘制时于「上一步」与「这一步」之间插值，
 * 蛇是滑过去的，而不是整格跳过去的。
 *
 * 音效全部 Web Audio 现场合成，零音频文件；AudioContext 必须在用户手势里创建，
 * destroy 时 close，避免 Pjax 反复挂载泄漏。
 */
(function () {
    'use strict';

    if (typeof window.__snakeDestroy === 'function') window.__snakeDestroy();

    var canvas = document.getElementById('snake-canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');

    // ============================================================ 尺寸与栅格
    var LOGICAL = 420;                 // 逻辑边长（CSS 像素），与 index.md 的 canvas 一致
    var CELL = 20;                     // 屏幕像素 / 格
    var SCALE = 2;                     // 1 设计像素 = 2 屏幕像素
    var S = CELL / SCALE;              // 每格 10 设计像素
    var COLS = Math.floor(LOGICAL / CELL);
    var ROWS = COLS;
    var BW = COLS * S;                 // 缓冲尺寸（设计像素）：210
    var BH = ROWS * S;

    var dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    var backW = Math.round(LOGICAL * dpr);
    canvas.width = backW;
    canvas.height = backW;

    var BEST_KEY = 'snake-best-score';
    var MUTE_KEY = 'snake-muted';

    // ============================================================ 调色板
    // 自带一套暗底霓虹色，不再读主题变量 —— 原来的做法是把博客主题背景色当棋盘色，
    // 浅灰面板配半透明主题蓝，既没游戏感，切主题后颜色还不会跟着变。
    var PAL = {
        bg: '#0b0e14',
        cell: '#0e121a',
        grid: '#161d29',
        edge: '#05070b',
        frame: '#243044',
        body: '#3ddc84',
        bodyLite: '#c6ffdf',
        bodyDark: '#1a6b42',
        head: '#5cffa6',
        headLite: '#eafff2',
        eye: '#04140b',
        food: '#ff5d6c',
        foodLite: '#ffd2d7',
        foodDark: '#8e2b36',
        text: '#e6edf5',
        dim: '#7c8ba1'
    };

    // ============================================================ 音效
    var audio = { ctx: null, master: null, noise: null, muted: false };

    try { audio.muted = window.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* 忽略 */ }

    function initAudio() {
        if (audio.ctx) {
            if (audio.ctx.state === 'suspended') audio.ctx.resume();
            return;
        }
        // 必须在用户手势里创建，否则会被自动播放策略挂成 suspended，全程静音
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio.ctx = new Ctx();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = audio.muted ? 0 : 0.45;
        audio.master.connect(audio.ctx.destination);

        var len = Math.floor(audio.ctx.sampleRate * 0.4);
        var buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        audio.noise = buf;
    }

    function tone(opts) {
        if (!audio.ctx || audio.muted) return;
        var ac = audio.ctx;
        var now = ac.currentTime;
        var dur = opts.dur || 0.1;
        var osc = ac.createOscillator();
        osc.type = opts.type || 'triangle';
        osc.frequency.setValueAtTime(Math.max(20, opts.freq), now);
        if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + dur);
        var gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(opts.gain || 0.14, now + 0.006);
        // 目标值必须 > 0，否则 exponentialRamp 会抛错
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(gain).connect(audio.master);
        osc.start(now);
        osc.stop(now + dur + 0.02);
    }

    function noiseSfx(opts) {
        if (!audio.ctx || !audio.noise || audio.muted) return;
        var ac = audio.ctx;
        var now = ac.currentTime;
        var dur = opts.dur || 0.2;
        var src = ac.createBufferSource();
        src.buffer = audio.noise;
        src.loop = true;
        var filter = ac.createBiquadFilter();
        filter.type = opts.filter || 'lowpass';
        filter.frequency.setValueAtTime(Math.max(40, opts.freq || 900), now);
        if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweep), now + dur);
        var gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(opts.gain || 0.2, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(filter).connect(gain).connect(audio.master);
        src.start(now);
        src.stop(now + dur + 0.03);
    }

    // 每得 1 分音高升一点：连吃时有一条向上的旋律线，这是最省事的「爽感」
    function sfxEat(step) {
        var base = 620 * Math.pow(1.0595, Math.min(18, step));
        tone({ freq: base, to: base * 1.5, dur: 0.08, gain: 0.13, type: 'square' });
    }
    function sfxDie() {
        tone({ freq: 320, to: 62, dur: 0.55, gain: 0.2, type: 'sawtooth' });
        noiseSfx({ dur: 0.3, freq: 800, sweep: 120, gain: 0.2 });
    }
    function sfxBest() {
        tone({ freq: 660, to: 660, dur: 0.1, gain: 0.14, type: 'square' });
        window.setTimeout(function () { tone({ freq: 990, to: 990, dur: 0.1, gain: 0.14, type: 'square' }); }, 90);
        window.setTimeout(function () { tone({ freq: 1320, to: 1320, dur: 0.16, gain: 0.13, type: 'square' }); }, 180);
    }
    function sfxTurn() {
        noiseSfx({ dur: 0.03, freq: 2200, gain: 0.05, filter: 'highpass' });
    }

    // ============================================================ 离屏缓冲
    var boardTex = document.createElement('canvas');
    boardTex.width = BW;
    boardTex.height = BH;
    var buffer = document.createElement('canvas');
    buffer.width = BW;
    buffer.height = BH;
    var bctx = buffer.getContext('2d');

    var mask = new Uint8Array(BW * BH);   // 蛇身像素占位，用于顶光/暗边判定
    var maskBox = null;                   // 上一帧的占位范围，用于清理残留

    function bakeBoard() {
        var g = boardTex.getContext('2d');
        g.fillStyle = PAL.bg;
        g.fillRect(0, 0, BW, BH);

        // 棋盘格底纹：两格交替，对比压到极低，只为让空棋盘不平
        g.fillStyle = PAL.cell;
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if ((x + y) % 2 === 0) g.fillRect(x * S, y * S, S, S);
            }
        }

        // 1px 网格
        g.fillStyle = PAL.grid;
        for (var i = 1; i < COLS; i++) {
            g.fillRect(i * S, 0, 1, BH);
            g.fillRect(0, i * S, BW, 1);
        }

        // 内描边 + 阶梯式暗角（用矩形堆叠代替渐变，保持像素质感）
        g.fillStyle = PAL.frame;
        g.fillRect(0, 0, BW, 1);
        g.fillRect(0, BH - 1, BW, 1);
        g.fillRect(0, 0, 1, BH);
        g.fillRect(BW - 1, 0, 1, BH);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(0, 0, BW, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(0, BH - 3, BW, 3);
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(0, 0, 3, BH);
        g.fillRect(BW - 3, 0, 3, BH);
    }
    bakeBoard();

    // ============================================================ 蛇身绘制
    // 把折线栅格化成管道。每个顶点画一个方块，每对相邻顶点画一个 L 形连接，
    // 这样拐弯处不会出现缺口；再统一加描边、顶光、暗边。
    function buildTube(points, width) {
        var rects = [];
        var half = width / 2;
        var i;
        for (i = 0; i < points.length; i++) {
            var p = points[i];
            // 只有尾巴收细；蛇头由 drawHead 单独画，这里不缩，否则管子会在头下掐一下
            var w = (i === points.length - 1) ? Math.max(4, width - 2) : width;
            rects.push({ x: p.x - w / 2, y: p.y - w / 2, w: w, h: w });
        }
        for (i = 0; i < points.length - 1; i++) {
            var a = points[i];
            var b = points[i + 1];
            // 先横后竖，形成 L 形，拐弯处不断管
            rects.push({
                x: Math.min(a.x, b.x) - half, y: a.y - half,
                w: Math.abs(a.x - b.x) + width, h: width
            });
            rects.push({
                x: b.x - half, y: Math.min(a.y, b.y) - half,
                w: width, h: Math.abs(a.y - b.y) + width
            });
        }
        return rects;
    }

    function tubeBounds(rects) {
        var x0 = BW, y0 = BH, x1 = 0, y1 = 0;
        for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            var a = Math.round(r.x) - 1, b = Math.round(r.y) - 1;
            var c = Math.round(r.x + r.w) + 1, d = Math.round(r.y + r.h) + 1;
            if (a < x0) x0 = a;
            if (b < y0) y0 = b;
            if (c > x1) x1 = c;
            if (d > y1) y1 = d;
        }
        return {
            x0: Math.max(0, x0), y0: Math.max(0, y0),
            x1: Math.min(BW, x1), y1: Math.min(BH, y1)
        };
    }

    function clearMaskBox(box) {
        if (!box) return;
        for (var y = box.y0; y < box.y1; y++) {
            for (var x = box.x0; x < box.x1; x++) mask[y * BW + x] = 0;
        }
    }

    function paintTube(rects) {
        var box = tubeBounds(rects);
        // 先把上一帧的占位清掉，否则残留的像素会让顶光画到已经空掉的格子上
        clearMaskBox(maskBox);
        clearMaskBox(box);
        maskBox = box;

        var i, x, y, r, q, x0, y0, w0, h0;
        // 描边：每个矩形外扩 1 设计像素，先铺底
        bctx.fillStyle = PAL.edge;
        for (i = 0; i < rects.length; i++) {
            r = rects[i];
            bctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) - 1,
                Math.round(r.w) + 2, Math.round(r.h) + 2);
        }
        // 主体 + 占位
        bctx.fillStyle = PAL.body;
        for (i = 0; i < rects.length; i++) {
            q = rects[i];
            x0 = Math.round(q.x);
            y0 = Math.round(q.y);
            w0 = Math.round(q.w);
            h0 = Math.round(q.h);
            bctx.fillRect(x0, y0, w0, h0);
            for (y = y0; y < y0 + h0; y++) {
                if (y < 0 || y >= BH) continue;
                for (x = x0; x < x0 + w0; x++) {
                    if (x < 0 || x >= BW) continue;
                    mask[y * BW + x] = 1;
                }
            }
        }
        // 顶光 / 暗边：只看蛇身占位，上方为空就提亮，下方为空就压暗
        for (y = box.y0; y < box.y1; y++) {
            for (x = box.x0; x < box.x1; x++) {
                if (!mask[y * BW + x]) continue;
                if (y === 0 || !mask[(y - 1) * BW + x]) {
                    bctx.fillStyle = PAL.bodyLite;
                    bctx.fillRect(x, y, 1, 1);
                } else if (y + 1 >= BH || !mask[(y + 1) * BW + x]) {
                    bctx.fillStyle = PAL.bodyDark;
                    bctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    function drawHead(px, py, dir) {
        var x = Math.round(px - S / 2);
        var y = Math.round(py - S / 2);
        bctx.fillStyle = PAL.edge;
        bctx.fillRect(x, y, S, S);
        bctx.fillStyle = PAL.head;
        bctx.fillRect(x + 1, y + 1, S - 2, S - 2);
        bctx.fillStyle = PAL.headLite;
        bctx.fillRect(x + 1, y + 1, S - 2, 1);
        bctx.fillRect(x + 1, y + 1, 1, S - 2);
        // 眼睛按朝向摆，一眼看出蛇头朝哪
        bctx.fillStyle = PAL.eye;
        var ex = x + (dir.x > 0 ? S - 4 : dir.x < 0 ? 2 : 2);
        var ey = y + (dir.y > 0 ? S - 4 : dir.y < 0 ? 2 : 2);
        if (dir.x !== 0) {
            bctx.fillRect(ex, y + 2, 2, 2);
            bctx.fillRect(ex, y + S - 4, 2, 2);
        } else {
            bctx.fillRect(x + 2, ey, 2, 2);
            bctx.fillRect(x + S - 4, ey, 2, 2);
        }
    }

    function drawFood(fx, fy, time) {
        var pulse = (Math.sin(time / 240) + 1) / 2;
        var size = 5 + Math.round(pulse * 2);          // 5~7 设计像素，呼吸感
        var off = Math.floor((S - size) / 2);
        var x = Math.round(fx * S + off);
        var y = Math.round(fy * S + off);
        bctx.fillStyle = PAL.edge;
        bctx.fillRect(x - 1, y - 1, size + 2, size + 2);
        bctx.fillStyle = PAL.food;
        bctx.fillRect(x, y, size, size);
        bctx.fillStyle = PAL.foodLite;
        bctx.fillRect(x + 1, y + 1, 2, 2);
        bctx.fillStyle = PAL.foodDark;
        bctx.fillRect(x + size - 3, y + size - 3, 2, 2);
    }

    // ============================================================ 游戏状态
    var snake = [];
    var prevSnake = [];
    var direction = { x: 1, y: 0 };
    var pending = null;
    var food = { x: 0, y: 0 };
    var score = 0;
    var over = false;
    var paused = false;
    var ready = true;          // 开场待开始状态：不自动开跑，等玩家第一次转向
    var stepMs = 190;
    var acc = 0;
    var tween = 0;
    var last = 0;
    var rafId = 0;
    var eatStreak = 0;
    var shake = 0;

    var scoreEl = document.getElementById('snake-score');
    var bestEl = document.getElementById('snake-best');
    var restartEl = document.getElementById('snake-restart');
    var soundEl = document.getElementById('snake-sound');

    var particles = [];
    var floaters = [];
    var rings = [];

    function sameCell(a, b) { return a.x === b.x && a.y === b.y; }

    function readBest() {
        try { return parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
    }
    function saveBest(v) {
        try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 隐私模式忽略 */ }
    }

    function randomFood() {
        var cell;
        var tries = 0;
        do {
            cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
            tries++;
        } while (tries < 400 && snake.some(function (p) { return sameCell(p, cell); }));
        return cell;
    }

    function burst(gx, gy, color, count) {
        var cx = (gx + 0.5) * CELL;
        var cy = (gy + 0.5) * CELL;
        for (var i = 0; i < count; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = 40 + Math.random() * 150;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
                life: 0.45 + Math.random() * 0.3, age: 0,
                size: 2 + Math.random() * 3, color: color
            });
        }
        rings.push({ x: cx, y: cy, r: 6, life: 0.4, age: 0 });
    }

    function reset() {
        var mid = Math.floor(ROWS / 2);
        snake = [{ x: 4, y: mid }, { x: 3, y: mid }, { x: 2, y: mid }];
        prevSnake = snake.map(function (p) { return { x: p.x, y: p.y }; });
        direction = { x: 1, y: 0 };
        pending = null;
        score = 0;
        over = false;
        paused = false;
        ready = true;
        eatStreak = 0;
        shake = 0;
        acc = 0;
        tween = 0;
        particles = [];
        floaters = [];
        rings = [];
        food = randomFood();
        setSpeed(190);
        if (scoreEl) scoreEl.textContent = '0';
        if (bestEl) bestEl.textContent = String(readBest());
    }

    function setSpeed(ms) {
        stepMs = ms;
    }

    function speedFor(sc) {
        // 每得 5 分提速一次，最快 90ms 一步
        return Math.max(90, 200 - Math.floor(sc / 5) * 10);
    }

    function turn(next) {
        if (over || paused) return;
        var current = pending || direction;
        if (next.x === -current.x && next.y === -current.y) return;   // 不能 180 度掉头
        if (ready) {
            // 开场待开始：任何不反向的输入都用来起步
            ready = false;
            pending = next;
            sfxTurn();
            return;
        }
        if (next.x === current.x && next.y === current.y) return;     // 同向不重复登记
        pending = next;
        sfxTurn();
    }

    function stepOnce() {
        if (over || paused || ready) return;
        if (pending) {
            direction = pending;
            pending = null;
        }

        prevSnake = snake.map(function (p) { return { x: p.x, y: p.y }; });

        var head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        var outside = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
        var biteSelf = snake.some(function (part, index) {
            return index < snake.length - 1 && sameCell(part, head);
        });

        if (outside || biteSelf) {
            over = true;
            shake = 1;
            sfxDie();
            burst(snake[0].x, snake[0].y, PAL.food, 18);
            return;
        }

        snake.unshift(head);
        if (sameCell(head, food)) {
            score += 1;
            eatStreak += 1;
            if (scoreEl) scoreEl.textContent = String(score);
            var isBest = score > readBest();
            if (isBest) {
                saveBest(score);
                if (bestEl) bestEl.textContent = String(score);
            }
            burst(food.x, food.y, PAL.food, 10);
            floaters.push({
                x: (food.x + 0.5) * CELL, y: food.y * CELL,
                text: '+' + 1, life: 0.7, age: 0, color: PAL.foodLite
            });
            sfxEat(eatStreak);
            if (isBest && score % 5 === 0) sfxBest();
            food = randomFood();
            setSpeed(speedFor(score));
        } else {
            snake.pop();
            eatStreak = 0;
        }
    }

    function togglePause() {
        if (over) {
            reset();
            return;
        }
        if (ready) {
            ready = false;      // 开场按下空格就直接起步
            return;
        }
        paused = !paused;
    }

    // ============================================================ 渲染
    function lerp(a, b, k) { return a + (b - a) * k; }

    function render(now) {
        // ---- 低分辨率层：棋盘 + 食物 + 蛇
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, BW, BH);
        bctx.drawImage(boardTex, 0, 0);
        drawFood(food.x, food.y, now);

        var k = over || paused ? 1 : tween;
        var pts = [];
        var i;
        for (i = 0; i < snake.length; i++) {
            var cur = snake[i];
            var pv = prevSnake[i];
            if (!pv) pv = prevSnake[prevSnake.length - 1] || cur;
            pts.push({
                x: lerp(pv.x, cur.x, k) * S + S / 2,
                y: lerp(pv.y, cur.y, k) * S + S / 2
            });
        }

        if (pts.length) {
            var rects = buildTube(pts, 6);
            // 尾巴在数组末尾，蛇头由 drawHead 最后单独画，压在最上面
            paintTube(rects);
            drawHead(pts[0].x, pts[0].y, direction);
        }

        // ---- 上屏：整数倍最近邻放大
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, backW, backW);
        var sx = 0, sy = 0;
        if (shake > 0) {
            sx = (Math.random() - 0.5) * 12 * shake;
            sy = (Math.random() - 0.5) * 12 * shake;
        }
        ctx.drawImage(buffer, 0, 0, BW, BH, Math.round(sx), Math.round(sy), backW, backW);

        // ---- 屏幕层：光环、粒子、弹字、遮罩（顺滑，不做像素化）
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';

        for (i = 0; i < rings.length; i++) {
            var rg = rings[i];
            var rp = rg.age / rg.life;
            ctx.globalAlpha = (1 - rp) * 0.7;
            ctx.strokeStyle = PAL.food;
            ctx.lineWidth = 2 * (1 - rp) + 0.5;
            ctx.beginPath();
            ctx.arc(rg.x + sx, rg.y + sy, rg.r + rp * 26, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (i = 0; i < particles.length; i++) {
            var pt = particles[i];
            var pp = pt.age / pt.life;
            ctx.globalAlpha = (1 - pp) * 0.95;
            ctx.fillStyle = pt.color;
            var sz = Math.max(1, pt.size * (1 - pp));
            ctx.fillRect(pt.x + sx - sz / 2, pt.y + sy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;

        if (floaters.length) {
            ctx.textAlign = 'center';
            ctx.font = '700 14px ui-monospace, Menlo, Consolas, monospace';
            for (i = 0; i < floaters.length; i++) {
                var fl = floaters[i];
                var fp = fl.age / fl.life;
                ctx.globalAlpha = 1 - fp;
                ctx.fillStyle = fl.color;
                ctx.fillText(fl.text, fl.x + sx, fl.y + sy - fp * 26);
            }
            ctx.globalAlpha = 1;
            ctx.textAlign = 'start';
        }

        if (ready) {
            // 开场不压暗棋盘：先让人看清画面，再给一条操作提示
            ctx.textAlign = 'center';
            ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
            var hint = '按方向键 / 滑动开始';
            var hw = ctx.measureText(hint).width;
            ctx.fillStyle = 'rgba(5,7,11,0.86)';
            ctx.fillRect(LOGICAL / 2 - hw / 2 - 14, LOGICAL / 2 - 16, hw + 28, 32);
            ctx.fillStyle = PAL.frame;
            ctx.fillRect(LOGICAL / 2 - hw / 2 - 14, LOGICAL / 2 - 16, hw + 28, 1);
            ctx.fillRect(LOGICAL / 2 - hw / 2 - 14, LOGICAL / 2 + 15, hw + 28, 1);
            ctx.fillStyle = PAL.body;
            ctx.fillText(hint, LOGICAL / 2, LOGICAL / 2 + 5);
            ctx.textAlign = 'start';
        } else if (over || paused) {
            var cx = LOGICAL / 2;
            var cy = LOGICAL / 2;
            ctx.fillStyle = 'rgba(5,7,11,0.72)';
            ctx.fillRect(0, 0, LOGICAL, LOGICAL);
            ctx.fillStyle = PAL.frame;
            ctx.fillRect(cx - 130, cy - 62, 260, 124);
            ctx.fillStyle = 'rgba(5,7,11,0.94)';
            ctx.fillRect(cx - 128, cy - 60, 256, 120);
            ctx.textAlign = 'center';
            ctx.fillStyle = over ? PAL.food : PAL.body;
            ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
            ctx.fillText(over ? 'GAME OVER' : 'PAUSED', cx, cy - 10);
            ctx.fillStyle = PAL.dim;
            ctx.font = '500 13px ui-monospace, Menlo, Consolas, monospace';
            ctx.fillText(over ? '得分 ' + score + ' · 最高 ' + readBest() : '空格继续', cx, cy + 20);
            ctx.fillStyle = PAL.text;
            ctx.font = '500 12px ui-monospace, Menlo, Consolas, monospace';
            ctx.fillText(over ? '按空格重新开始' : '', cx, cy + 44);
            ctx.textAlign = 'start';
        }
    }

    function frame(now) {
        rafId = window.requestAnimationFrame(frame);
        var dt = last ? Math.min(64, now - last) : 16;
        last = now;

        if (shake > 0) shake = Math.max(0, shake - dt / 260);

        var i;
        for (i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.age += dt / 1000;
            if (p.age >= p.life) { particles.splice(i, 1); continue; }
            p.x += p.vx * dt / 1000;
            p.y += p.vy * dt / 1000;
            p.vy += 420 * dt / 1000;
        }
        for (i = floaters.length - 1; i >= 0; i--) {
            floaters[i].age += dt / 1000;
            if (floaters[i].age >= floaters[i].life) floaters.splice(i, 1);
        }
        for (i = rings.length - 1; i >= 0; i--) {
            rings[i].age += dt / 1000;
            if (rings[i].age >= rings[i].life) rings.splice(i, 1);
        }

        if (!over && !paused && !ready) {
            acc += dt;
            var guard = 0;
            while (acc >= stepMs && guard < 4) {
                acc -= stepMs;
                stepOnce();
                guard++;
            }
            tween = Math.max(0, Math.min(1, acc / stepMs));
        } else {
            tween = 1;
        }

        render(now);
    }

    // ============================================================ 输入
    var KEY_MAP = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
        W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
    };

    function onKeyDown(event) {
        initAudio();
        var tag = (event.target && event.target.tagName) || '';
        if (/^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
        if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
            event.preventDefault();
            togglePause();
            return;
        }
        var next = KEY_MAP[event.key];
        if (next) {
            event.preventDefault();
            turn(next);
        }
    }

    var touchStart = null;

    function onTouchStart(event) {
        initAudio();
        var touch = event.touches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchMove(event) {
        if (!touchStart) return;
        event.preventDefault();
        var touch = event.touches[0];
        var dx = touch.clientX - touchStart.x;
        var dy = touch.clientY - touchStart.y;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        turn(Math.abs(dx) > Math.abs(dy)
            ? { x: dx > 0 ? 1 : -1, y: 0 }
            : { x: 0, y: dy > 0 ? 1 : -1 });
        touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd() { touchStart = null; }

    function onRestart() {
        initAudio();
        reset();
    }

    function onSound() {
        initAudio();
        audio.muted = !audio.muted;
        try { window.localStorage.setItem(MUTE_KEY, audio.muted ? '1' : '0'); } catch (e) { /* 忽略 */ }
        if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.45;
        if (soundEl) soundEl.textContent = audio.muted ? '音效已关' : '音效已开';
    }

    function onResize() {
        var nd = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
        if (Math.round(nd) === Math.round(dpr) && canvas.width === Math.round(LOGICAL * nd)) return;
        dpr = nd;
        backW = Math.round(LOGICAL * dpr);
        canvas.width = backW;
        canvas.height = backW;
    }

    function destroy() {
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pjax:send', destroy);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        if (restartEl) restartEl.removeEventListener('click', onRestart);
        if (soundEl) soundEl.removeEventListener('click', onSound);
        if (audio.ctx) {
            try { audio.ctx.close(); } catch (e) { /* 已关闭 */ }
            audio.ctx = null;
            audio.master = null;
            audio.noise = null;
        }
        window.__snakeDestroy = null;
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pjax:send', destroy);
    window.addEventListener('resize', onResize);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    if (restartEl) restartEl.addEventListener('click', onRestart);
    if (soundEl) {
        soundEl.addEventListener('click', onSound);
        soundEl.textContent = audio.muted ? '音效已关' : '音效已开';
    }

    window.__snakeDestroy = destroy;
    reset();
    rafId = window.requestAnimationFrame(frame);
})();
