'use strict';

/**
 * 站点级标签插件：渲染「应用卡片列表」（游戏 / 工具等）
 *
 * 用法：{% appcards games %} 或 {% appcards tools %}
 *
 * 数据来源：source/_data/<key>.yml
 *   - class_name    分组标题
 *   - description   分组说明
 *   - equipment_list 卡片列表：name / specification / description / image / link / link_text
 *
 * 为什么要自己渲染：主题自带的 kit 卡片模板把按钮文案写死成「查看文章」，
 * 而且只要 theme.comment.use 有值，每张卡片就会多出一个评论入口，
 * 对游戏和工具都不合适。这里复用主题同一套样式类名（equipment-item-*），
 * 只替换文案并去掉评论入口，避免改动主题源码（主题目录不纳入版本管理）。
 */

const DEFAULT_LINK_TEXT = '打开';

// 属性值转义：只需处理会破坏属性边界的字符，URL 里的 / 和 = 保持原样，便于阅读
function escapeAttr(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 文本节点转义
function escapeText(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function linkHref(hexo, link) {
    const urlFor = hexo.extend.helper.get('url_for');
    return urlFor ? urlFor.call(hexo, link || '#') : escapeAttr(link || '#');
}

function renderCard(hexo, item) {
    const cover = item.image
        ? `<img class="equipment-item-content-item-image" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}">`
        : '';

    return [
        '<div class="equipment-item-content-item">',
        `<div class="equipment-item-content-item-cover">${cover}</div>`,
        '<div class="equipment-item-content-item-info">',
        `<div class="equipment-item-content-item-name">${escapeText(item.name)}</div>`,
        `<div class="equipment-item-content-item-specification">${escapeText(item.specification)}</div>`,
        `<div class="equipment-item-content-item-description">${escapeText(item.description)}</div>`,
        '<div class="equipment-item-content-item-toolbar">',
        `<a class="equipment-item-content-item-link" href="${linkHref(hexo, item.link)}">${escapeText(item.link_text || DEFAULT_LINK_TEXT)}</a>`,
        '</div>',
        '</div>',
        '</div>'
    ].join('');
}

hexo.extend.tag.register('appcards', function (args) {
    const key = (args[0] || '').trim();
    const data = hexo.locals.get('data') || {};
    const groups = data[key];

    if (!key || !groups || !groups.length) {
        return `<!-- appcards: 未在 source/_data/${key || '<key>'}.yml 中找到卡片数据 -->`;
    }

    const sections = groups.map(group => {
        const cards = (group.equipment_list || [])
            .map(item => renderCard(hexo, item))
            .join('');

        return [
            '<div class="equipment-item">',
            `<h2 class="equipment-item-title">${escapeText(group.class_name)}</h2>`,
            `<div class="equipment-item-description">${escapeText(group.description)}</div>`,
            `<div class="equipment-item-content">${cards}</div>`,
            '</div>'
        ].join('');
    }).join('');

    return `<div id="equipment" class="app-cards">${sections}</div>`;
});
