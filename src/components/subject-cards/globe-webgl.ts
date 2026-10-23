const vertexSource = `
attribute vec2 position;
varying vec2 screen;
void main() { screen = position; gl_Position = vec4(position, 0., 1.); }
`
const fragmentSource = `
precision highp float;
varying vec2 screen;
uniform sampler2D surface;
uniform vec3 camera;
uniform vec3 forward;
uniform vec3 right;
uniform vec3 vertical;
uniform float aspect;
void main() {
  vec3 ray = normalize(forward + .41421356237 * (right * screen.x + vertical * screen.y * aspect));
  float b = dot(camera, ray);
  float delta = b * b - dot(camera, camera) + 1.;
  if (delta < 0.) discard;
  float t = -b - sqrt(delta);
  if (t <= 0.) discard;
  vec3 normal = camera + ray * t;
  float u = fract(atan(normal.y, normal.x) / 6.28318530718 + 1.);
  float v = acos(clamp(normal.z, -1., 1.)) / 3.14159265359;
  gl_FragColor = texture2D(surface, vec2(u, v));
}
`
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (v: number[]) => { const length = Math.hypot(...v) || 1; return v.map(n => n / length) }

/** GPU 球面射线投影；纹理驻留显存，拖动时仅更新相机，无需逐像素 CPU 重绘。 */
export function createGlobeWebGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false })
  if (!gl) return null
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  if (!program || !buffer || !texture) return null
  const shaders: WebGLShader[] = []
  const dispose = () => { shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture) }
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type)
    if (!shader) { dispose(); return null }
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { dispose(); return null }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return null }
  let uploaded: ImageData | null = null
  return {
    dispose,
    paint(image: ImageData | null, camera: number[], up: number[], look: number[]) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (!image || gl.isContextLost()) return
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
      const attribute = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      if (uploaded !== image) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        // WebGL1 对非 2 次幂纹理只允许 CLAMP_TO_EDGE。
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, (image.width & (image.width - 1)) === 0 && (image.height & (image.height - 1)) === 0 ? gl.REPEAT : gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        uploaded = image
      }
      const forward = normalize(Math.hypot(...look) ? look : camera.map(n => -n))
      const side = cross(forward, up)
      const right = normalize(Math.hypot(...side) > .00001 ? side : cross(forward, Math.abs(forward[2]) < .9 ? [0, 0, 1] : [0, 1, 0]))
      for (const [name, value] of Object.entries({ camera, forward, right, vertical: normalize(cross(right, forward)) })) gl.uniform3fv(gl.getUniformLocation(program, name), value)
      gl.uniform1f(gl.getUniformLocation(program, 'aspect'), canvas.height / canvas.width)
      gl.uniform1i(gl.getUniformLocation(program, 'surface'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },
  }
}
