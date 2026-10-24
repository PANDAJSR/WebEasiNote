# 选择题和判断题保存格式与支持边界

本次静态检查对象是 EasiNote 5.2.4.10148 的 `Main/EasiNote.Activity.dll`，SHA-256 为 `236058a07a567c197b3736b7659ab8f269d940b703a2b0dbc15243a0e431ec68`，MVID 为 `6e78932a-5af0-4ab4-a10c-c17e6aa7c52c`。REA 元数据证据：`ev_55dec193baf3f810e29cdc666a0b4afcead969a3c578303cd40fd40b420ce59e`，摘要视图 `ev_727b3165e691a4eae1f4618bf10f8e7fe5c8ff73d07e57d3b7466a56e159cf31`。以下字段来自针对具体类型的 ilspycmd 静态反编译；未执行官方程序，元数据证据本身不代表行为验证。

| 玩法 | 配置契约 | 列表 | 条目及字段 |
| --- | --- | --- | --- |
| Choice | ChoiceActivityConfig | ChoiceQuestions | ChoiceQuestion: Title、OptionItems；OptionItem: Option、Answer |
| Judge | JudgeConfig | JudgeItems | JudgeItem: Text、Contents、Answer |
| GroupCompetition | GroupCompetitionConfig | Items | GroupCompetitionItem: Id、Text、IsCorrect |

`ChoiceQuestion.Title` 与 `OptionItem.Option` 是 `RichTextSaveInfo`，`Answer` 是 bool。题目与选项没有保存 ID；解析器生成的局部 ID 仅用于答题选择，不能与课件资源关联。Choice 配置还保存 Theme、Interval。

`JudgeItemInfo.Answer` 是 nullable bool，空值不能视为 false；`Contents` 是嵌入的 ElementSaveInfo 列表。Id 属性没有 SaveInfoMember 标注。Judge 配置还保存 Theme、Interval。

`Cvte.Windows.TextEditorPlus.dll` 中的 `RichTextSaveInfo` 契约为 RichText，纯文字成员为 Text，Paragraphs 属性保存为 TextLines；段落契约为 TextLine，TextRuns 列表中为 TextRun，其文字字段为 Text。JSON 兼容层读取 CLR 的 Paragraphs 属性以及 TextLines 保存名称，纯文字显示不保留字形样式、链接、数学公式或媒体效果。

`GroupCompetitionHelper.CreateActivityGroupCompetitionInfo` 按条目的 Id 查找 slide.Elements 中的 ActivityElement，找不到即抛错；不是任意文本题。分组竞争使用单独的解析器与运行时，详见 [分组竞争](./activity-competition-support.md)，不能通过题目解析器改编为判断题。

`parseQuestionConfig(key, config)` 返回 `{ questions, judge?, diagnostics }`，支持类型化 XML 和 Config 中的旧 JSON。任何题目无效时返回空列表和诊断；拒绝缺失或非布尔答案、空题目、选择题没有正确选项、重复 XML 字段、未知列表条目。Judge XML 的 Contents 采用下述元素解析规则；旧 JSON 非空 Contents 仍关闭交互，不推测 CLR 对象或元素引用。

题目与选项直接呈现在幻灯片坐标层，随画布缩放，无独立窗口。Choice 保留完整集合匹配、逐题提交与下一题、进度、完成统计和重置。Judge 使用独立双人计时竞赛。WeakMap 按 ActivityDefinition 对象保存会话，不写回保存定义。

Choice 的集合判分依据为 `Choice.Strategy.ChoiceActivityScoreCalcRule.IsCorrect`：未选返回 null；选中数量必须与正确选项数量相同，且每个选中索引必须在正确索引中。网页实现另外拒绝重复或未知局部选项 ID。官方增加分数为每题 100，网页只显示答对题数，不复制双方计分。

## 判断对错运行规则

对照同一 DLL 的 `JudgeGameController`、`JudgeAnswerPanel`、`JudgeHudControl`、`JudgeProgressControl`
反编译 C# 和 BAML→XAML，以下为静态证据；尚未执行官方窗口或取得真实 Judge 课件样本。

- `JudgeConfig.Theme` 是题目标题；`Interval` 为每题毫秒数，正数时启用，保存值无效时关闭交互。
  缺失时使用 7000ms；该值来自 `ActivityGeneratedEntityHelper` 的判断活动生成默认值。
- HUD 固定两块独立答题板，中央赛道。原始 ActivityItem 在交互播放时隐藏，选择模式恢复。
  判断活动不再进入 Choice 的“提交/下一题”组件。
- 先洗牌全部题目，再按玩家索引取模分成两组；各自题序先本组再另一组，因此两人都回答全部题目。
- 正确/错误按钮是单选，倒计时内可更改；未选择保持 null，与明确选择 false 区分。
  `TimeOut` 同步调用两块面板的 `ConfirmAnswer()` 并锁定计时；选择按钮不立即判分。
- 正确每题 +1，错误与未答均不加分；两者分别记录，未答也计入错误数。多题活动最后一题魔法模式 +2，
  单题保持 +1。所有反馈结束后自动换题，末题完成后按分数显示胜负或平局。
- `Contents.FirstOrDefault()?.ToElement()` 优先于 Text。网页 XML 复用 `parseSlideElements` 解析第一项，
  支持现有文字、图片、图形、组合等渲染器；组合保留相对位置并等比适配到答题板。未知类型、
  元素解析诊断、无效尺寸均关闭活动，避免以 Text 静默替换嵌入题目。附加列表项与官方一样不展示。
  图片资源继续通过课件 resourceMap 解析，不外部下载。
- 游戏、题序、当前选择、分数、超时次数与倒计时保存在 WeakMap；暂停、失焦、隐藏、离页或播放选择模式
  冻结时间，重新挂载后可继续，重置回到开始页并重新洗牌。

网页采用左右答题板、中央赛道的几何重绘，得分后角色位置以 700ms 过渡移动。开始倒数为 3 秒，
反馈固定 2 秒；这些是网页时间线，尚未复刻官方每题提示、超越/魔法攻击/冻结/冲线的完整动画。
官方皮肤贴图、角色资源、自定义头像、音效与精确排版仍未移植，不能宣称视觉一致。
自动测试覆盖 XML 嵌入题目、False/缺失答案、计时校验、双人题序、可改选、超时、末题双倍、单题得分、
暂停、画布挂载、选择模式、离页恢复、结果和重置。
