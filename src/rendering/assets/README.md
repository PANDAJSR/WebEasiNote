# 图片相框资源

`picture-frame.png` 来源于本机希沃白板 5 `5.2.4.10148/Main/EasiNote.Resources.dll`，
对应 `resources/picture/picture.xaml` 的 `Image.Picture.PictureFrame1`（60×60 PNG）。
用于矩形艺术相框，依照 `PictureStyleGenerator.SetRectFrame` 采用 29 像素九宫格。

- DLL SHA-256：`71a2cdc7ac34f3e39b332520d82de6702373f6afa425d0aca8726cf65e532fdf`
- PNG SHA-256：`aecd6531a4f638f088c78f6abdc8663b5aaf025751e89ace21174df84a12a531`
- DLL 内 PNG 原始字节起点：`2494980`。
- 提取方式：ILSpyCmd 11.1.0.9782 `-p` 导出资源，结合上述 XAML 资源键和官方九宫格代码核对。

资源归原权利人所有。只保留本次兼容需要的相框 PNG，不打包官方程序集。
详细本机研究与静态证据见 `D:/Code/EasiNote-Resarch/topics/picture-rendering/README.md`。
圆角/椭圆/弧边框使用 SVG 几何重建，不是新增提取图片；浏览器模糊与 WPF 可能有栅格化差异。

## 艺术相框补充资源

`picture-frames/` 另含同一程序集导出的 19 张 PNG，未重新编码，`manifest.json` 记录原始尺寸与
逐文件 SHA-256。这些资源无 DPI 元数据，按 WPF 默认 96 DPI 处理。

| 文件 | XAML 资源键 | 用途 |
| --- | --- | --- |
| `pictureframe2_10/20/30.png` | `Image.Picture.PictureFrame0210/0220/0230` | 三档底影框 |
| `pictureframe3_10/20/30.png` | `Image.Picture.PictureFrame0310/0320/0330` | 三档内影框 |
| `pictureframe07_10/20/30.png` | `Image.Picture.PictureFrame0710/0720/0730` | 三档花朵框 |
| `pictureframe08_10/20/30.png` | `Image.Picture.PictureFrame0810/0820/0830` | 三档箭头框 |
| `pictureframe09_10/20/30.png` | `Image.Picture.PictureFrame0910/0920/0930` | 三档交叉框 |
| `stampphotoframe0610left/top/right/bottom.png` | `Image.Picture.StampPhotoFrame0610Left/Top/Right/Bottom` | 四边邮票平铺（各 24×24） |

切片、白边和外扩参数来自 `PictureStyleGenerator` / `PictureFrameStyleHelper`。
重叠框复用 `picture-frame.png`，额外叠画并旋转图片/相框，不包含另一张提取资源。
邮票首尾斜切来自 `TiledBrushImage`，中段通过 SVG pattern 平铺，DOM 数量不随图片尺寸增长。
本轮新增样式基于静态证据及 Chromium 构造画廊验证，未获取新增官方运行截图。
