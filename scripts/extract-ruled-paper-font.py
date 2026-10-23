"""从指定官方资源 DLL 静态提取字体，不加载或执行程序集。"""
import argparse
import base64
import hashlib
from pathlib import Path

SOURCE_SHA256 = '71a2cdc7ac34f3e39b332520d82de6702373f6afa425d0aca8726cf65e532fdf'
FONT_SHA256 = '433589be26f881d4d745892590bad682f4c2598e092079efc2597d5fce6d5719'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('assembly', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
data = args.assembly.read_bytes()
if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
    raise SystemExit('资源 DLL 版本不匹配；请重新核对字体位置与哈希。')
# 此安装版本中 sfnt 表目录的文件偏移和末尾表边界。
font = data[380615:380615 + 26496]
if hashlib.sha256(font).hexdigest() != FONT_SHA256:
    raise SystemExit('字体哈希不匹配。')
encoded = base64.b64encode(font).decode('ascii')
chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
args.output.write_text(
    '// 由 scripts/extract-ruled-paper-font.py 生成；来源及限制见 enbx_docs/09-四线三格字体与布局.md\n'
    "export const RULED_PAPER_FONT = 'WebEasiNote Ruled Paper'\n"
    'const fontBase64 = [\n' + ''.join(f"  '{chunk}',\n" for chunk in chunks) + "].join('')\n"
    'export const ruledPaperFontCss = `@font-face {\n'
    '  font-family: "${RULED_PAPER_FONT}";\n'
    '  src: url(data:font/ttf;base64,${fontBase64}) format("truetype");\n'
    '  font-style: normal; font-weight: 100 900; font-display: block;\n'
    '}`\n', encoding='utf-8')
