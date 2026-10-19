---
title: 本地模型配置助手
date: 2026-10-19 10:00:00
comment: false
---

<div class="lm-tool" id="lm-tool">
    <div class="lm-form">
        <label class="lm-field" id="lm-vram-field">
            <span class="lm-label">显卡显存</span>
            <select class="lm-select" id="lm-vram">
                <option value="0">纯 CPU（无独显）</option>
                <option value="4">4 GB</option>
                <option value="6">6 GB</option>
                <option value="8">8 GB</option>
                <option value="10">10 GB</option>
                <option value="12" selected>12 GB</option>
                <option value="16">16 GB</option>
                <option value="24">24 GB</option>
                <option value="32">32 GB</option>
                <option value="48">48 GB</option>
                <option value="80">80 GB</option>
            </select>
        </label>
        <label class="lm-field">
            <span class="lm-label">系统内存</span>
            <select class="lm-select" id="lm-ram">
                <option value="8">8 GB</option>
                <option value="16" selected>16 GB</option>
                <option value="24">24 GB</option>
                <option value="32">32 GB</option>
                <option value="48">48 GB</option>
                <option value="64">64 GB</option>
                <option value="96">96 GB</option>
                <option value="128">128 GB</option>
            </select>
        </label>
        <label class="lm-check">
            <input type="checkbox" id="lm-unified">
            <span>Apple 芯片（统一内存）</span>
        </label>
    </div>
    <div class="lm-result" id="lm-result"></div>
</div>
<link rel="stylesheet" href="/tools/local-models/local-models.css">
<script data-pjax src="/tools/local-models/local-models.js"></script>
