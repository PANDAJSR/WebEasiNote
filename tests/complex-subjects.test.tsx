import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { parseSlideElements } from '../src/enbx/slide-elements-parser'
import { ElementRenderer } from '../src/components/slide-renderer/ElementRenderer'
import { compileMathExpression, functionPath } from '../src/components/subject-cards/math-expression'
import { globeProjection } from '../src/components/subject-cards/globe-projection'
import { pinyinTones } from '../src/components/subject-cards/pinyin-tones'
import { subjectResourcePaths } from '../src/courseware/subject-resources'
import type { SlideData } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React, HTMLElement: dom.HTMLElement,
  DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, IS_REACT_ACT_ENVIRONMENT: true })
const parse = (value: string) => parseSlideElements(new dom.DOMParser().parseFromString(`<Elements>${value}</Elements>`, 'text/xml').documentElement as unknown as Element, { slideId: 'complex' })

test('函数表达式支持幂、隐式乘法和三角函数，拒绝可执行代码并断开渐近线', () => {
  assert.equal(compileMathExpression('(x)^(2)')?.(3), 9)
  assert.equal(compileMathExpression('(x)^(-1)')?.(2), .5)
  assert.equal(compileMathExpression('-x^2')?.(3), -9)
  assert.equal(compileMathExpression('2^3^2')?.(0), 512)
  assert.equal(compileMathExpression('2x+sin(pi/2)')?.(3), 7)
  for (const value of ['alert(1)', 'x;window.close()', 'x.constructor', 'sin(', '2**3', 'x+']) assert.equal(compileMathExpression(value), null)
  const curve = functionPath(compileMathExpression('1/x')!, 100, 100, [50, 50], [20, 20])
  assert.equal((curve.match(/M/g) || []).length, 2)
  assert.doesNotMatch(curve, /NaN|Infinity/)
  assert.deepEqual(pinyinTones('gui'), ['guī', 'guí', 'guǐ', 'guì'])
  assert.deepEqual(pinyinTones('liu'), ['liū', 'liú', 'liǔ', 'liù'])
  assert.deepEqual(pinyinTones('lǜ'), ['lǖ', 'lǘ', 'lǚ', 'lǜ'])
})

test('地球相机朝向映射球面纹理，屏幕外射线不命中球体', () => {
  const project = globeProjection([0, -9, 0], [0, 0, 1], [0, 9, 0])
  assert.deepEqual(project(0, 0), [.75, .5])
  assert.equal(project(1, 1), null)
  assert.ok(project(0, .05)![1] < .5)
})

test('复杂元素解析保留曲线、相机、图表系列、课件资源及组偏移', () => {
  const result = parse(`<Group><Id>group</Id><X>12</X><Y>8</Y><Elements>
    <MathFunction><Id>function</Id><X>50</X><Y>200</Y><Width>644</Width><Height>465</Height><FuncViewerSaveInfo>
      <FuncMeshSaveInfo><BasicSize>20,20</BasicSize><GraduationTagStep>5,5</GraduationTagStep><GraduationTagValueStep>5,5</GraduationTagValueStep></FuncMeshSaveInfo>
      <VisualBounds>726,671,614,614</VisualBounds><FunctionCollection><NormalFuncSaveInfo><ID>2</ID><FunctionString>(x)^(2)</FunctionString><FuncBrush><ColorBrush>#FF112233</ColorBrush></FuncBrush></NormalFuncSaveInfo></FunctionCollection>
    </FuncViewerSaveInfo></MathFunction>
    <SolarSystem><PlanetSystemType>Earth</PlanetSystemType><CameraPosition>0,-9,1</CameraPosition><CameraLookDirection><X>0</X><Y>9</Y><Z>-1</Z></CameraLookDirection>
      <Textures><SolarSystemTexture><Key>Satellite</Key><Brush><ImageBrush><Source>Resources/earth.jpg</Source></ImageBrush></Brush></SolarSystemTexture></Textures>
      <Maps><SolarSystemResource><Key>Climate</Key><Uri>Resources/climate.jpg</Uri></SolarSystemResource></Maps></SolarSystem>
    <Chart><ChartType>Line</ChartType><Data><ChartData><Title><Text>类别一</Text></Title><Values><ChartText><Text>8</Text></ChartText><ChartText><Text>-3</Text></ChartText></Values></ChartData></Data><Legend><IsVisible>True</IsVisible></Legend></Chart>
    <PhysicalGraph><Thumbnail>id://circuit</Thumbnail></PhysicalGraph>
    <WebPresentationCard2><Title>网页</Title><DisplayUrl>https://example.com/lesson</DisplayUrl><Thumbnail>Resources/cover.jpg</Thumbnail></WebPresentationCard2>
    <QuestionCard><QuestionTypeName>单选题</QuestionTypeName><QuestionSource>Resources/question.png</QuestionSource><OptionSource>id://options</OptionSource><AnswerSource>Resources/answer.png</AnswerSource><AnalysisSource>Resources/analysis.png</AnalysisSource><ImageScale>0.25</ImageScale></QuestionCard>
    <DictationCard><Title>Unit 1</Title><UnitsInfos><Unit><WordsInfos><Word><Word>hello</Word><FemaleAudioUri>Resources/hello.mp3</FemaleAudioUri></Word></WordsInfos></Unit></UnitsInfos></DictationCard>
    </Elements></Group>`)
  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.elements.map(e => e.type), ['mathFunction', 'solarSystem', 'chart', 'resourceCard', 'resourceCard', 'questionCard', 'dictationCard'])
  const [fn, globe, chart] = result.elements
  assert.ok(fn.type === 'mathFunction' && globe.type === 'solarSystem' && chart.type === 'chart')
  assert.equal(fn.x, 62)
  assert.deepEqual(fn.visualBounds, [726, 671, 614, 614])
  assert.equal(fn.functions[0].color, '#112233')
  assert.deepEqual(globe.cameraPosition, [0, -9, 1])
  assert.deepEqual(globe.cameraLook, [0, 9, -1])
  assert.equal(globe.textures.Satellite, 'Resources/earth.jpg')
  assert.equal(chart.data[0].values[1].text, '-3')
  assert.ok(fn.rawXml?.includes('FunctionCollection'))
  const slide = { elements: result.elements } as SlideData
  assert.deepEqual([...subjectResourcePaths([slide])].sort(), ['Resources/analysis.png', 'Resources/answer.png', 'Resources/climate.jpg', 'Resources/cover.jpg', 'Resources/earth.jpg', 'Resources/hello.mp3', 'Resources/question.png'])
})

test('题卡答案展开和函数缩放可用，编辑模式禁止内部交互', async () => {
  const [question, fn] = parse(`<QuestionCard><QuestionTypeName>单选题</QuestionTypeName><QuestionSource>id://q</QuestionSource><AnswerSource>id://a</AnswerSource><AnalysisSource>id://b</AnalysisSource></QuestionCard><MathFunction />`).elements
  const container = document.createElement('div')
  const root = createRoot(container)
  const render = (edit = false) => act(async () => root.render(<>
    <ElementRenderer element={question} scale={1} resourceMap={{ q: 'blob:q', a: 'blob:a', b: 'blob:b' }} slideIndex={0} currentIndex={0} isEditMode={edit} />
    <ElementRenderer element={fn} scale={1} resourceMap={{}} slideIndex={0} currentIndex={0} isEditMode={edit} />
  </>))
  try {
    await render()
    assert.equal(container.querySelector('img[alt="答案"]'), null)
    await act(async () => (container.querySelector('[aria-label="展开答案解析"]') as unknown as HTMLButtonElement).click())
    assert.equal(container.querySelector('img[alt="答案"]')?.getAttribute('src'), 'blob:a')
    const grid = container.querySelector('[aria-label="切换网格"]') as unknown as HTMLButtonElement
    await act(async () => grid.click())
    assert.equal(grid.getAttribute('aria-pressed'), 'false')
    await act(async () => (container.querySelector('[aria-label="复位函数图像"]') as unknown as HTMLButtonElement).click())
    assert.equal(grid.getAttribute('aria-pressed'), 'true')
    await render(true)
    assert.ok((container.querySelector('[aria-label="放大函数图像"]') as unknown as HTMLButtonElement).disabled)
  } finally { await act(async () => root.unmount()) }
})

test('题卡按原图尺寸和 ImageScale 排版，饼图图例使用独立保存样式', async () => {
  const [question, chart] = parse(`<QuestionCard><Width>743</Width><Height>166.32</Height><QuestionSource>id://q</QuestionSource><ImageScale>0.25</ImageScale></QuestionCard>
    <Chart><ChartType>Pie</ChartType><Data><ChartData><Title><Text>类别1</Text><Foreground><ColorBrush>#FFFFFFFF</ColorBrush></Foreground><FontSize>24</FontSize></Title><Values><ChartText><Text>32</Text><Foreground><ColorBrush>#FFFFFFFF</ColorBrush></Foreground></ChartText></Values></ChartData></Data>
    <Legend><IsVisible>True</IsVisible><Width>500</Width><Location>-70,-82</Location><Contents><ChartText><Text>系列1</Text><Foreground><ColorBrush>#FF666666</ColorBrush></Foreground><FontSize>14</FontSize></ChartText></Contents></Legend></Chart>`).elements
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<>
      <ElementRenderer element={question} scale={1} resourceMap={{ q: 'blob:q' }} slideIndex={0} currentIndex={0} />
      <ElementRenderer element={chart} scale={1} resourceMap={{}} slideIndex={0} currentIndex={0} />
    </>))
    const image = container.querySelector('img[alt="题干"]') as HTMLImageElement
    Object.defineProperty(image, 'naturalWidth', { value: 2668 })
    await act(async () => image.dispatchEvent(new dom.Event('load') as unknown as Event))
    assert.equal(image.style.width, '667px')
    const label = [...container.querySelectorAll('svg text')].find(node => node.textContent === '类别1')!
    assert.equal(label.getAttribute('fill'), '#666666')
    assert.equal(label.getAttribute('font-size'), '14')
    assert.doesNotMatch(container.innerHTML, /NaN/)
  } finally { await act(async () => root.unmount()) }
})
