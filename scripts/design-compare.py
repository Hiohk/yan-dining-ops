#!/usr/bin/env python3
"""把 UI-01 设计稿的屏幕内容区与实际渲染截图并排输出，用于逐屏比对还原度。

设计稿是「手机 mockup + 装饰背景」的整图，需要先定位屏幕内容区；
截图由 scripts/ui-shot.mjs 以 CDP 设备模拟产出（390×844 @2x）。

两者都缩放到同一宽度后顶部对齐并排，所以**顶部以下的元素位置可以直接横向比对**。
注意设计稿画板高度是 792pt（不是 iPhone 的 844pt），所以越靠下的元素
在设计稿里会越靠上——比较底部元素时要考虑这个偏移。

用法:
    python3 scripts/design-compare.py 01 /tmp/s3/home.png /tmp/cmp/home.png
    python3 scripts/design-compare.py --all /tmp/s3 /tmp/cmp
"""
import sys
import os
from PIL import Image
import numpy as np

SCR = np.array([244, 250, 246])  # 屏幕内容区底色 #f4faf6

# 每屏：设计稿文件名 -> (对应截图名)
PAGES = {
    '01': 'home',
    '02': 'chat',
    '03': 'tasks',
    '04': 'restaurants',
    '05': 'skills',
    '06': 'invitation',
}


def find_screen(path):
    """定位设计稿里手机屏幕的浅绿内容区，返回 (x0, y0, x1, y1)。"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    H, W, _ = a.shape
    scr = np.abs(a - SCR).sum(axis=2) < 15
    cols = scr.sum(axis=0)
    xs = [x for x in range(W) if cols[x] > H * 0.2]
    x0, x1 = xs[0], xs[-1]
    rows = scr[:, x0:x1 + 1].sum(axis=1)
    ys = [y for y in range(H) if rows[y] > (x1 - x0 + 1) * 0.25]
    return x0, ys[0], x1, ys[-1]


def build(design, shot, out, width=380):
    x0, y0, x1, y1 = find_screen(design)
    d = Image.open(design).convert('RGB').crop((x0, y0, x1 + 1, y1 + 1))
    s = Image.open(shot).convert('RGB')

    scale = width / d.width
    d = d.resize((width, round(d.height * scale)), Image.LANCZOS)
    s = s.resize((width, round(s.height * width / s.width)), Image.LANCZOS)

    h = max(d.height, s.height)
    canvas = Image.new('RGB', (width * 2 + 12, h), (255, 0, 255))
    canvas.paste(d, (0, 0))
    canvas.paste(s, (width + 12, 0))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.save(out)
    print(f'{os.path.basename(out):18s} design {d.size}  shot {s.size}  scale {scale:.3f}')


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if sys.argv[1] == '--all':
        shots, outdir = sys.argv[2], sys.argv[3]
        for num, name in PAGES.items():
            build(f'{root}/UI-01/{num}.png', f'{shots}/{name}.png', f'{outdir}/{num}-{name}.png')
    else:
        num, shot, out = sys.argv[1], sys.argv[2], sys.argv[3]
        build(f'{root}/UI-01/{num}.png', shot, out)
