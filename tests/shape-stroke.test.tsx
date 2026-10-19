import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { resolveShapeStroke, resolveShapeIsClosed, dashArrayToCss, buildArrowHeadPath, hasClosedSegment } from '../src/rendering/shape-stroke'
import { parseShapeElement } from '../src/enbx/shapes'
import { parseTableElement } from '../src/enbx/tables'
import { generatePresetGeometryPath } from '../src/enbx/preset-geometries'
import { ShapeRenderer } from '../src/components/ShapeRenderer'
import { TableRenderer } from '../src/components/TableRenderer'

const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, React })

const parse = (xml: string): Element =>
  new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element

test('官方 LineType → 虚线数组（DashCollection，线宽倍数）', () => {
  const base = { thickness: 2, closed: false }
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'Normal' }).dashes, [])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'Dash' }).dashes, [2, 2])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'DotDash' }).dashes, [5, 3])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'LongDash' }).dashes, [10, 2, 2, 2])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'DoubleDotArrow' }).dashes, [5, 3])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'EndArrow' }).dashes, [])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'Dash', pen: { dashes: [] } }).dashes, [])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'DotDash', geometryType: 'LineArrowEnd' }).dashes, [2, 2])
  assert.deepEqual(resolveShapeStroke({ ...base, lineType: 'Normal', pen: { dashes: [3.8, 2.85] } }).dashes, [3.8, 2.85])
})

test('LineType.None 只在闭合图形上取消描边', () => {
  const open = resolveShapeStroke({ thickness: 2, lineType: 'None', closed: false })
  assert.equal(open.width, 2)
  assert.deepEqual(open.dashes, [])
  assert.equal(resolveShapeStroke({ thickness: 2, lineType: 'None', closed: true }).width, 0)
  assert.equal(resolveShapeStroke({ thickness: 200, lineType: 'Normal', closed: false }).width, 0)
})

test('线端/连接点遵循 PenSetting（LineJoin 为空或 Round → Round 线端）', () => {
  const plain = resolveShapeStroke({ thickness: 2, lineType: 'Normal', closed: true })
  assert.equal(plain.lineCap, 'round')
  assert.equal(plain.lineJoin, 'round')

  const miterClosed = resolveShapeStroke({
    thickness: 2, lineType: 'Normal', closed: true, pen: { lineCap: 'Flat', lineJoin: 'Miter' }
  })
  assert.equal(miterClosed.lineCap, 'square')
  assert.equal(miterClosed.lineJoin, 'miter')

  const miterOpen = resolveShapeStroke({
    thickness: 2, lineType: 'Normal', closed: false, pen: { lineCap: 'Flat', lineJoin: 'Miter' }
  })
  assert.equal(miterOpen.lineCap, 'butt')
  assert.equal(resolveShapeStroke({
    thickness: 2, lineType: 'Normal', closed: true, pen: { lineJoin: 'Miter' }
  }).lineCap, 'butt')
})

test('虚线换算为像素（官方 non-scaling-stroke：倍数 × 线宽 × 缩放）', () => {
  assert.equal(dashArrayToCss([2, 2], 2, 1), '4 4')
  assert.equal(dashArrayToCss([5, 3], 1, 2), '10 6')
  assert.equal(dashArrayToCss([], 2, 1), undefined)
  assert.equal(dashArrayToCss([2, 2], 0, 1), undefined)
})

test('箭头几何复刻官方 GetArrowPoints（V 形，宽度 5×max(线宽,2)）', () => {
  assert.equal(buildArrowHeadPath({ x: 100, y: 0 }, { x: 0, y: 0 }, 2), 'M 90 -5 L 100 0 L 90 5')
  // 线宽 8 > 2 → 5×8 = 40，半宽 2.5×8 = 20
  assert.equal(buildArrowHeadPath({ x: 100, y: 0 }, { x: 0, y: 0 }, 8), 'M 60 -20 L 100 0 L 60 20')
})

test('闭合判定跟随官方 HasClosedSegments 与形状类型', () => {
  assert.equal(hasClosedSegment('M0 0 L10 0 L10 10 Z'), true)
  assert.equal(hasClosedSegment('M0 0 L10 0 L10 10'), false)
  // 官方只闭合「段数 > 1」的子图形，退化两点折线不算闭合
  assert.equal(hasClosedSegment('M0 0 L10 0 Z'), false)
  assert.equal(hasClosedSegment('M0 0 C1 1 2 2 3 3 Z'), true)

  // 已知预设类型由形状类决定
  assert.equal(resolveShapeIsClosed('Rectangle', 'M0 0 L10 0'), true)
  assert.equal(resolveShapeIsClosed('Line', 'M0 0 L10 0 L10 10 Z'), false)
  assert.equal(resolveShapeIsClosed('Brace', 'M0 0 L10 0 L10 10 Z'), false)
  // 未知类型（含 Custom_PPTX_*）→ ShapeFromStream → 按路径判定
  assert.equal(resolveShapeIsClosed('Custom_PPTX_FreeShape', 'M0 0 L10 0 L10 10 Z'), true)
  assert.equal(resolveShapeIsClosed('Custom_PPTX_FreeShape', 'M0 0 L10 0'), false)
  assert.equal(resolveShapeIsClosed('UnKnown', 'M0 0 L10 0 Z'), false)
})

test('直线类预设几何按官方 Adjusts 端点还原（不再固定画水平线）', () => {
  assert.equal(
    generatePresetGeometryPath('Line', 19, 47, [1, 0], [{ x: 1, y: 0 }, { x: 0, y: 1 }]),
    'M 19.00 0.00 L 0.00 47.00'
  )
  // 四个分量全 0 时官方把第二个端点退化为 (1,1)
  assert.equal(
    generatePresetGeometryPath('Line', 10, 10, [0, 0], [{ x: 0, y: 0 }, { x: 0, y: 0 }]),
    'M 0.00 0.00 L 10.00 10.00'
  )
  // 无 Adjusts 时保持水平线兜底
  assert.equal(generatePresetGeometryPath('Line', 10, 10), 'M 0.00 5.00 L 10.00 5.00')
})

test('解析：PenSetting 覆盖 + 箭头标记 + 线段端点', () => {
  const node = parse(`<Shape>
    <Id>l1</Id><X>0</X><Y>0</Y><Width>100</Width><Height>2</Height>
    <Geometry><PresetGeometry><GeometryType>LineArrowEnd</GeometryType><Adjusts>
      <Adjust><Id>0</Id><ScaleX>0</ScaleX><ScaleY>0</ScaleY></Adjust>
      <Adjust><Id>1</Id><ScaleX>1</ScaleX><ScaleY>0</ScaleY></Adjust>
    </Adjusts></PresetGeometry></Geometry>
    <Background><ColorBrush>#00000000</ColorBrush></Background>
    <Foreground><ColorBrush>#FF000000</ColorBrush></Foreground>
    <Thickness>2</Thickness><LineType>EndArrow</LineType>
    <PenSetting><LineCap>Flat</LineCap><IsArrowDash>False</IsArrowDash></PenSetting>
    <Line><HeadEnd><Type>None</Type></HeadEnd><TailEnd><Type>Arrow</Type><ArrowType>Stealth</ArrowType></TailEnd></Line>
  </Shape>`)
  const shape = parseShapeElement(node)
  assert.ok(shape)
  assert.equal(shape.path, 'M 0.00 0.00 L 100.00 0.00')
  assert.equal(shape.arrowEnd, true)
  assert.equal(shape.arrowStart, undefined)
  assert.equal(shape.borderWidth, 2)
  assert.deepEqual(shape.strokeDashes, [])
  assert.deepEqual(shape.arrowDashes, [])
  assert.equal(shape.strokeLineCap, 'round')
})

test('解析：PenSetting/DashStyle 显式虚线优先于线型', () => {
  const node = parse(`<Shape>
    <Id>s1</Id><Width>40</Width><Height>40</Height>
    <Geometry><PresetGeometry><GeometryType>Rectangle</GeometryType></PresetGeometry></Geometry>
    <Path>M0 0 L40 0 L40 40 L0 40 Z</Path>
    <Foreground><ColorBrush>#FF000000</ColorBrush></Foreground>
    <Thickness>3</Thickness><LineType>Dash</LineType>
    <PenSetting><LineCap>Flat</LineCap><LineJoin>Miter</LineJoin><DashStyle><Offset>0</Offset>
      <Dashes><Item>3.8</Item><Item>2.85</Item></Dashes></DashStyle><IsArrowDash>False</IsArrowDash></PenSetting>
  </Shape>`)
  const shape = parseShapeElement(node)
  assert.ok(shape)
  assert.deepEqual(shape.strokeDashes, [3.8, 2.85])
  assert.equal(shape.strokeLineCap, 'square')
  assert.equal(shape.strokeLineJoin, 'miter')
})

test('解析：LineType=None + 闭合路径（官方 ShapeFromStream）不再描边', () => {
  const node = parse(`<Shape>
    <Id>s2</Id><Width>40</Width><Height>40</Height>
    <Geometry><PresetGeometry><GeometryType>Custom_PPTX_FreeShape</GeometryType></PresetGeometry></Geometry>
    <Path>M0 0 L40 0 L40 40 L0 40 Z</Path>
    <Foreground><ColorBrush>#FF000000</ColorBrush></Foreground>
    <Thickness>2</Thickness><LineType>None</LineType>
  </Shape>`)
  const shape = parseShapeElement(node)
  assert.ok(shape)
  assert.equal(shape.borderWidth, undefined)
  assert.equal(shape.borderColor, undefined)
})

test('渲染：描边宽度按缩放换算，箭头仅在线类几何上绘制', () => {
  const arrowShape = parseShapeElement(parse(`<Shape>
    <Id>l2</Id><X>0</X><Y>0</Y><Width>100</Width><Height>2</Height>
    <Geometry><PresetGeometry><GeometryType>LineArrowEnd</GeometryType><Adjusts>
      <Adjust><Id>0</Id><ScaleX>0</ScaleX><ScaleY>0</ScaleY></Adjust>
      <Adjust><Id>1</Id><ScaleX>1</ScaleX><ScaleY>0</ScaleY></Adjust>
    </Adjusts></PresetGeometry></Geometry>
    <Foreground><ColorBrush>#FF000000</ColorBrush></Foreground>
    <Thickness>2</Thickness><LineType>EndArrow</LineType>
    <PenSetting><IsArrowDash>False</IsArrowDash></PenSetting>
    <Line><TailEnd><Type>Arrow</Type></TailEnd></Line>
  </Shape>`))!
  const markup = renderToStaticMarkup(<ShapeRenderer element={arrowShape as any} scale={2} />)
  assert.ok(markup.includes('d="M 90 -5 L 100 0 L 90 5"'), markup)
  assert.ok(markup.includes('stroke-width="4"'), markup)

  const customLine = parseShapeElement(parse(`<Shape>
    <Id>l3</Id><Width>100</Width><Height>2</Height>
    <Geometry><PresetGeometry><GeometryType>Custom_PPTX_Line</GeometryType></PresetGeometry></Geometry>
    <Path>M0 0 L100 0</Path>
    <Foreground><ColorBrush>#FF000000</ColorBrush></Foreground>
    <Thickness>2</Thickness><LineType>EndArrow</LineType>
    <Line><TailEnd><Type>Arrow</Type></TailEnd></Line>
  </Shape>`))!
  // 官方对 Custom_PPTX_* 走 ShapeFromStream，不绘制箭头
  const customMarkup = renderToStaticMarkup(<ShapeRenderer element={customLine} scale={1} />)
  assert.equal((customMarkup.match(/<path\b/g) || []).length, 1)
})

test('表格：内边距 = max(CellHPadding,24)/2，TextMargin 扩展逐格覆盖', () => {
  const withMargin = parseTableElement(parse(`<Table>
    <Id>t1</Id><X>0</X><Y>0</Y><Width>200</Width><Height>60</Height>
    <Skin><RowSkins/><StrokeThickness>1</StrokeThickness><Stroke><ColorBrush>#FF000000</ColorBrush></Stroke></Skin>
    <CellHPadding>10</CellHPadding><CellVPadding>24</CellVPadding>
    <ColumnWidths><Item>100</Item><Item>100</Item></ColumnWidths>
    <Rows><Row><Height>60</Height><Cells>
      <Cell><Text><RichText><VerticalTextAlignment>Top</VerticalTextAlignment><TextLines><TextLine>
        <TextAlignment>Center</TextAlignment><TextRuns><TextRun><Text>甲</Text><FontSize>20</FontSize></TextRun></TextRuns>
      </TextLine></TextLines></RichText></Text>
      <HMerged>False</HMerged><VMerged>False</VMerged><RowSpan>1</RowSpan><ColumnSpan>1</ColumnSpan>
      <TableCellTextMarginExtension><TextMargin>12.8,12,12.8,12</TextMargin></TableCellTextMarginExtension></Cell>
    </Cells></Row></Rows>
  </Table>`))!
  assert.equal(withMargin.cellHPadding, 24)
  assert.equal(withMargin.cellVPadding, 24)
  assert.deepEqual(withMargin.rows[0][0].textMargin, { left: 12.8, top: 12, right: 12.8, bottom: 12 })

  const markup = renderToStaticMarkup(<TableRenderer element={withMargin as any} scale={2} />)
  assert.ok(markup.includes('padding:24px 25.6px 24px 25.6px'), markup)

  const plain = parseTableElement(parse(`<Table>
    <Id>t2</Id><X>0</X><Y>0</Y><Width>200</Width><Height>60</Height>
    <Skin><RowSkins/><StrokeThickness>1</StrokeThickness></Skin>
    <ColumnWidths><Item>200</Item></ColumnWidths>
    <Rows><Row><Height>60</Height><Cells><Cell><HMerged>False</HMerged><VMerged>False</VMerged><RowSpan>1</RowSpan><ColumnSpan>1</ColumnSpan></Cell></Cells></Row></Rows>
  </Table>`))!
  assert.equal(plain.cellHPadding, 24)
  assert.equal(plain.cellVPadding, 24)
  const plainMarkup = renderToStaticMarkup(<TableRenderer element={plain as any} scale={2} />)
  assert.ok(plainMarkup.includes('padding:24px 24px'), plainMarkup)
})
