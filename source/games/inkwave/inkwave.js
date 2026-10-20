/*
 * INKWAVE 页面脚本
 * 说明：页面级脚本，必须带 data-pjax 才会在 Pjax 跳转后被重新执行；
 * 首次加载时会被执行两次，入口先销毁上一个实例。
 */
(function () {
    'use strict';

    if (typeof window.__inkwaveDestroy === 'function') window.__inkwaveDestroy();

    var stage = document.querySelector('.iw-stage');
    var frame = document.querySelector('.iw-frame');
    var button = document.getElementById('iw-full');
    if (!stage || !frame || !button) return;

    // 优先让 iframe 自身全屏，降级到外层舞台容器
    function requestFullscreen() {
        var target = frame;
        if (target.requestFullscreen) {
            target.requestFullscreen().catch(function () {
                if (stage.requestFullscreen) stage.requestFullscreen();
            });
            return;
        }
        if (stage.requestFullscreen) stage.requestFullscreen();
    }

    function handleClick() {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            return;
        }
        requestFullscreen();
    }

    function syncLabel() {
        button.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    }

    function destroy() {
        button.removeEventListener('click', handleClick);
        document.removeEventListener('fullscreenchange', syncLabel);
        document.removeEventListener('pjax:send', destroy);
        window.__inkwaveDestroy = null;
    }

    button.addEventListener('click', handleClick);
    document.addEventListener('fullscreenchange', syncLabel);
    document.addEventListener('pjax:send', destroy);

    window.__inkwaveDestroy = destroy;
    syncLabel();
})();
