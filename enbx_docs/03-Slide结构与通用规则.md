# 03 Slide 结构与通用规则

## 3.1 Slide 顶层结构

常见结构：

```xml
<Slide>
  <Id>...</Id>
  <Width>1280</Width>
  <Height>720</Height>
  <Background>...</Background>
  <TransitionKey>Fade</TransitionKey>
  <Duration>5000000</Duration>
  <AnimationOrders>
    <Item>...</Item>
  </AnimationOrders>
  <Elements>...</Elements>
</Slide>
```

当前实现读取字段：
- `Id`
- `Width`/`Height`
- `Background`
- `TransitionKey`
- `Duration`
- `AnimationOrders`
- `Elements`

## 3.2 背景解析

支持两种来源：
- `Background/ColorBrush`：纯色背景
- `Background/ImageBrush/Source`：背景图，`id://xxx` 形式

规则：
- 默认背景色 `#ffffff`
- `Source` 会去掉 `id://` 前缀，得到资源 ID

## 3.3 过渡动画字段

字段：
- `TransitionKey`
- `Duration`

当前转换规则：
- `Duration` 视为 ticks（100ns）
- `durationMs = round(Duration / 10000)`

示例：
- `5000000` -> `500ms`

## 3.4 顶层元素分发

`Elements` 下按标签名分发到解析器。

当前已实现类型：
- `Text`
- `Shape`
- `Picture`
- `Video`
- `Table`
- `Group`
- `Topic`
- `Cylinder`
- `Cone`
- `Cube`
- `GeometryElement`
- `MathFormula`
- `RuledPaper`

## 3.5 元素动画（Animations）

Slide 级别：
- `AnimationOrders/Item`：动画 ID 顺序，优先级高于 `Animation/Number`

元素级别（每个元素可选 `Animations/Animation`）：
- `Id`
- `Type`（如 `FadeIn`/`FadeOut`/`Flicker`/`DiagonalWipeIn`/`TranslateIn`）
- `Category`（`Appearance`/`Disappearance`/`Emphasis`）
- `Effect`（如 `In`）
- `Orientation`（如 `LeftToRight`、`RightBottomToLeftTop`）
- `Path`（路径动画字符串，样例中 `TranslateIn` 可出现，如 `M1280,0L1280,0 0,0`）
- `Trigger`（当前消费 `Click` / `Before` / `After`）
- `TriggerSource`（可选，表示需点击指定元素才触发）
- `Number`
- `Start` / `End`
- `Duration` / `Delay`（ticks）
- `RepeatBehavior`
- `TargetId` / `ElementId`

当前转换规则：
- `Duration`、`Delay` 视为 ticks（100ns）
- `durationMs = round(Duration / 10000)`
- `delayMs = round(Delay / 10000)`

当前播放规则：
- 幻灯片区域点击或“下一页”按钮优先推进一组点击动画（一个 `Click` 及其后续 `Before/After` 链）
- 若时间线起始为 `Before/After`（即首个 `Click` 之前存在动画），这段前置链会作为首组在进页时自动启动
- 当该组 `Click` 动画含 `TriggerSource` 时，普通空白点击不会触发，需点击对应元素触发
- `Before`：与上一条动画同一开始时刻触发（受自身 `Delay` 影响）
- `After`：在上一条动画结束后触发（再叠加自身 `Delay`）
- “上一页”按钮优先回退一条点击步（回到上一个 `Click` 分组结束态）
- 回退动画时采用硬切（不播放过渡，不重播动画）
- 若元素通过带 `TriggerSource` 的进入动画出现过，则后续回退点击步时保持可见（不因回退而再次隐藏）
- 键盘方向键（←/↑/→/↓）与翻页按钮使用同一动画步进逻辑
- 仅当前页应用元素动画样式
- 若元素存在 `FadeIn`（进入动画），初始默认隐藏
- 若元素存在进入类动画（如 `FadeIn`、`DiagonalWipeIn`、`TranslateIn`），初始默认隐藏
- 当前已消费并可见生效：`FadeIn`、`FadeOut`、`Flicker`、`DiagonalWipeIn`、`TranslateIn`
- `DiagonalWipeIn` 当前支持方向：`LeftToRight`、`RightToLeft`、`TopToBottom`、`BottomToTop`、`LeftTopToRightBottom`、`RightTopToLeftBottom`、`LeftBottomToRightTop`、`RightBottomToLeftTop`
- `TranslateIn` 当前支持方向：`LeftToRight`、`RightToLeft`、`TopToBottom`、`BottomToTop`、`LeftTopToRightBottom`、`RightTopToLeftBottom`、`LeftBottomToRightTop`、`RightBottomToLeftTop`（从页面外区域移入到目标位置）
- `TranslateIn` 当前按 `Orientation` 播放移入动画，`Path` 仅识别但未参与轨迹计算
- `Flicker` 执行后会落在可见亮态（不会回退到隐藏态）
- 兼容规则：当 `TargetId` 无法匹配到页面元素时，会回退到动画所属元素 `Id` 进行绑定
- 每页动画步进状态会保留，切到其他页再返回时继续保持原步骤结果

## 3.6 Group 的特殊规则

`Group` 当前行为：
- 解析 `X/Y` 作为子元素整体偏移
- 递归解析 `Group/Elements`
- `Group Rotation` 暂不支持，仅记录警告并按未旋转处理

## 3.7 参数识别与问题上报

解析器对每种元素有“已知参数白名单”。

当遇到：
- 未支持元素类型 -> `unknown-element`
- 已知元素里的未知字段 -> `unknown-parameter`

这些问题会挂到 `SlideData.issues` 并在 UI “问题”面板展示。
