// 类型定义模块

export interface CoursewareMetadata {
  type: 'enbx' | 'folder';
  name: string;
  creator: string;
  appVersion: string;
  documentVersion: string;
  modifiedDate: string | null;
  slideCount: number;
  resourceCount: number;
  resources?: string[];
  slideFiles?: string[];
  slideIds: string[];
  raw: {
    board: unknown;
    document: unknown;
  };
}

export interface DocumentData {
  Name?: string;
  Creator?: string;
  AppVersion?: string;
  DocumentVersion?: string;
  ModifiedDateTime?: string;
}

export interface TextRun {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: 'normal' | 'italic';
  fontWeight: 'normal' | 'bold';
  color: string;
  gradient?: {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    stops: Array<{ color: string; offset: number }>;
    opacity: number;
  };
  opacity?: number;
  decoration?: 'None' | 'Underline';
  textEffects?: {
    frame?: {
      thickness: number;
      opacity: number;
      color: string;
    };
    shadow?: {
      blur: number;
      direction: number;
      distance: number;
      opacity: number;
      color: string;
    };
    reflection?: {
      depth: number;
      distance: number;
      opacity: number;
    };
  };
}

export interface TextMarkerStyle {
  char?: string;
  fontFamily?: string;
  autoNumberType?: string;
  startAt?: number;
}

export interface TextLine {
  textRuns: TextRun[];
  textAlignment: 'Left' | 'Center' | 'Right';
  textMarker?: string;
  textMarkerStyle?: TextMarkerStyle;
  indent?: number;
  indentLevel?: number;
  indentType?: string;
  marginLeft?: number;
  direction?: 'LeftToRight' | 'RightToLeft';
  lineSpacing?: number;
  fixedLineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface TextElement {
  type: 'text';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderThickness?: number;
  borderType?: string;
  arrangingType?: 'Horizontal' | 'Vertical';
  sizeToContent?: 'Manual' | 'Height' | 'WidthAndHeight';
  verticalTextAlignment?: 'Top' | 'Center' | 'Bottom';
  textLines: TextLine[];
}

// 占位符类型，实际定义在 shapes.ts 和 pictures.ts
export interface ShapeElement {
  type: 'shape';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  backgroundColor: string;
  foregroundColor: string;
  path: string;
  fillRule?: 'nonzero' | 'evenodd';
  geometryType: string;
  inlineText?: TextLine[];
  borderWidth?: number;
  borderColor?: string;
  lineType?: string;
  reflection?: {
    offsetY: number;
    opacity: number;
    gradientStart: number;
    gradientEnd: number;
  };
}

export interface PictureElement {
  type: 'picture';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId: string;
  pictureName: string;
  alpha: number;
  rotation: number;
  displayRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pictureSize?: {
    width: number;
    height: number;
  };
}

export interface VideoElement {
  type: 'video';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId: string;
  mediaName: string;
  rotation: number;
  volume: number;
  clipStart: number;
  isLoopPlay: boolean;
  isAutoPlay: boolean;
  isCrossSlidePlay: boolean;
  stopPlayPageNumber: number;
  thumbnailSourceId?: string;
}

export interface TableCell {
  rowSpan: number;
  columnSpan: number;
  hMerged: boolean;
  vMerged: boolean;
  textLines: TextLine[];
}

export interface TableElement {
  type: 'table';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  cellHPadding: number;
  cellVPadding: number;
  strokeColor: string;
  strokeThickness: number;
  headerFillColor?: string;
  rowFillColors: string[];
  columnWidths: number[];
  rowHeights: number[];
  rows: TableCell[][];
}

export interface TopicNode {
  id: string;
  title: string;
  textLines: TextLine[];
  textAlignment: 'Left' | 'Center' | 'Right';
  location: {
    x: number;
    y: number;
  };
  contentWidth: number;
  contentHeight: number;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  children: TopicNode[];
}

export interface TopicElement {
  type: 'topic';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  topicType: string;
  branchType: string;
  title: string;
  textLines: TextLine[];
  textAlignment: 'Left' | 'Center' | 'Right';
  contentWidth: number;
  contentHeight: number;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  branchColor: string;
  children: TopicNode[];
}

export interface CylinderElement {
  type: 'cylinder';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  edgeThickness: number;
  edgeColor: string;
  topFillColor: string;
  sideFillColor: string;
  bottomFillColor: string;
}

export interface ConeElement {
  type: 'cone';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  edgeThickness: number;
  edgeColor: string;
  sideFillColor: string;
  baseFillColor: string;
}

export interface CubeElement {
  type: 'cube';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  edgeThickness: number;
  edgeColor: string;
  topFillColor: string;
  frontFillColor: string;
  rightFillColor: string;
}

export interface GeometryPoint {
  x: number;
  y: number;
}

export interface GeometryPrimitive {
  type: string;
  points: GeometryPoint[];
  strokeColor: string;
  strokeThickness: number;
  lineType?: string;
  segmentType?: string;
  angleOfEllipse?: number;
}

export interface GeometryAngle {
  value: number;
  curPoint: GeometryPoint | null;
  nextPoint: GeometryPoint | null;
  prePoint: GeometryPoint | null;
}

export interface GeometryMark {
  position: GeometryPoint;
}

export interface GeometryElement {
  type: 'geometry';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  geometries: GeometryPrimitive[];
  angles: GeometryAngle[];
  marks: GeometryMark[];
}

export interface MathFormulaElement {
  type: 'mathFormula';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  mathML: string;
  fallbackText: string;
}

export interface UnknownElement {
  type: 'unknown';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalType: string;
}

export interface SlideIssue {
  kind: 'unknown-element' | 'unknown-parameter' | 'missing-font';
  slideId: string;
  elementType: string;
  elementId: string;
  name: string;
  value?: string;
}

export interface SlideData {
  id: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string; // sourceId for ImageBrush background
  issues: SlideIssue[];
  elements: (TextElement | ShapeElement | PictureElement | VideoElement | TableElement | TopicElement | CylinderElement | ConeElement | CubeElement | GeometryElement | MathFormulaElement | UnknownElement)[];
}

export interface CoursewareData {
  metadata: CoursewareMetadata;
  slides: SlideData[];
}

export type SlideElement = TextElement | ShapeElement | PictureElement | VideoElement | TableElement | TopicElement | CylinderElement | ConeElement | CubeElement | GeometryElement | MathFormulaElement | UnknownElement;
