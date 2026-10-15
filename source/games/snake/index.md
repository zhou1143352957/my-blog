---
title: 贪吃蛇
date: 2026-10-15 10:00:00
comment: false
---

<div class="snake-page">
    <div class="snake-hud">
        <span class="snake-hud-item">得分 <b id="snake-score">0</b></span>
        <span class="snake-hud-item">最高分 <b id="snake-best">0</b></span>
        <button class="snake-btn" id="snake-restart" type="button">重新开始</button>
    </div>
    <canvas id="snake-canvas" width="420" height="420"></canvas>
    <p class="snake-tip">方向键或 WASD 控制方向，空格暂停；手机上在棋盘内滑动即可转向。</p>
</div>
<link rel="stylesheet" href="/games/snake/snake.css">
<script data-pjax src="/games/snake/snake.js"></script>
