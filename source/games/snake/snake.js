/*
 * 贪吃蛇
 * 说明：页面级脚本，必须带 data-pjax 才会在 Pjax 跳转后被重新执行。
 * 首次加载时 Pjax 还会再执行一次同名脚本，所以入口先销毁上一个实例。
 */
(function () {
    'use strict';

    if (typeof window.__snakeDestroy === 'function') window.__snakeDestroy();

    var canvas = document.getElementById('snake-canvas');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var CELL = 20;
    var COLS = Math.floor(canvas.width / CELL);
    var ROWS = Math.floor(canvas.height / CELL);
    var BEST_KEY = 'snake-best-score';

    var scoreEl = document.getElementById('snake-score');
    var bestEl = document.getElementById('snake-best');
    var restartEl = document.getElementById('snake-restart');

    var rootStyle = getComputedStyle(document.documentElement);
    function themeVar(name, fallback) {
        var value = (rootStyle.getPropertyValue(name) || '').trim();
        return value || fallback;
    }
    var COLOR = {
        board: themeVar('--efu-secondbg', '#f7f7f9'),
        body: themeVar('--efu-theme', '#425aef'),
        food: '#ff6b6b'
    };

    var snake;
    var direction;
    var pending;
    var food;
    var score;
    var timer = null;
    var over;
    var paused;

    function sameCell(a, b) {
        return a.x === b.x && a.y === b.y;
    }

    function readBest() {
        try {
            return parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveBest(value) {
        try {
            window.localStorage.setItem(BEST_KEY, String(value));
        } catch (e) {
            /* 隐私模式下写入失败，忽略 */
        }
    }

    function randomFood() {
        var cell;
        do {
            cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        } while (snake.some(function (part) { return sameCell(part, cell); }));
        return cell;
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    function draw() {
        var size = canvas.width;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = COLOR.board;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = COLOR.food;
        roundRect(food.x * CELL + 4, food.y * CELL + 4, CELL - 8, CELL - 8, 5);

        snake.forEach(function (part, index) {
            ctx.fillStyle = COLOR.body;
            ctx.globalAlpha = index === 0 ? 1 : 0.55;
            roundRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2, 5);
        });
        ctx.globalAlpha = 1;

        if (over || paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, .45)';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '600 20px sans-serif';
            ctx.fillText(over ? '游戏结束' : '已暂停', size / 2, size / 2 - 6);
            ctx.font = '400 13px sans-serif';
            ctx.fillText(over ? '按空格键重新开始' : '按空格键继续', size / 2, size / 2 + 22);
            ctx.textAlign = 'start';
        }
    }

    function setSpeed() {
        // 每得 5 分提速一次，最快 90ms 一步
        var step = Math.max(90, 200 - Math.floor(score / 5) * 10);
        if (timer) clearInterval(timer);
        timer = setInterval(stepOnce, step);
    }

    function reset() {
        var mid = Math.floor(ROWS / 2);
        snake = [{ x: 4, y: mid }, { x: 3, y: mid }, { x: 2, y: mid }];
        direction = { x: 1, y: 0 };
        pending = null;
        score = 0;
        over = false;
        paused = false;
        food = randomFood();
        if (scoreEl) scoreEl.textContent = '0';
        if (bestEl) bestEl.textContent = String(readBest());
        setSpeed();
        draw();
    }

    function turn(next) {
        if (over || paused) return;
        var current = pending || direction;
        if (next.x === -current.x && next.y === -current.y) return; // 不能 180 度掉头
        pending = next;
    }

    function stepOnce() {
        if (over || paused) return;
        if (pending) {
            direction = pending;
            pending = null;
        }

        var head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        var outside = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
        var biteSelf = snake.some(function (part, index) {
            return index < snake.length - 1 && sameCell(part, head);
        });

        if (outside || biteSelf) {
            over = true;
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            draw();
            return;
        }

        snake.unshift(head);
        if (sameCell(head, food)) {
            score += 1;
            if (scoreEl) scoreEl.textContent = String(score);
            if (score > readBest()) {
                saveBest(score);
                if (bestEl) bestEl.textContent = String(score);
            }
            food = randomFood();
            setSpeed();
        } else {
            snake.pop();
        }
        draw();
    }

    function togglePause() {
        if (over) {
            reset();
            return;
        }
        paused = !paused;
        draw();
    }

    var KEY_MAP = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
        W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
    };

    function onKeyDown(event) {
        if (/^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
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

    function onTouchEnd() {
        touchStart = null;
    }

    function onRestart() {
        reset();
    }

    function destroy() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pjax:send', destroy);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        if (restartEl) restartEl.removeEventListener('click', onRestart);
        window.__snakeDestroy = null;
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pjax:send', destroy);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    if (restartEl) restartEl.addEventListener('click', onRestart);

    window.__snakeDestroy = destroy;
    reset();
})();
