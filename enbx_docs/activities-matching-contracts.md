# TextMatch 与 GapFilling 保存及交互契约

依据安装版本 `EasiNote5_5.2.4.10148/Main/EasiNote.Activity.dll` 的静态托管检查及定向 ILSpy 反编译。程序集版本 5.2.4.0，SHA-256 `236058a07a567c197b3736b7659ab8f269d940b703a2b0dbc15243a0e431ec68`，MVID `6e78932a-5af0-4ab4-a10c-c17e6aa7c52c`。没有执行官方活动或验证屏幕行为。

REA 原始 Evidence：程序集 `ev_55dec193baf3f810e29cdc666a0b4afcead969a3c578303cd40fd40b420ce59e`；定向成员 `ev_7d649d6a45257295edfef672b568d60ac4fcb3f0869f69be0f1bca1841fc8d2d`。成员选择覆盖 TextMatchItemInfo、TextMatchActivityBehaviorController、GapFillingActivityBehaviorController、FillingContent、StemContent、GapFillingActivityHotspotsMaker，未解析外部依赖或执行 CIL。

## TextMatch

`TextMatchActivityConfigInfo` 保存为 `TextMatchConfig`，集合字段 `MatchItems`，项契约 `TextMatchItem`：

| 字段 | 含义 |
| --- | --- |
| Id | 有效配对的 ActivityContainer 元素 ID |
| Text | 容器描述文本 |
| MatchId | ActivityMaterial 元素 ID |
| MatchText | 素材描述文本 |
| IsInvalid | 干扰素材；不生成容器，仍生成 MatchId 素材 |

`Content`、`Chars`、`MatchContent`、`MatchChars` 未标注 SaveInfoMember，不应从 Config 假设存在内嵌富文本。实际元素内容由关联元素读取。

`TextMatchActivity.CreateActivityElements` 确认 Id/MatchId 的角色。`TextMatchActivityBehaviorController` 继承 `ActivityDragBehaviorController<TextMatchActivityConfigInfo>`：拖放先摆放，`CheckAnswer()` 才判断，错误素材回到原位置。不是连线配对。相同纯文本容器可互换其答案；纯文本素材还可按 trim 后文本匹配，内嵌元素需要排除。

`TextMatchActivityHotspotsMaker.Get()` 在容器左边生成 463×101（乘幻灯片比例）的热点，并受模板 HotspotInfo.RelativeOffset 影响；不是整个容器矩形。现有纯运行时模块不猜测此偏移，调用方需提供正确热点或展示独立配对面板。

## GapFilling

`GapFillingActivityConfigInfo` 保存为 `GapFillingConfig`：`Stem` 与 `InvalidItems`。Stem 契约有 `Id`（唯一容器元素）、`Paragraphs`；每个 Paragraph 有 `Contents`：

| 内容契约 | 字段 |
| --- | --- |
| PlainContent | Text |
| FillingContent | Items（FillingItem 集合）、可空整数 TieNumber |
| FillingItem | Id（素材元素 ID）、Name（C# 属性 DisplayName） |

`InvalidItems` 为干扰素材，必须关联并允许拖动，但不作为答案。`GapFillingActivity.ReadStemInfo()` 把每个 FillingContent 替换为一个带 ActivityCharSaveInfo 扩展的文本 run，两边各插入空格。Stem.Id 指向包含整段题干的单个容器，空白自身没有元素 ID。

`GapFillingActivityHotspotsMaker.Get()` 强制布局文本编辑器，从 `GetExtCharBounds<ActivityChar>()` 按顺序取得矩形，再加上文本编辑器和容器偏移，Y 减 7、宽加 8、高加 5。`GapFillingHotspotsManager` 根据摆放更新下划线可见性。不能把整个 Stem 容器当作一个空白热点。

`GapFillingActivityBehaviorController.CheckAnswer()` 显式检查每个空白。相同 TieNumber 的空白共享可接受答案 ID/纯文本，但文本使用次数不能超出该编号下原始答案文本的出现次数。公式不参与文本等价与文本次数统计。错误答案留在原位置并显示错误提示。

## 新模块接入

`parseMatchingConfig(key, config)` 返回 `categories`、`diagnostics`、`matching` 和 `linkedElements`。解析支持直接契约节点、Config 包装以及采用保存字段名的 JSON 对象；JSON 的具体历史序列化变体尚无真实样本验证。

- `matching.targets`：TextMatch 的目标 ID 等于容器 ID；GapFilling 的目标为合成 `${stemId}:gap:${index}`，`containerId` 才是真实元素 ID，`hotspotIndex` 按 FillingContent 出现次序编号。
- `matching.materials`：所有答案和干扰素材。
- `matching.paragraphs`：有序文本/空白片段，可用于独立可访问答题面板。该面板属于查看器提供的基本玩法，不是官方画布布局复刻。
- `linkedElements`：验证真实元素唯一性、角色、activityId 和组合限制；填空时不要按合成目标 ID 验证容器。
- `categories` 仅供旧公共结构兼容；不能据此调用分类判题或生成填空热点。
- `placeMatchingMaterial(config, placements, materialId, targetId | null)`：不可变地移动素材、替换目标占用或退回素材区；不即时判题。
- `checkMatchingAnswers(config, placements, plainText?)`：返回正确、错误、空目标及 complete。plainText 是真实元素 ID 到已确认无公式/内嵌对象的文本映射；省略时保守地按 ID 检查。
- `clearWrongMatchingPlacements(config, placements, checked)`：仅 TextMatch 退回错误素材；GapFilling 保留。

当前 `ActivityDefinition.matching` 已接入解析器并验证 linkedElements。`MatchingActivity` 提供独立面板、带预览的指针拖放及点击选择、显式检查/重置，WeakMap 会话跨挂载保存 placements；播放选择暂停交互。图片或旧 Contents 复用活动元素渲染器。运行时不包含官方模板加载、热点布局、动画、音效及完成状态机。TextMatch 完成要求所有目标均正确填入；这是查看器的明确完成条件，未复刻官方 CheckAnswer 对空目标的宽松分支。

新增测试 `tests/activity-matching.test.ts` 验证真实字段/角色、干扰项、目标替换、延后检查、纯文本等价、并列答案交换/计数、无效配置及旧 JSON 字段结构。
