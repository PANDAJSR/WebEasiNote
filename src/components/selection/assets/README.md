# 放映选择菜单资源

来源：本机希沃白板 5 `5.2.4.10148/Main` 的静态 BAML/资源提取，2026-10-23。

- `icon-geometries.json`：`EasiNote.Resources.dll` 中 `Style.SelectionBox` 和 `Image.FunctionBar` 的七个 `Geometry.FunctionBar.*` 路径、even-odd 填充、原 viewBox；没有用图标库替代。
- `shadow-bottom-radius4-thin.png`：`Cvte.GurnetUI.dll` 内同名 46×46 PNG。九宫格源切片按原 PNG DPI 与 WPF DIP 换算；不使用近似 CSS box-shadow。
- `styles.ts` / `SelectionActionButton.tsx`：64×56 控件、24×24 图标、微软雅黑 12、20 行高、4 外圆角、双层 `#F4F6F9` 80% 背景、原 hover/pressed/checked 色，均依据上述版本静态模板。

详细本机证据：`D:/Code/EasiNote-Resarch/topics/playback-selection/menu-style-findings.md` 及 `menu-style-evidence/`。未复制或嵌入微软字体文件。资源归其原权利人所有。

局限：没有启动官方播放器做逐像素截图比对；字体栅格化、WPF 布局舍入、运行时 DPI/资源覆盖、选框到菜单的绝对间距未获运行验证。菜单定位仍采用本项目视口避让；描边/填充展开面板使用 Ant Design，不声称复刻官方面板。
