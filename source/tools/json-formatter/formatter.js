/*
 * JSON 格式化工具
 * 说明：页面级脚本，必须带 data-pjax 才会在 Pjax 跳转后被重新执行；
 * 首次加载时会被执行两次，入口先销毁上一个实例。
 */
(function () {
    'use strict';

    if (typeof window.__jsonToolDestroy === 'function') window.__jsonToolDestroy();

    var input = document.getElementById('json-input');
    if (!input) return;

    var output = document.getElementById('json-output');
    var statusEl = document.getElementById('json-status');
    var indentEl = document.getElementById('json-indent');

    var BUTTONS = {
        format: document.getElementById('json-format'),
        compress: document.getElementById('json-compress'),
        validate: document.getElementById('json-validate'),
        copy: document.getElementById('json-copy'),
        clear: document.getElementById('json-clear')
    };

    function setStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'json-status' + (type ? ' is-' + type : '');
    }

    function parseInput() {
        var raw = input.value.trim();
        if (!raw) {
            setStatus('请先粘贴 JSON 内容', 'error');
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            setStatus('解析失败：' + error.message, 'error');
            return null;
        }
    }

    function handleFormat() {
        var data = parseInput();
        if (data === null) return;
        var space = parseInt(indentEl.value, 10) || 2;
        output.value = JSON.stringify(data, null, space);
        setStatus('格式化完成，共 ' + output.value.split('\n').length + ' 行', 'ok');
    }

    function handleCompress() {
        var data = parseInput();
        if (data === null) return;
        output.value = JSON.stringify(data);
        setStatus('压缩完成，共 ' + output.value.length + ' 个字符', 'ok');
    }

    function handleValidate() {
        if (parseInput() === null) return;
        setStatus('语法正确，是合法的 JSON', 'ok');
    }

    function handleCopy() {
        if (!output.value) {
            setStatus('结果为空，先执行一次格式化或压缩', 'error');
            return;
        }
        var done = function () { setStatus('已复制到剪贴板', 'ok'); };
        var failed = function () { setStatus('复制失败，请手动选中结果复制', 'error'); };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output.value).then(done, failed);
            return;
        }
        output.select();
        try {
            document.execCommand('copy') ? done() : failed();
        } catch (error) {
            failed();
        }
    }

    function handleClear() {
        input.value = '';
        output.value = '';
        setStatus('已清空', '');
        input.focus();
    }

    function destroy() {
        if (BUTTONS.format) BUTTONS.format.removeEventListener('click', handleFormat);
        if (BUTTONS.compress) BUTTONS.compress.removeEventListener('click', handleCompress);
        if (BUTTONS.validate) BUTTONS.validate.removeEventListener('click', handleValidate);
        if (BUTTONS.copy) BUTTONS.copy.removeEventListener('click', handleCopy);
        if (BUTTONS.clear) BUTTONS.clear.removeEventListener('click', handleClear);
        document.removeEventListener('pjax:send', destroy);
        window.__jsonToolDestroy = null;
    }

    if (BUTTONS.format) BUTTONS.format.addEventListener('click', handleFormat);
    if (BUTTONS.compress) BUTTONS.compress.addEventListener('click', handleCompress);
    if (BUTTONS.validate) BUTTONS.validate.addEventListener('click', handleValidate);
    if (BUTTONS.copy) BUTTONS.copy.addEventListener('click', handleCopy);
    if (BUTTONS.clear) BUTTONS.clear.addEventListener('click', handleClear);
    document.addEventListener('pjax:send', destroy);

    window.__jsonToolDestroy = destroy;
})();
