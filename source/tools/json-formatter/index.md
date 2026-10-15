---
title: JSON 格式化
date: 2026-10-15 10:00:00
comment: false
---

<div class="json-tool">
    <div class="json-tool-bar">
        <button class="json-btn json-btn-primary" id="json-format" type="button">格式化</button>
        <button class="json-btn" id="json-compress" type="button">压缩</button>
        <button class="json-btn" id="json-validate" type="button">校验</button>
        <button class="json-btn" id="json-copy" type="button">复制结果</button>
        <button class="json-btn" id="json-clear" type="button">清空</button>
        <select class="json-select" id="json-indent">
            <option value="2">缩进 2 空格</option>
            <option value="4">缩进 4 空格</option>
        </select>
    </div>
    <p class="json-status" id="json-status">等待输入……</p>
    <div class="json-tool-body">
        <textarea class="json-textarea" id="json-input" spellcheck="false" placeholder='在这里粘贴 JSON，例如 {"name":"ZhouJie","tags":["blog","game"]}'></textarea>
        <textarea class="json-textarea" id="json-output" spellcheck="false" readonly placeholder="结果会显示在这里"></textarea>
    </div>
</div>
<link rel="stylesheet" href="/tools/json-formatter/formatter.css">
<script data-pjax src="/tools/json-formatter/formatter.js"></script>
