# View UI 容器

`View` 对应官方 `Cvte.Paint.UI.UIContainerSaveInfo`，位于 `Cvte.Paint.Shell.dll`。
它是通用容器，不能仅凭标签判断为元素周期表。此前解析器把它当作未知元素，
因此周期表等保存为 View 子元素树的内容会整体显示“无法显示”。

## 保存字段

除通用位置、尺寸、旋转、选择及动画字段外：

| 字段 | 含义 |
| --- | --- |
| LocalId | 创建后不变的容器内部标识，可为空 |
| LayoutType | Default / Zoom = 0，Grid = 1，StackPanel = 2；默认 Default |
| PermittedTransforms | 可空的允许变换标志；保留原值，不是缩放矩阵 |
| IsHidden | 默认 False；True 隐藏整棵子元素树 |
| Elements | 子元素集合，可以继续包含 View，坐标位于容器内部 |

## 官方布局与当前实现

- Default（Zoom 别名）创建 `ElementViewbox` + `UIContainerCoreCanvas`。
  CoreCanvas 测量可见子元素的 Outline 外接框并取并集尺寸，空集合为 0.0625 × 0.0625。
  Viewbox 使用宽高比例的较小值统一缩放；没有额外居中或减去并集左上角的操作。
- Grid 创建单格 WPF Grid；StackPanel 创建默认纵向 StackPanel。
- `IsHidden` 映射到 WPF Collapsed，因此隐藏子 View 不贡献测量范围和堆叠高度。
- WebEasiNote 保留 View 层级，递归复用现有元素渲染器，应用容器位置、旋转及 RotateOrigin，
  并递归收集相对路径资源。原始 View XML 完整保留。

当前测量以保存的子元素尺寸及旋转外接矩形近似官方 Outline，尚未完全复现描边、
自动尺寸及自定义 Outline 的 WPF 测量结果。Grid / StackPanel 支持显式尺寸的基本布局。
内部动画、点击展开化学知识等专用交互，以及 PermittedTransforms 对编辑操作的约束尚未接入。
没有包含元素周期表 View 的真实课件用于视觉对照，回归测试验证的是官方容器规则与递归渲染。

## 静态逆向证据

目标：希沃白板 5.2.4.10148，`Main/Cvte.Paint.Shell.dll`。
SHA-256：`481012f25286ac000ac14b15ab1a534476824e921e5b8b034f229ca159c74277`。
MVID：`98ae2eec-41c3-4275-90a3-b29c80d6b464`。

- REA `inspect_managed_members`：`ev_3dbf88f9ed6155e1e6b6622473bc164fa4d8aca65e5911181dce71d1a15429b0`。
  精确检查 UIContainer / UIContainerSaveInfo / UIContainerCoreCanvas 三个类型。
- REA 调用关系视图：`ev_404954bd5b82ca3258391233d6cef0fdc8eaf2393f08b9d0c2eae097c246e33c`。
  确认 SetSaveInfo 调用 set_LayoutType、set_IsHidden、ToElement；CoreCanvas 测量调用
  GetExternalBounds / Union，排列调用 Canvas.GetLeft / GetTop。
- 使用本机 ILSpy 补读同一 DLL 的 UIContainer、UIContainerCoreCanvas、LayoutTypeExtensions，
  以及 `Cvte.Paint.Framework.dll` 的 ElementViewbox，恢复上述算法。

这些是安装包静态分析结果，没有运行官方课件，也不构成对具体元素周期表交互的运行时验证。
