'use strict';

/**
 * 站点级过滤：移除主题在页脚自动追加的「框架：Hexo / 主题：Solitude」署名。
 *
 * 为什么要在这里处理：hexo-theme-solitude 4.x 在 layout/includes/footer.pug 里
 * 无条件渲染这两个链接，没有开关可关；而主题目录不纳入版本管理，
 * 直接改主题源码在升级或换机器构建后会丢失。因此在生成阶段对 HTML 做后处理，
 * 无论构建环境装的是哪个主题版本都能生效。
 */

const CREDITS = new RegExp(
    [
        '<a\\b[^>]*href="https://hexo\\.io/"[^>]*>[\\s\\S]*?</a>',
        '<a\\b[^>]*href="https://github\\.com/everfu/hexo-theme-solitude"[^>]*>[\\s\\S]*?</a>'
    ].join('|'),
    'g'
);

hexo.extend.filter.register('after_render:html', function (html) {
    return html.replace(CREDITS, '');
});
