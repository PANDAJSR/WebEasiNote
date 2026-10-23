"""将已审计的官方字体轮廓和 SQLite 轨迹转换为离线 Web 资源（Windows）。"""
import argparse
import hashlib
import json
import pathlib
import sqlite3
import subprocess
import tempfile
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]


def mapped_characters(font):
    data = font.read_bytes()
    u16 = lambda p: struct.unpack_from('>H', data, p)[0]
    u32 = lambda p: struct.unpack_from('>I', data, p)[0]
    tables = {data[p:p + 4]: u32(p + 8) for p in range(12, 12 + u16(4) * 16, 16)}
    cmap = tables[b'cmap']
    sub = next(cmap + u32(p + 4) for p in range(cmap + 4, cmap + 4 + u16(cmap + 2) * 8, 8)
               if (u16(p), u16(p + 2)) == (3, 1))
    if u16(sub) != 4:
        raise ValueError('需要 Windows Unicode BMP format 4 cmap')
    n = u16(sub + 6) // 2
    ends, starts = sub + 14, sub + 16 + n * 2
    deltas, offsets = starts + n * 2, starts + n * 4
    result = set()
    for i in range(n):
        for cp in range(u16(starts + i * 2), u16(ends + i * 2) + 1):
            offset = u16(offsets + i * 2)
            gid = u16(offsets + i * 2 + offset + (cp - u16(starts + i * 2)) * 2) if offset else cp
            if gid and ((gid + u16(deltas + i * 2)) & 0xffff):
                result.add(chr(cp))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('resource_directory', type=pathlib.Path)
    args = parser.parse_args()
    font = args.resource_directory / 'ChineseCharacterSpecialFont.ttf'
    database = args.resource_directory / 'CharacterStrokeInfo.db3'
    connection = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
    rows = {h: (list(map(int, o.split())), g.split('&'))
            for h, o, g in connection.execute('SELECT Hanzi, StrokeOrder, Geometry FROM ChineseStroke')}
    candidates = sorted(set(rows) & mapped_characters(font))
    shards, accepted, rejected = {}, [], []
    with tempfile.TemporaryDirectory(prefix='hanzi-', dir=pathlib.Path.home() / 'AppData/Local/Temp/opencode') as temp:
        characters, output = pathlib.Path(temp) / 'characters.txt', pathlib.Path(temp) / 'contours.jsonl'
        characters.write_text(''.join(candidates), encoding='utf-8')
        subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                        str(ROOT / 'scripts/export-hanzi-font.ps1'), '-FontPath', str(font),
                        '-CharactersFile', str(characters), '-OutputPath', str(output)], check=True)
        for line in output.read_text(encoding='utf-8').splitlines():
            cp, outlines = json.loads(line)
            character = chr(cp)
            order, paths = rows[character]
            if len(outlines) != len(order) or sorted(order) != list(range(len(order))) or any(i >= len(paths) for i in order):
                rejected.append(character)
                continue
            strokes = [None] * len(order)
            for i, index in enumerate(order):
                strokes[index] = [outlines[i], paths[index].strip()]
            shards.setdefault(f'{cp >> 8:x}', {})[character] = strokes
            accepted.append(character)
    destination = ROOT / 'public/hanzi-strokes'
    destination.mkdir(exist_ok=True)
    for name, data in sorted(shards.items()):
        (destination / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (ROOT / 'src/rendering/hanzi-stroke-characters.ts').write_text(
        '// 由 scripts/convert-official-hanzi.py 生成；仅包含专用字体与笔顺匹配的字。\n'
        + 'export const hanziStrokeCharacters = ' + json.dumps(''.join(sorted(accepted)), ensure_ascii=False) + '\n', encoding='utf-8')
    manifest = {'fontSha256': hashlib.sha256(font.read_bytes()).hexdigest(),
                'databaseSha256': hashlib.sha256(database.read_bytes()).hexdigest(),
                'characters': len(accepted), 'missingFont': len(set(rows) - set(candidates)),
                'rejected': rejected, 'shards': len(shards), 'emSize': 300, 'offsetX': -45,
                'format': 'character -> [outline SVG path, animation SVG polyline][] in writing order'}
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=True))


if __name__ == '__main__':
    main()
