const common = ['Id', 'X', 'Y', 'Width', 'Height', 'Rotation', 'IsLocked', 'CanClone', 'HasMask',
  'RotateOrigin', 'SaveInfoMetadata', 'Animations', 'Hyperlink', 'ElementSource']
const fields: Record<string, string[]> = {
  MathFunction: ['FuncViewerSaveInfo', 'MathExpressionCollection'],
  SolarSystem: ['PlanetSystemType', 'EarthTextureType', 'EarthTextureKey', 'PlanetView', 'PlanetState', 'CameraPosition',
    'CameraLookDirection', 'CameraUpDirection', 'Texture2DMatrix', 'FocusedSatelliteKey', 'FocusedPlanetRadius2D',
    'PlanetKnowledgePanel', 'Textures', 'Maps', 'Wikis'],
  ClassicalWorkElement: ['WorkId', 'Audio', 'Title', 'Wiki', 'AuthorWiki', 'Author', 'Dynasty', 'AuthorIntroduction',
    'WorksIntroduction', 'Kind', 'Content', 'Translation', 'ClassicalWorksState', 'IsTitleIntroductionShow',
    'IsAnthorIntroductionShow', 'ThemeBrush', 'KeyPointBrush', 'Editors', 'TranslationOriginalEditors',
    'TranslationPackUpEditors', 'TranslationExpandEditors', 'BackgroundId'],
  VocabularyPage: ['Word', 'Pronounce', 'PronounceSource', 'EnglishWordContentType', 'Semantics', 'Phrases',
    'Sentences', 'Synonym', 'ResourcePattern'],
  WebPresentationCard2: ['AppResourceId', 'Auth', 'SourceHash', 'SourceFileName', 'WebFrameworkHash', 'CloseButtonPosition',
    'Tag', 'Title', 'IsTitleVisible', 'IsDetailsVisible', 'Thumbnail', 'IsThumbnailVisible', 'ButtonContent',
    'EditingUrl', 'DisplayUrl', 'EditingFrameSize', 'DisplayFrameSize', 'WindowTitle', 'DisplayMode', 'ZoomMode', 'LayoutSize'],
  TeachingDrawingBoardCard: ['Title', 'EditUrl', 'DisplayUrl', 'ThumbUri'],
  NoBookExperiment: ['Title', 'EditUrl', 'DisplayUrl', 'Thumb', 'ContainVipEquipment'],
  AIToolCard: ['Type', 'ElementName', 'Text', 'EditUrl', 'EditWindowDefaultSize', 'PreviewUrl', 'PreviewWindowDefaultSize',
    'DisplayUrl', 'ImageUri', 'IconUri', 'ButtonImageUri', 'RequireCloseButtonAbility', 'CanEdit'],
  PhysicalGraph: ['EditUrl', 'DisplayUrl', 'ImageUri', 'Thumbnail'],
  QuestionCard: ['Tag', 'QuestionSource', 'OptionSource', 'AnswerSource', 'AnalysisSource', 'QuestionTypeName',
    'IsCollapsed', 'ScaleRatio', 'ImageScale'],
  DictationCard: ['UnitsInfos', 'Count', 'SettingInfo', 'Title', 'MaterialInfo'],
  Chart: ['Data', 'Legend', 'DataTagVisible', 'ChartType', 'Is3DChart', 'Materials', 'CoordinateSkin', 'ChartInitSize', 'Background', 'DataType']
}
export const COMPLEX_SUBJECT_PARAMETERS = Object.fromEntries(Object.entries(fields).map(([tag, names]) => [tag, new Set([...common, ...names])]))
