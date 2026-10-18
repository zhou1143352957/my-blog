---
title: 废土余生
date: 2026-10-16 10:00:00
comment: false
description: 俯视生存搜刮游戏：白天搜刮废墟街区，入夜迎着尸潮撤离。六张手工地图、实时光照、程序化美术。
---

<div class="wl-page">
    <div class="wl-stage" id="wasteland-root">
        <canvas class="wl-canvas"></canvas>
        <div class="wl-hud">
            <div class="wl-topbar">
                <div class="wl-vitals">
                    <div class="wl-vital wl-vital-hp">
                        <span class="wl-vital-label">HP</span>
                        <span class="wl-vital-track"><b id="wl-hp-fill"></b></span>
                        <em id="wl-hp-text">100</em>
                    </div>
                    <div class="wl-vital wl-vital-armor">
                        <span class="wl-vital-label">ARM</span>
                        <span class="wl-vital-track"><b id="wl-armor-fill"></b></span>
                        <em id="wl-armor-text">0</em>
                    </div>
                    <div class="wl-stamina">
                        <span>SPRINT</span>
                        <i><b id="wl-stamina-fill"></b></i>
                    </div>
                </div>
                <div class="wl-clock" id="wl-clock">
                    <div class="wl-clock-ring" id="wl-clock-ring" style="--p:1">
                        <div class="wl-clock-face">
                            <span id="wl-timer">01:15</span>
                            <em id="wl-clock-label">搜刮</em>
                        </div>
                    </div>
                    <div class="wl-clock-copy">
                        <b id="wl-phase">白天</b>
                        <span id="wl-phase-sub">搜刮窗口</span>
                    </div>
                </div>
                <div class="wl-map-wrap">
                    <div class="wl-map-panel">
                        <canvas id="wl-minimap" width="210" height="143"></canvas>
                        <div class="wl-map-foot">
                            <span id="wl-level-no">01</span>
                            <b id="wl-level-name">废车坟场</b>
                        </div>
                        <div class="wl-exit-state" id="wl-exit-state">
                            <i></i>
                            <span id="wl-exit-text">撤离点未开启</span>
                        </div>
                    </div>
                    <div class="wl-sys">
                        <button class="wl-icon-btn" id="wl-sound" type="button"><i></i>音效开</button>
                        <button class="wl-icon-btn" id="wl-pause" type="button">暂停</button>
                    </div>
                </div>
            </div>
            <div class="wl-weapon-card">
                <div class="wl-weapon-top">
                    <span id="wl-weapon-cn">手枪</span>
                    <b id="wl-weapon-name">M1911</b>
                    <em id="wl-reload">换弹中<i><b id="wl-reload-fill"></b></i></em>
                </div>
                <div class="wl-ammo-line">
                    <b id="wl-ammo-mag">12</b>
                    <span>/</span>
                    <em id="wl-ammo-res">60</em>
                    <small>备弹</small>
                </div>
                <div class="wl-slots" id="wl-slots"></div><div class="wl-ammo-types" id="wl-ammo-types"></div>
            </div>
            <div class="wl-inv">
                <div class="wl-inv-item">
                    <span class="wl-ico wl-ico-med">+</span>
                    <b id="wl-medkits">1</b>
                    <em>医疗包</em>
                </div>
                <div class="wl-inv-item">
                    <span class="wl-ico wl-ico-loot">◆</span>
                    <b id="wl-loot-count">0</b>
                    <span class="wl-inv-sep">/</span>
                    <span id="wl-loot-total">14</span>
                    <em>物资</em>
                </div>
                <div class="wl-keys">E 搜刮 · R 换弹 · F 用药 · Shift 冲刺 · Space 翻滚 · Q 近战</div>
            </div>
            <div class="wl-hint" id="wl-hint"></div>
            <div class="wl-prompt is-hidden" id="wl-prompt">
                <div class="wl-prompt-body">
                    <kbd>E</kbd>
                    <span id="wl-prompt-text">按住 E · 搜刮补给箱</span>
                </div>
                <div class="wl-prompt-track"><b id="wl-prompt-fill"></b></div>
            </div>
            <div class="wl-toasts" id="wl-toasts"></div>
            <div class="wl-damage" id="wl-damage"></div>
            <div class="wl-overlay" id="wl-overlay">
                <div class="wl-overlay-inner">
                    <p class="wl-kicker">TOP-DOWN SURVIVAL · 六区撤离</p>
                    <h2 class="wl-title" id="wl-overlay-title">废土余生</h2>
                    <p class="wl-sub">搜索 · 生存 · 撤离</p>
                    <p class="wl-desc" id="wl-overlay-desc"></p>
                    <div class="wl-levels" id="wl-levels"></div>
                    <div class="wl-grade is-hidden" id="wl-grade">
                        <b>S</b>
                        <span>完美撤离</span>
                    </div>
                    <div class="wl-overlay-actions">
                        <button class="wl-btn" id="wl-action" type="button">开始游戏</button>
                        <button class="wl-btn wl-btn-ghost" id="wl-action2" type="button">选择关卡</button>
                    </div>
                    <p class="wl-overlay-foot" id="wl-overlay-foot">WASD 移动 · 鼠标瞄准 · 左键射击 · E 搜刮 · 空格翻滚</p>
                </div>
            </div>
            <div class="wl-touch is-hidden" id="wl-touch">
                <div class="wl-stick wl-stick-move" id="wl-stick">
                    <i id="wl-stick-knob"></i>
                    <span>移动</span>
                </div>
                <div class="wl-stick wl-stick-aim" id="wl-aim">
                    <i id="wl-aim-knob"></i>
                    <span>瞄准 · 自动射击</span>
                </div>
                <div class="wl-touch-acts">
                    <button class="wl-touch-act" data-act="search" type="button">搜刮</button>
                    <button class="wl-touch-act" data-act="reload" type="button">换弹</button>
                    <button class="wl-touch-act" data-act="heal" type="button">用药</button>
                    <button class="wl-touch-act" data-act="melee" type="button">近战</button>
                    <button class="wl-touch-act" data-act="dodge" type="button">翻滚</button>
                    <button class="wl-touch-act" data-act="switch" type="button">切枪</button>
                </div>
            </div>
        </div>
    </div>
    <p class="wl-tip">俯视生存。WASD 移动，鼠标瞄准、左键射击，按住 E 搜刮，R 换弹，F 用医疗包，Shift 冲刺，空格翻滚，Q 近战，1–4 切枪。每区入口附近有枪械箱，枪械、弹药和医疗包会继承到下一区。白天有 60–75 秒搜刮窗口，入夜后尸潮逼近、撤离点亮起，活着走到信号烟处。</p>
</div>
<link rel="stylesheet" href="/games/wasteland/wasteland.css?v=20261019">
<script data-pjax src="/games/wasteland/wasteland.js?v=20261019"></script>
