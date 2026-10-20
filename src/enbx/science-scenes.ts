import type { MathFunctionElement, SolarSystemElement } from '../types'
import { getDirectChildElement } from './xml-utils'
import { subjectText as text, subjectItems as items, subjectNumber as number,
  subjectBounds as bounds, subjectColor as color } from './subject-xml'

function vector(value: string, fallback: number[]) {
  const result = value.split(',').map(Number)
  return result.length === fallback.length && result.every(Number.isFinite) ? result : fallback
}
function direction(node: Element, name: string, fallback: number[]) {
  const child = getDirectChildElement(node, name)
  return child ? ['X', 'Y', 'Z'].map((key, index) => number(child, key, fallback[index])) : fallback
}

export function parseMathFunction(node: Element): MathFunctionElement {
  const viewer = getDirectChildElement(node, 'FuncViewerSaveInfo') || node
  const mesh = getDirectChildElement(viewer, 'FuncMeshSaveInfo') || viewer
  return { ...bounds(node), type: 'mathFunction',
    visualBounds: vector(text(viewer, 'VisualBounds'), [693, 693, 614, 614]),
    basicSize: vector(text(mesh, 'BasicSize'), [20, 20]).map(n => Math.max(.1, n)),
    tagStep: vector(text(mesh, 'GraduationTagStep'), [5, 5]).map(n => Math.max(1, n)),
    tagValueStep: vector(text(mesh, 'GraduationTagValueStep'), [5, 5]).map(n => Math.max(.001, n)),
    tagScale: Math.max(.001, number(mesh, 'GraduationTagScale', 1)),
    showTypes: (text(mesh, 'ShowTypes') || 'GraduationTag, CoordinateAxes, Mesh').split(',').map(s => s.trim()),
    functions: items(viewer, 'FunctionCollection').map(item => ({ id: text(item, 'ID'),
      expression: text(item, 'FunctionString'), color: color(item, 'FuncBrush', '#191d26') })) }
}

export function parseSolarSystem(node: Element): SolarSystemElement {
  return { ...bounds(node), type: 'solarSystem', system: text(node, 'PlanetSystemType'),
    textureKey: text(node, 'EarthTextureKey') || text(node, 'EarthTextureType') || 'Satellite',
    view: text(node, 'PlanetView'), state: text(node, 'PlanetState'),
    cameraPosition: vector(text(node, 'CameraPosition'), [0, -9, 0]),
    cameraLook: direction(node, 'CameraLookDirection', [0, 9, 0]),
    cameraUp: direction(node, 'CameraUpDirection', [0, 0, 1]),
    textureMatrix: vector(text(node, 'Texture2DMatrix'), [1, 0, 0, 1, 0, 0]),
    textures: Object.fromEntries(items(node, 'Textures').map(item => [text(item, 'Key'), item.querySelector('Source')?.textContent || ''])),
    maps: Object.fromEntries(items(node, 'Maps').map(item => [text(item, 'Key'), text(item, 'Uri')])) }
}
