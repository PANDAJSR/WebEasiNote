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
