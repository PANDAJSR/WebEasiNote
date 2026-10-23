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

`parseQuestionConfig(key, config)` 返回 `{ questions, diagnostics }`，支持类型化 XML 和 Config 中的旧 JSON。任何题目无效时返回空列表和诊断；拒绝缺失或非布尔答案、空题目、选择题没有正确选项、重复 XML 字段、未知列表条目。Judge 非空 Contents 无法保证完整展示，因此关闭答题；不推测元素引用。

答题面板实现完整集合匹配的选择题评分、判断题布尔答案、逐题提交与下一题、进度、完成统计和重置。WeakMap 按 ActivityDefinition 对象保存会话，不写回保存定义。当前面板是独立的纯文字交互界面，不复刻官方模板、音频、Interval 计时、双方竞赛、动画或排行榜。

Choice 的集合判分依据为 `Choice.Strategy.ChoiceActivityScoreCalcRule.IsCorrect`：未选返回 null；选中数量必须与正确选项数量相同，且每个选中索引必须在正确索引中。网页实现另外拒绝重复或未知局部选项 ID。官方增加分数为每题 100，网页只显示答对题数，不复制双方计分。
