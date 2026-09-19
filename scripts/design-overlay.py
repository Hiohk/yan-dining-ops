#!/usr/bin/env python3
"""把 UI-01 设计稿与实机截图按同一比例叠在一起，用颜色差异暴露没对齐的地方。

设计稿是手机 mockup，屏幕内容区顶部还有一条 44pt 状态栏，实机截图没有，
所以两张图不能直接对齐 —— 这里用互相关自动求出**垂直偏移**（在重叠区里
搜索让灰度差最小的位移），再横向按 390pt 对齐。

叠加方式：设计稿走红通道、实机走绿通道。**对齐处呈黄灰，错位处会拉出
红边或绿边** —— 比逐行量像素快得多，一眼就能看出哪一块整体偏了。

用法:
    python3 scripts/design-overlay.py 06 invitation /tmp/s5 /tmp/ov
"""
import os
import sys
import importlib.util

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location('dc', f'{ROOT}/scripts/design-compare.py')
dc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dc)


def find_offset(d, s):
    """在 [-8, +80] pt 内搜索让设计稿与截图灰度差最小的垂直位移。"""
    W = 780
    d = d.resize((W, round(d.height * W / d.width)), Image.LANCZOS)
    s = s.resize((W, round(s.height * W / s.width)), Image.LANCZOS)
    dg = np.asarray(d.convert('L')).astype(float)
    sg = np.asarray(s.convert('L')).astype(float)
    best, bestv = 0, None
    for off in np.arange(-8, 80, 0.5):
        # 设计稿 y 对应截图 y - off（off>0 表示设计稿内容在截图上更靠下）
        y0d = max(0, int(off * 2))
        h = min(dg.shape[0] - y0d, sg.shape[0])
        if h < 400:
            continue
        v = np.abs(dg[y0d:y0d + h] - sg[:h]).mean()
        if bestv is None or v < bestv:
            best, bestv = off, v
    return best, bestv


def overlay(design_path, shot_path, out, crop=None):
    x0, y0, x1, y1 = dc.find_screen(design_path)
    d = Image.open(design_path).convert('RGB').crop((x0, y0, x1 + 1, y1 + 1))
    s = Image.open(shot_path).convert('RGB')

    off, _ = find_offset(d, s)
    # 两张都归一到 780 宽（= 390pt @2x），设计稿 832 宽因此要按比例缩短高度
    yd = int(off * d.width / 390)
    W = 780
    h = min(round((d.height - yd) * W / d.width), round(s.height * W / s.width))
    d = d.crop((0, yd, d.width, yd + round(h * d.width / W))).resize((W, h), Image.LANCZOS)
    s = s.crop((0, 0, s.width, round(h * s.width / W))).resize((W, h), Image.LANCZOS)

    da = np.asarray(d.convert('L')).astype(int)
    sa = np.asarray(s.convert('L')).astype(int)
    rgb = np.stack([da, sa, (da + sa) // 2], axis=2).astype(np.uint8)

    if crop:
        a, b = crop
        top = max(0, int(a * 2))
        rgb = rgb[top:int(b * 2)]
    Image.fromarray(rgb).save(out)
    print(f'{os.path.basename(out):22s} 垂直偏移 {off:+.1f}pt  对比高度 {h / 2:.0f}pt')


if __name__ == '__main__':
    num, name, shotdir, outdir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    crop = None
    if len(sys.argv) > 5:
        crop = [float(v) for v in sys.argv[5].split('-')]
    os.makedirs(outdir, exist_ok=True)
    overlay(f'{ROOT}/UI-01/{num}.png', f'{shotdir}/{name}.png',
            f'{outdir}/{num}-{name}.png', crop)
