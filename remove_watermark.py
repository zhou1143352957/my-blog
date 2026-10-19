#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用图片水印去除工具

依赖：PyQt5（图片解码/编码）、NumPy（像素运算）。不需要 Pillow 或 ImageMagick。

原理：
  1. 用「分块中位数」估计局部背景色 —— 面积大的色块（插画主体、阴影）会把
     自己那一块的中位数拉到自身颜色，因此不会被误判成水印；只有细窄的水印笔画
     会比所在块的中位数明显偏亮或偏暗
  2. 找出相对局部背景偏亮 / 偏暗的像素
  3. 连通域标记，按间距把相邻的域合并成组（水印的几个字通常各自独立，需要合并），
     再挑出离指定角落最近的一组作为水印包围盒
  4. 用包围盒外圈的真实背景像素回填：
     - copy ：从某一侧取背景色回填，保留单向渐变
     - blend：上下左右四边做双线性插值回填，适合水印不在画面边角的情况
     - solid：用外圈平均色平铺
     - auto ：四边余量充足时用 blend，否则用 copy

用法示例：
  # 自动检测右下角水印并回填，默认输出 xxx_nowm.jpg
  python3 remove_watermark.py cover.jpg

  # 只检测、确认包围盒对不对，不写文件
  python3 remove_watermark.py cover.jpg --dry-run --verbose

  # 已知水印位置，直接给矩形（跳过检测）
  python3 remove_watermark.py cover.jpg -o out.jpg --rect 1169,891,38,12

  # 水印是深色的、位于左下角、把搜索范围调大
  python3 remove_watermark.py cover.jpg --corner bl --polarity dark --search 40x30

  # 批量处理
  python3 remove_watermark.py *.jpg -o ./cleaned
"""

import argparse
import glob
import os
import sys

import numpy as np
from PyQt5.QtGui import QImage

CORNERS = ('br', 'bl', 'tr', 'tl')
FILLS = ('auto', 'copy', 'blend', 'solid')
DIRECTIONS = ('top', 'bottom', 'left', 'right')


# ---------------------------------------------------------------------------
# 图片读写（统一按 Format_RGB32 处理，内存中每像素 4 字节：B, G, R, A）
# ---------------------------------------------------------------------------

def load_image(path):
    """读取图片，返回 (ndarray, width, height)；数组形状 (h, w, 4)。"""
    image = QImage(path)
    if image.isNull():
        raise ValueError('无法读取图片：%s' % path)

    image = image.convertToFormat(QImage.Format_RGB32)
    width, height = image.width(), image.height()

    buffer = image.constBits()
    buffer.setsize(image.sizeInBytes())
    raw = np.frombuffer(buffer, np.uint8).reshape(height, image.bytesPerLine())
    # 每行行尾可能有对齐填充，按实际宽度截断后再 reshape
    pixels = raw[:, :width * 4].reshape(height, width, 4).copy()
    return pixels, width, height


def save_image(pixels, path, quality):
    """写出图片。pixels 必须保持存活到 save 返回（QImage 不复制缓冲区）。"""
    height, width = pixels.shape[:2]
    data = np.ascontiguousarray(pixels).tobytes()
    image = QImage(data, width, height, width * 4, QImage.Format_RGB32)
    if not image.save(path, quality=quality):
        raise IOError('写出失败：%s' % path)


def luminance(pixels):
    """亮度图，返回 float32 的 (h, w) 数组。"""
    rgb = pixels[:, :, 2::-1].astype(np.float32)  # R, G, B
    return 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]


# ---------------------------------------------------------------------------
# 局部背景估计
# ---------------------------------------------------------------------------

def local_background(lum, block):
    """分块取中位数得到局部背景图（细笔画不影响中位数，大面积色块则会被同化）。"""
    height, width = lum.shape
    rows = max(1, (height + block - 1) // block)
    cols = max(1, (width + block - 1) // block)

    padded = np.pad(lum, ((0, rows * block - height), (0, cols * block - width)), mode='edge')
    tiles = padded.reshape(rows, block, cols, block).transpose(0, 2, 1, 3).reshape(rows, cols, -1)
    medians = np.median(tiles, axis=2)
    full = np.repeat(np.repeat(medians, block, axis=0), block, axis=1)
    return full[:height, :width]


# ---------------------------------------------------------------------------
# 连通域与分组
# ---------------------------------------------------------------------------

def label_components(mask):
    """连通域标记（四邻域），返回 int32 标签图，0 表示背景。"""
    labels = np.zeros(mask.shape, np.int32)
    remaining = mask.copy()
    label = 0

    while remaining.any():
        label += 1
        seed = np.argwhere(remaining)[0]
        component = np.zeros_like(remaining)
        component[seed[0], seed[1]] = True
        while True:
            grown = component.copy()
            grown[1:, :] |= component[:-1, :]
            grown[:-1, :] |= component[1:, :]
            grown[:, 1:] |= component[:, :-1]
            grown[:, :-1] |= component[:, 1:]
            grown &= remaining
            if grown.sum() == component.sum():
                break
            component = grown
        labels[component] = label
        remaining &= ~component

    return labels


def boxes_touch(a, b, gap):
    """两个包围盒 (y0, y1, x0, x1) 的间距是否不超过 gap。"""
    return not (a[1] + gap < b[0] or b[1] + gap < a[0]
                or a[3] + gap < b[2] or b[3] + gap < a[2])


def group_boxes(boxes, gap):
    """把间距不超过 gap 的包围盒合并成组（水印的几个字会被合成一组）。"""
    parent = list(range(len(boxes)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            if boxes_touch(boxes[i], boxes[j], gap):
                root_i, root_j = find(i), find(j)
                if root_i != root_j:
                    parent[root_j] = root_i

    groups = {}
    for i, box in enumerate(boxes):
        groups.setdefault(find(i), []).append(box)
    return list(groups.values())


def box_corner_distance(box, corner_x, corner_y):
    """角点到包围盒的最短距离（切比雪夫），0 表示角点落在盒内。"""
    y0, y1, x0, x1 = box
    dx = max(x0 - corner_x, corner_x - x1, 0)
    dy = max(y0 - corner_y, corner_y - y1, 0)
    return max(dx, dy)


def union_boxes(boxes):
    return (min(b[0] for b in boxes), max(b[1] for b in boxes),
            min(b[2] for b in boxes), max(b[3] for b in boxes))


# ---------------------------------------------------------------------------
# 水印检测
# ---------------------------------------------------------------------------

def search_rect(corner, size, width, height):
    """「搜索角 + 尺寸百分比」换算为像素矩形 (y0, y1, x0, x1)。"""
    sw = max(1, min(width, int(round(width * size[0] / 100.0))))
    sh = max(1, min(height, int(round(height * size[1] / 100.0))))
    x0 = 0 if corner in ('tl', 'bl') else width - sw
    y0 = 0 if corner in ('tl', 'tr') else height - sh
    return y0, y0 + sh, x0, x0 + sw


def detect(pixels, rect, width, height, tolerance, polarity, corner,
           min_pixels=3, min_group_pixels=8, gap=10, verbose=False):
    """在 rect 内检测水印，返回 (全局包围盒 或 None, 局部背景中位数)。"""
    y0, y1, x0, x1 = rect
    sub = luminance(pixels)[y0:y1, x0:x1]

    block = max(4, min(16, min(sub.shape) // 6))
    background = local_background(sub, block)
    diff = sub - background

    bright = diff > tolerance
    dark = diff < -tolerance

    if polarity == 'bright':
        mask = bright
    elif polarity == 'dark':
        mask = dark
    else:
        # 自动极性：偏亮与偏暗一起作为候选，最后由「离角点最近的一组」决定取舍，
        # 避免因误判明暗而选中插画边缘等错误目标
        mask = bright | dark

    if not mask.any():
        if verbose:
            print('  搜索区 = (%d,%d)-(%d,%d)  分块 = %d  未发现候选像素'
                  % (x0, y0, x1 - 1, y1 - 1, block))
        return None, float(np.median(sub))

    labels = label_components(mask)

    boxes = []
    for label in range(1, int(labels.max()) + 1):
        rows, cols = np.nonzero(labels == label)
        if rows.size < min_pixels:
            continue
        boxes.append((int(rows.min()), int(rows.max()), int(cols.min()), int(cols.max()), int(rows.size)))

    if not boxes:
        if verbose:
            print('  没有达到最小像素数的连通域，视为未检出')
        return None, float(np.median(sub))

    groups = group_boxes(boxes, gap)

    corner_x = x1 - x0 - 1 if corner in ('tr', 'br') else 0
    corner_y = y1 - y0 - 1 if corner in ('bl', 'br') else 0
    # 水印一定是「小且贴着角落」的：离角点太远或像素数太少的一律排除，
    # 避免在没有水印的图上误选插画边缘
    max_distance = 0.15 * min(width, height)

    eligible = []
    for group in groups:
        box = union_boxes(group)
        if box_corner_distance(box, corner_x, corner_y) > max_distance:
            continue
        if sum(item[4] for item in group) < min_group_pixels:
            continue
        eligible.append((box, group))

    if verbose:
        print('  连通域 = %d  合并为 %d 组  通过筛选（离角点 <= %.0fpx、像素数 >= %d）= %d 组'
              % (len(boxes), len(groups), max_distance, min_group_pixels, len(eligible)))

    if not eligible:
        return None, float(np.median(sub))

    best_box, best_group = min(eligible,
                               key=lambda item: box_corner_distance(item[0], corner_x, corner_y))

    if verbose and len(eligible) > 1:
        print('  取离角点最近的一组（含 %d 个连通域）' % len(best_group))

    ty0, ty1, tx0, tx1 = best_box
    return (ty0 + y0, ty1 + y0, tx0 + x0, tx1 + x0), float(np.median(sub))


# ---------------------------------------------------------------------------
# 回填
# ---------------------------------------------------------------------------

def pick_direction(rect, width, height, preferred=None):
    """按可回填余量挑方向：优先用显式指定的，否则选余量最大的一侧。"""
    fy0, fy1, fx0, fx1 = rect
    margins = {'top': fy0, 'bottom': height - 1 - fy1,
               'left': fx0, 'right': width - 1 - fx1}
    usable = [d for d in DIRECTIONS if margins[d] >= 2]
    if preferred and preferred in usable:
        return preferred
    if not usable:
        return None
    return max(usable, key=lambda d: margins[d])


def fill_copy(pixels, rect, direction):
    """从某一侧取背景像素回填，保留该方向的渐变。"""
    fy0, fy1, fx0, fx1 = rect
    height, width = pixels.shape[:2]

    if direction == 'top':
        source = pixels[max(0, fy0 - 4):fy0, fx0:fx1 + 1]
        pixels[fy0:fy1 + 1, fx0:fx1 + 1] = source.mean(axis=0).round().astype(np.uint8)
    elif direction == 'bottom':
        source = pixels[fy1 + 1:min(height, fy1 + 5), fx0:fx1 + 1]
        pixels[fy0:fy1 + 1, fx0:fx1 + 1] = source.mean(axis=0).round().astype(np.uint8)
    elif direction == 'left':
        source = pixels[fy0:fy1 + 1, max(0, fx0 - 4):fx0]
        pixels[fy0:fy1 + 1, fx0:fx1 + 1] = source.mean(axis=1).round().astype(np.uint8)[:, None, :]
    else:
        source = pixels[fy0:fy1 + 1, fx1 + 1:min(width, fx1 + 5)]
        pixels[fy0:fy1 + 1, fx0:fx1 + 1] = source.mean(axis=1).round().astype(np.uint8)[:, None, :]


def fill_blend(pixels, rect):
    """用四边背景做双线性插值回填，适合水印不贴边的场景。"""
    fy0, fy1, fx0, fx1 = rect
    height, width = pixels.shape[:2]
    rows, cols = fy1 - fy0 + 1, fx1 - fx0 + 1

    top = pixels[fy0 - 1, fx0:fx1 + 1] if fy0 - 1 >= 0 else None
    bottom = pixels[fy1 + 1, fx0:fx1 + 1] if fy1 + 1 <= height - 1 else None
    left = pixels[fy0:fy1 + 1, fx0 - 1] if fx0 - 1 >= 0 else None
    right = pixels[fy0:fy1 + 1, fx1 + 1] if fx1 + 1 <= width - 1 else None

    # 缺哪一侧就用对侧代替，避免采样到水印自身
    top = top if top is not None else bottom
    bottom = bottom if bottom is not None else top
    left = left if left is not None else right
    right = right if right is not None else left

    if top is None or left is None:
        return False

    ty = np.linspace(0, 1, rows)[:, None, None]
    tx = np.linspace(0, 1, cols)[None, :, None]
    vertical = top.astype(np.float32)[None, :, :] * (1 - ty) + bottom.astype(np.float32)[None, :, :] * ty
    horizontal = left.astype(np.float32)[:, None, :] * (1 - tx) + right.astype(np.float32)[:, None, :] * tx

    pixels[fy0:fy1 + 1, fx0:fx1 + 1] = ((vertical + horizontal) / 2).round().astype(np.uint8)
    return True


def fill_solid(pixels, rect):
    """用矩形外圈的平均色平铺填充。"""
    fy0, fy1, fx0, fx1 = rect
    height, width = pixels.shape[:2]
    y0, y1 = max(0, fy0 - 3), min(height, fy1 + 4)
    x0, x1 = max(0, fx0 - 3), min(width, fx1 + 4)

    pieces = []
    if fy0 > y0:
        pieces.append(pixels[y0:fy0, x0:x1].reshape(-1, 4))
    if fy1 + 1 < y1:
        pieces.append(pixels[fy1 + 1:y1, x0:x1].reshape(-1, 4))
    if fx0 > x0:
        pieces.append(pixels[fy0:fy1 + 1, x0:fx0].reshape(-1, 4))
    if fx1 + 1 < x1:
        pieces.append(pixels[fy0:fy1 + 1, fx1 + 1:x1].reshape(-1, 4))
    if not pieces:
        pieces.append(pixels[y0:y1, x0:x1].reshape(-1, 4))

    color = np.concatenate(pieces).mean(axis=0).round().astype(np.uint8)
    pixels[fy0:fy1 + 1, fx0:fx1 + 1] = color


def apply_fill(pixels, rect, method, direction, width, height):
    """执行回填，返回实际使用的方式。"""
    if method == 'auto':
        fy0, fy1, fx0, fx1 = rect
        margins = {'top': fy0, 'bottom': height - 1 - fy1,
                   'left': fx0, 'right': width - 1 - fx1}
        usable = [d for d in DIRECTIONS if margins[d] >= 2]
        method = 'blend' if len(usable) >= 3 else ('copy' if usable else 'solid')

    if method == 'copy':
        chosen = pick_direction(rect, width, height, direction)
        if chosen is None:
            fill_solid(pixels, rect)
            return 'solid'
        fill_copy(pixels, rect, chosen)
        return 'copy(%s)' % chosen

    if method == 'blend':
        if fill_blend(pixels, rect):
            return 'blend'
        fill_solid(pixels, rect)
        return 'solid'

    fill_solid(pixels, rect)
    return 'solid'


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def output_path(path, args):
    if args.out and len(args.input) == 1 and not os.path.isdir(args.out):
        return args.out

    root, ext = os.path.splitext(path)
    ext = ext or '.jpg'
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        directory = args.out
    else:
        directory = os.path.dirname(path)
    return os.path.join(directory, '%s_nowm%s' % (os.path.basename(root), ext))


def process_one(path, args):
    pixels, width, height = load_image(path)
    print('[%s] %dx%d' % (os.path.basename(path), width, height))

    if args.rect:
        x0, y0, rw, rh = args.rect
        bbox = (y0, y0 + rh - 1, x0, x0 + rw - 1)
        # 背景亮度取自矩形外圈，避免把矩形内的水印像素算进去
        lum_map = luminance(pixels)
        ry0, ry1 = max(0, bbox[0] - 4), min(height - 1, bbox[1] + 4)
        rx0, rx1 = max(0, bbox[2] - 4), min(width - 1, bbox[3] + 4)
        ring = []
        if bbox[0] > ry0:
            ring.append(lum_map[ry0:bbox[0], rx0:rx1 + 1].ravel())
        if bbox[1] < ry1:
            ring.append(lum_map[bbox[1] + 1:ry1 + 1, rx0:rx1 + 1].ravel())
        if bbox[2] > rx0:
            ring.append(lum_map[bbox[0]:bbox[1] + 1, rx0:bbox[2]].ravel())
        if bbox[3] < rx1:
            ring.append(lum_map[bbox[0]:bbox[1] + 1, bbox[3] + 1:rx1 + 1].ravel())
        background = float(np.median(np.concatenate(ring))) if ring else 0.0
        print('  使用手动矩形，跳过检测')
    else:
        region = search_rect(args.corner, args.search, width, height)
        bbox, background = detect(pixels, region, width, height, args.tolerance,
                                  args.polarity, args.corner, verbose=args.verbose)

    if bbox is None:
        print('  未检测到水印，已跳过。可调整 --search / --tolerance / --polarity 后重试，'
              '或用 --rect 手动指定位置。')
        return True, None

    fy0 = max(0, bbox[0] - args.pad)
    fy1 = min(height - 1, bbox[1] + args.pad)
    fx0 = max(0, bbox[2] - args.pad)
    fx1 = min(width - 1, bbox[3] + args.pad)
    rect = (fy0, fy1, fx0, fx1)

    print('  水印包围盒 = (%d,%d)-(%d,%d)  尺寸 %dx%d'
          % (bbox[2], bbox[0], bbox[3], bbox[1],
             bbox[3] - bbox[2] + 1, bbox[1] - bbox[0] + 1))
    print('  回填矩形 = (%d,%d)-(%d,%d)  背景亮度 %.1f' % (fx0, fy0, fx1, fy1, background))

    if args.dry_run:
        print('  dry-run：未写出文件')
        return True, None

    used = apply_fill(pixels, rect, args.fill, args.direction, width, height)
    out_path = output_path(path, args)
    save_image(pixels, out_path, args.quality)
    print('  回填方式 = %s  已写出 %s' % (used, out_path))
    return True, out_path


def parse_rect(text):
    parts = text.replace(' ', '').split(',')
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('--rect 需要四个数字：x,y,宽,高')
    try:
        values = [int(part) for part in parts]
    except ValueError:
        raise argparse.ArgumentTypeError('--rect 需要四个整数：x,y,宽,高')
    if values[2] <= 0 or values[3] <= 0:
        raise argparse.ArgumentTypeError('--rect 的宽高必须大于 0')
    return values


def parse_search(text):
    parts = text.lower().replace(' ', '').split('x')
    if len(parts) != 2:
        raise argparse.ArgumentTypeError('--search 形如 35x25（百分比）')
    try:
        width, height = float(parts[0]), float(parts[1])
    except ValueError:
        raise argparse.ArgumentTypeError('--search 形如 35x25（百分比）')
    if not (0 < width <= 100 and 0 < height <= 100):
        raise argparse.ArgumentTypeError('--search 的取值需在 1-100 之间')
    return width, height


def build_parser():
    parser = argparse.ArgumentParser(
        description='通用图片水印去除工具（PyQt5 + NumPy，无需 Pillow / ImageMagick）',
        formatter_class=argparse.RawDescriptionHelpFormatter)

    parser.add_argument('input', nargs='+', help='待处理图片，支持通配符，如 *.jpg')
    parser.add_argument('-o', '--out', help='输出文件；多个输入时视为输出目录')
    parser.add_argument('--rect', type=parse_rect, help='手动指定水印矩形 x,y,宽,高，跳过自动检测')
    parser.add_argument('--corner', choices=CORNERS, default='br',
                        help='自动检测的搜索角，默认 br（右下）')
    parser.add_argument('--search', type=parse_search, default=(35.0, 25.0),
                        help='搜索区尺寸，按图片宽高的百分比，默认 35x25')
    parser.add_argument('--tolerance', type=float, default=24.0,
                        help='判定水印的亮度差阈值，默认 24；检不到就调小，误检多就调大')
    parser.add_argument('--polarity', choices=('auto', 'bright', 'dark'), default='auto',
                        help='水印比背景亮还是暗；auto（默认）同时考虑两种，再取离角落最近的一组')
    parser.add_argument('--pad', type=int, default=3, help='回填时向外的额外留边，默认 3 像素')
    parser.add_argument('--fill', choices=FILLS, default='auto', help='回填方式，默认 auto')
    parser.add_argument('--from', dest='direction', choices=DIRECTIONS,
                        help='配合 --fill copy 指定取样方向；默认自动选余量最大的一侧')
    parser.add_argument('--quality', type=int, default=93, help='JPEG 输出质量，默认 93')
    parser.add_argument('--dry-run', action='store_true', help='只检测并打印包围盒，不写出文件')
    parser.add_argument('-v', '--verbose', action='store_true', help='打印检测细节')
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)

    paths = []
    for pattern in args.input:
        matched = glob.glob(pattern)
        if not matched:
            print('找不到文件：%s' % pattern, file=sys.stderr)
            continue
        paths.extend(sorted(matched))
    if not paths:
        parser.error('没有可处理的图片')

    done = 0
    for path in paths:
        try:
            process_one(path, args)
            done += 1
        except Exception as error:  # 单个文件失败不影响其余文件
            print('[%s] 处理失败：%s' % (os.path.basename(path), error), file=sys.stderr)

    print('完成：%d / %d 个文件' % (done, len(paths)))
    return 0 if done else 1


if __name__ == '__main__':
    sys.exit(main())
