// Small native WebGL renderer: perspective projection, depth-tested solid meshes,
// directional lighting, procedural nebula and volumetric-looking exhaust. No CDN.
import { REGIONS } from "./campaign.mjs";
const vertex = `attribute vec3 aPosition; attribute vec3 aNormal;
uniform mat4 uVP; uniform mat4 uModel; varying vec3 vNormal; varying vec3 vWorld;
void main(){vec4 p=uModel*vec4(aPosition,1.0);vWorld=p.xyz;vNormal=mat3(uModel)*aNormal;gl_Position=uVP*p;}`;
const fragment = `precision mediump float;varying vec3 vNormal;varying vec3 vWorld;
uniform vec3 uColor;uniform vec3 uFog;uniform float uGlow;uniform float uAlpha;
void main(){vec3 n=normalize(vNormal);float light=.28+.62*max(dot(n,normalize(vec3(-.5,1.,-.6))),0.);float rim=pow(1.-abs(n.y),2.)*.25;
vec3 c=uColor*(light+uGlow+rim);float f=clamp((vWorld.z-8.)/55.,0.,.7);gl_FragColor=vec4(mix(c,uFog,f),uAlpha);}`;
const bgVertex = `attribute vec3 aPosition;varying vec2 vUV;void main(){vUV=aPosition.xy*.5+.5;gl_Position=vec4(aPosition,1.);}`;
const bgFragment = `precision mediump float;varying vec2 vUV;uniform float uTime;uniform float uAspect;uniform vec3 uColor;uniform vec3 uFog;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec2 p=vec2(vUV.x*uAspect,vUV.y);float n=0.,amp=.5;vec2 q=p*3.;for(int i=0;i<5;i++){n+=noise(q)*amp;q=q*2.1+vec2(.12*uTime*.015,1.7);amp*=.5;}
float cloud=pow(n,3.)*.5;vec3 c=uFog+uColor*cloud;vec2 s=p*180.;s.y+=uTime*.35;vec2 cell=floor(s),f=fract(s)-.5;float h=hash(cell);float star=(1.-smoothstep(.015,.11,length(f)))*step(.982,h);c+=vec3(.55,.75,.85)*star*(.55+.45*sin(uTime+h*90.));
float vignette=1.-.45*length(vUV-.5);gl_FragColor=vec4(c*vignette,1.);}`;
function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function multiply(a, b) {
  let o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const normalize = (v) => {
  let l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function lookAt(eye, target) {
  let z = normalize(eye.map((x, i) => x - target[i])),
    x = normalize(cross([0, 1, 0], z)),
    y = cross(z, x);
  let m = identity();
  [x, y, z].forEach((a, r) => {
    for (let c = 0; c < 3; c++) m[c * 4 + r] = a[c];
    m[12 + r] = -a.reduce((s, v, i) => s + v * eye[i], 0);
  });
  return m;
}
function perspective(aspect) {
  let f = 1 / Math.tan(Math.PI / 7),
    n = 0.1,
    far = 160;
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + n) / (n - far),
    -1,
    0,
    0,
    (2 * far * n) / (n - far),
    0,
  ]);
}
function model(x, y, z, sx, sy, sz, ry = 0, rz = 0) {
  let c = Math.cos(ry),
    s = Math.sin(ry),
    a = Math.cos(rz),
    b = Math.sin(rz);
  return new Float32Array([
    c * a * sx,
    b * sx,
    -s * a * sx,
    0,
    -c * b * sy,
    a * sy,
    s * b * sy,
    0,
    s * sz,
    0,
    c * sz,
    0,
    x,
    y,
    z,
    1,
  ]);
}
function triangles(faces) {
  const p = [],
    n = [];
  for (const [a, b, c] of faces) {
    let normal = normalize(
      cross(
        b.map((v, i) => v - a[i]),
        c.map((v, i) => v - a[i]),
      ),
    );
    for (const v of [a, b, c]) {
      p.push(...v);
      n.push(...normal);
    }
  }
  return { p, n };
}
function cube() {
  let v = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  return triangles(
    [
      [0, 3, 2],
      [0, 2, 1],
      [4, 5, 6],
      [4, 6, 7],
      [0, 4, 7],
      [0, 7, 3],
      [1, 2, 6],
      [1, 6, 5],
      [3, 7, 6],
      [3, 6, 2],
      [0, 1, 5],
      [0, 5, 4],
    ].map((t) => t.map((i) => v[i])),
  );
}
function octa() {
  let v = [
    [0, 1, 0],
    [0, -1, 0],
    [-1, 0, 0],
    [1, 0, 0],
    [0, 0, -1],
    [0, 0, 1],
  ];
  return triangles(
    [
      [0, 2, 4],
      [0, 4, 3],
      [0, 3, 5],
      [0, 5, 2],
      [1, 4, 2],
      [1, 3, 4],
      [1, 5, 3],
      [1, 2, 5],
    ].map((t) => t.map((i) => v[i])),
  );
}
function ship() {
  const nose = [0, 0, 1.6],
    tail = [0, 0, -1],
    top = [0, 0.42, -0.35],
    bottom = [0, -0.18, -0.35],
    left = [-1.35, -0.08, -0.9],
    right = [1.35, -0.08, -0.9];
  return triangles([
    [nose, left, top],
    [nose, top, right],
    [nose, bottom, left],
    [nose, right, bottom],
    [tail, top, left],
    [tail, right, top],
    [tail, left, bottom],
    [tail, bottom, right],
  ]);
}
function sphere() {
  let faces = [],
    rows = 16,
    cols = 24;
  const v = (r, c) => {
    let a = (r / rows) * Math.PI,
      b = (c / cols) * Math.PI * 2;
    return [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      faces.push(
        [v(r, c), v(r + 1, c), v(r, c + 1)],
        [v(r, c + 1), v(r + 1, c), v(r + 1, c + 1)],
      );
  return triangles(faces);
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!this.gl)
      throw new Error(
        "3D rendering is unavailable. Enable WebGL or try another browser.",
      );
    const gl = this.gl;
    this.main = this.program(vertex, fragment);
    this.background = this.program(bgVertex, bgFragment);
    this.meshes = {};
    for (const [name, shape] of Object.entries({
      ship: ship(),
      cube: cube(),
      octa: octa(),
      sphere: sphere(),
      quad: {
        p: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
        n: [],
      },
    }))
      this.meshes[name] = this.mesh(shape);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.region = 0;
    this.time = 0;
    this.reduced = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }
  program(v, f) {
    const gl = this.gl,
      p = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, v],
      [gl.FRAGMENT_SHADER, f],
    ]) {
      let s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    return { p, uniforms: {} };
  }
  mesh(data) {
    const gl = this.gl;
    const buffer = (a) => {
      let b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
      return b;
    };
    return { p: buffer(data.p), n: buffer(data.n), count: data.p.length / 3 };
  }
  uniform(prog, name, value) {
    const gl = this.gl;
    let l =
      prog.uniforms[name] ??
      (prog.uniforms[name] = gl.getUniformLocation(prog.p, name));
    if (typeof value === "number") gl.uniform1f(l, value);
    else if (value.length === 16) gl.uniformMatrix4fv(l, false, value);
    else gl.uniform3fv(l, value);
  }
  bind(prog, mesh) {
    const gl = this.gl;
    for (const [name, b] of [
      ["aPosition", mesh.p],
      ["aNormal", mesh.n],
    ]) {
      const l = gl.getAttribLocation(prog.p, name);
      if (l >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0);
      }
    }
  }
  draw(name, pos, scale, color, rotation = 0, glow = 0, alpha = 1, bank = 0) {
    let gl = this.gl;
    this.uniform(this.main, "uModel", model(...pos, ...scale, rotation, bank));
    this.uniform(this.main, "uColor", color);
    this.uniform(this.main, "uGlow", glow);
    this.uniform(this.main, "uAlpha", alpha);
    this.bind(this.main, this.meshes[name]);
    gl.drawArrays(gl.TRIANGLES, 0, this.meshes[name].count);
  }
  render(game, time) {
    const gl = this.gl,
      c = this.canvas,
      rect = c.getBoundingClientRect(),
      dpr = Math.min(globalThis.devicePixelRatio || 1, 1.6);
    let w = Math.max(1, Math.round(rect.width * dpr)),
      h = Math.max(1, Math.round(rect.height * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    gl.viewport(0, 0, w, h);
    this.time = time;
    const region = REGIONS[game.level.region];
    this.region = game.level.region;
    gl.clearColor(...region.fog, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.background.p);
    this.uniform(this.background, "uTime", this.reduced ? 0 : time);
    this.uniform(this.background, "uAspect", w / h);
    this.uniform(this.background, "uColor", region.color);
    this.uniform(this.background, "uFog", region.fog);
    this.bind(this.background, this.meshes.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.main.p);
    // A narrow display gets a higher camera so the full arena remains visible.
    const lift = w / h < 1 ? 29 : 19;
    const shake = this.reduced ? 0 : game.shake;
    const vp = multiply(
      perspective(w / h),
      lookAt([Math.sin(time * 80) * shake, lift, -18], [0, 0, 4]),
    );
    this.vp = vp;
    this.uniform(this.main, "uVP", vp);
    this.uniform(this.main, "uFog", region.fog);
    this.draw("sphere", [-15, 1, 36], [9, 9, 9], region.planet, time * 0.025);
    // Broken orbital ring and drifting 3D debris provide scale and depth.
    for (let i = 0; i < 44; i++) {
      let a = (i / 44) * Math.PI * 2;
      this.draw(
        "cube",
        [-15 + Math.cos(a) * 13, Math.sin(a) * 3, 36 + Math.sin(a) * 13],
        [0.9, 0.055, 0.2],
        region.color,
        -a,
        0.3,
      );
    }
    for (let i = 0; i < 24; i++) {
      let z = 33 - ((time * (game.level.speed * 0.2) + i * 5.9) % 56),
        x = (i % 2 ? 1 : -1) * (11 + (i % 5) * 1.9);
      this.draw(
        "octa",
        [x, Math.sin(i) * 2 - 1, z],
        [0.25 + (i % 3) * 0.2, 0.5, 0.5],
        [0.15, 0.2, 0.27],
        time * 0.2 + i,
      );
    }
    // Subtle lane beacons, never a flat sprite backdrop.
    for (let i = 0; i < 16; i++) {
      let z = 24 - ((time * 4 + i * 3) % 42);
      for (let x of [-9.3, 9.3])
        this.draw(
          "cube",
          [x, -0.65, z],
          [0.025, 0.025, 0.32],
          region.color,
          0,
          0.5,
          0.35,
        );
    }
    const p = game.player;
    if (game.state !== "gameover" && game.state !== "victory") {
      const hero = game.state === "menu" ? 3 : 1;
      let alpha = p.invincible > 0 && Math.sin(time * 32) > 0 ? 0.35 : 1;
      this.draw(
        "ship",
        [p.x, 0.35, p.z],
        [0.7 * hero, 0.7 * hero, 0.7 * hero],
        [0.72, 0.83, 0.9],
        0,
        0.1,
        alpha,
        -p.bank * 0.35,
      );
      this.draw(
        "octa",
        [p.x, 0.35 + 0.27 * hero, p.z + 0.13 * hero],
        [0.22 * hero, 0.12 * hero, 0.4 * hero],
        [0.12, 0.83, 1],
        0,
        1,
        alpha,
      );
      for (let x of [-0.42, 0.42]) {
        this.draw(
          "cube",
          [p.x + x * hero, 0.35 - 0.12 * hero, p.z - 0.7 * hero],
          [0.1 * hero, 0.1 * hero, 0.24 * hero],
          [0.07, 0.15, 0.2],
        );
        this.draw(
          "octa",
          [p.x + x * hero, 0.35 - 0.12 * hero, p.z - 1.15 * hero],
          [0.12 * hero, 0.12 * hero, (0.4 + Math.sin(time * 45) * 0.09) * hero],
          [0.15, 0.75, 1],
          0,
          1,
          0.8,
        );
      }
      if (p.shield > 0 && game.state !== "menu") {
        gl.depthMask(false);
        this.draw(
          "sphere",
          [p.x, 0.35, p.z],
          [1.1, 0.75, 1.2],
          [0.15, 0.7, 1],
          0,
          0.5,
          0.11,
        );
        gl.depthMask(true);
      }
    }
    for (const e of game.enemies) {
      let color =
        e.kind === "tank"
          ? [0.7, 0.27, 0.55]
          : e.kind === "dart"
            ? [1, 0.48, 0.28]
            : [0.5, 0.48, 0.9];
      this.draw(
        e.kind === "tank" ? "octa" : "ship",
        [e.x, 0.4, e.z],
        [e.radius, e.radius * 0.65, e.radius],
        color,
        Math.PI,
        0,
        1,
        Math.sin(time * 3 + e.id) * 0.2,
      );
      this.draw(
        "octa",
        [e.x, 0.6, e.z - 0.25],
        [0.15, 0.15, 0.25],
        [1, 0.3, 0.3],
        0,
        1,
      );
    }
    if (game.boss) {
      let b = game.boss;
      const col = b.phase === 2 ? [1, 0.22, 0.32] : region.color;
      this.draw("octa", [b.x, 0.65, b.z], [2.7, 1, 2], col, time * 0.25, 0.1);
      for (let side of [-1, 1]) {
        this.draw(
          "ship",
          [b.x + side * 2.6, 0.5, b.z],
          [1.5, 1, 1.6],
          [0.28, 0.24, 0.36],
          Math.PI,
        );
        this.draw(
          "cube",
          [b.x + side * 2.4, 0.9, b.z - 0.7],
          [0.2, 0.18, 0.65],
          col,
          0,
          1,
        );
      }
      this.draw(
        "sphere",
        [b.x, 0.9, b.z - 0.7],
        [0.55, 0.55, 0.55],
        col,
        time,
        1,
      );
    }
    for (const b of game.bullets)
      this.draw(
        "cube",
        [b.x, 0.45, b.z],
        [b.enemy ? 0.1 : 0.055, 0.07, b.enemy ? 0.22 : 0.48],
        b.enemy ? [1, 0.25, 0.35] : [0.2, 0.9, 1],
        0,
        1,
      );
    for (const d of game.pickups) {
      this.draw(
        "octa",
        [d.x, 0.55 + Math.sin(time * 4) * 0.15, d.z],
        [0.36, 0.36, 0.36],
        d.kind === "repair" ? [0.3, 1, 0.65] : [1, 0.78, 0.3],
        time * 2,
        1,
      );
    }
    gl.depthMask(false);
    for (const e of game.particles)
      this.draw(
        "octa",
        [e.x, e.y, e.z],
        [e.size, e.size, e.size],
        e.color,
        e.life * 8,
        1,
        Math.min(1, e.life * 2),
      );
    gl.depthMask(true);
  }
  // Unproject a screen ray onto the combat plane, used for touch and mouse steering.
  pointer(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(),
      nx = ((clientX - r.left) / r.width) * 2 - 1,
      ny = 1 - ((clientY - r.top) / r.height) * 2;
    const m = this.vp;
    if (!m) return null;
    // Solve clip-space x/w and y/w at world y=0, two linear equations.
    let a = m[0] - nx * m[3],
      b = m[8] - nx * m[11],
      c = nx * m[15] - m[12],
      d = m[1] - ny * m[3],
      e = m[9] - ny * m[11],
      f = ny * m[15] - m[13],
      det = a * e - b * d;
    if (Math.abs(det) < 1e-6) return null;
    return { x: (c * e - b * f) / det, z: (a * f - c * d) / det };
  }
}
