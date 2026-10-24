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
内部动画及 PermittedTransforms 对编辑操作的约束尚未接入。

## 属性链接与元素周期卡片

真实样本 `元素周期.enbx` 为单页六张卡片，每个根 View 包含折叠 96×96、展开 300×458
两个子 View。卡片文字、颜色、原子结构图以及右上角图标均来自课件内 SVG；不需要另绘周期表。
初始 x 坐标依次为 40、162、284、406、528、650，y 均为 30；XML 根顺序不是视觉顺序。

- 图片等普通子元素的 `Hyperlink` 可保存 `view://property?...`，解析器保留该字符串。
- 查询部分以 `&` 分隔，每组按第一个 `=` 分隔键值，键按最后一个 `.` 分隔 LocalId 与属性；
  省略 LocalId 表示 self。值先 URI 解码，再执行 URL 解码（包括加号变空格）。
- `self` / `this` 指当前最外层 View；其他 LocalId 在该根的子树内精确查找，避免跨卡片干扰。
  支持 Width、Height、IsHidden、Front，属性名忽略大小写。ActionInfo 为官方统计字段，忽略执行。
- 展开链接隐藏折叠子 View、显示展开子 View，并设置 `Front=true`；收起链接反向切换。
  Front=true 将根置顶，false 不撤销之前的置顶。
- 每次属性变更后重新测量祖先；Zoom 祖先保留现有均匀缩放系数，因此展开后根尺寸变大，
  而不是把详情再次压回 96×96。运行状态不修改源课件，替换元素源时复位。
- 画布按钮覆盖带链接图片的原坐标，保留课件 SVG 图标；支持键盘激活，阻止指针按下及点击
  冒泡到拖动和翻页处理。编辑模式也保留该控件，符合官方 ViewHyperlinkMonitor 的手形光标行为。

图片 `Style/Effects/DropShadow` 包含 Offset、Angle、ShadowBrush/ColorBrush、Opacity、BlurRadius。
此样本为 1、360°、#FF949499、0.45、10。渲染时使用裁剪外层的 CSS drop-shadow，
方向转换为屏幕坐标，模糊标准差近似取 WPF BlurRadius / 2；阴影不参与 View 内容测量。
SVG 从 ZIP 或目录生成 Blob URL 时显式设置 `image/svg+xml`，保持原始资源字节。
展开图片的 Rectangle 为 `0,0,736,480`（x,y,height,width），实际 SVG 为 480×736。

验证：浏览器实际加载六张卡片，初始 12 张 SVG 均成功解码；逐张验证展开到 300×458、
收起到 96×96，位置不变。测试 fixture 从 Ca 卡片 XML 精简，覆盖重复切换、祖先缩放、
同 LocalId 的根隔离、事件隔离、源数据不变、阴影及 SVG MIME。
当前浏览器截图工具受窗口可见性限制，未完成与官方截图的逐像素对照。

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

属性链接补充目标：`Main/EasiNote.Business.dll`，SHA-256：
`841912895537624c03a0b5791a3feb61667a9543f2ef15ee51af78b7c2b6f0c0`。
REA `inspect_managed_members` 证据 `ev_ca2896571d0905b34688cdef49b3b8f5a2d6a599953b9fbfb644f4674a30d6a8`，
摘要 `ev_af525cc26abf39087ec8cef7a2e6c072a7b6c73fbd9d812474cab4e6686f7dbc`。
该调用因 managed metadata 超过 67108864 字节表示预算而失败，不能作为成功解析方法的证据。
使用本机 ILSpy 静态补读同一 DLL 的 `ViewHyperlinkForProperty`、`ViewHyperlinkAction`、
`PropertySettingGroup`、`ViewHyperlink`、`ViewHyperlinkMonitor`，确认上述查找、属性、解码、
置顶和编辑光标规则；补读 Framework 的 `ElementViewbox.ReevaluateSize` 确认保留 Scale。

官方规则来自安装包静态分析；浏览器验证针对 WebEasiNote，不代表已运行官方播放器对照。
