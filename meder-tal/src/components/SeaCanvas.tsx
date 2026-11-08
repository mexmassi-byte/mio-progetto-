import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/gsap";

/**
 * The hero: the aerial still of the coast brought back to life with a small
 * WebGL shader. The water drifts, the surf breathes, the camera floats.
 * Falls back to the still image without WebGL or with reduced motion.
 */
const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tex;
uniform vec2 res;
uniform vec2 img;
uniform float time;
uniform vec2 mouse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main(){
  // cover-fit the texture
  float rs = res.x / res.y; float ri = img.x / img.y;
  vec2 scale = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  vec2 uv = (vUv - 0.5) * scale;

  // slow camera float
  float t = time;
  float zoom = 1.10 + 0.025 * sin(t * 0.11);
  uv /= zoom;
  uv += vec2(0.012 * sin(t * 0.07), 0.008 * cos(t * 0.05)) + mouse * 0.012;
  uv += 0.5;
  uv.y = 1.0 - uv.y;

  // water: layered drifting noise, stronger out at sea
  float sea = smoothstep(0.95, 0.35, uv.y);
  vec2 n = vec2(noise(uv * 9.0 + vec2(t * 0.25, t * 0.1)), noise(uv * 9.0 + vec2(-t * 0.18, t * 0.21))) - 0.5;
  vec2 ripple = vec2(sin(uv.y * 60.0 + t * 1.4), cos(uv.x * 48.0 + t * 1.1)) * 0.0009;
  uv += (n * 0.006 + ripple) * (0.35 + sea);

  // surf: the shoreline washes in and out
  float shore = smoothstep(0.45, 0.85, uv.y);
  uv.y += shore * 0.006 * sin(t * 0.55 + uv.x * 3.0);

  vec3 col = texture2D(tex, uv).rgb;

  // grade toward the deep harbour blue, keep the sand warm
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 deep = vec3(0.043, 0.129, 0.192);
  col = mix(col, deep + col * 0.55, 0.42);
  col = mix(vec3(l), col, 0.88);

  // vignette and grain
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 1.1;
  col += (hash(vUv * res + t) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

export function SeaCanvas({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || prefersReducedMotion()) return;
    const gl = el.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const uRes = u("res"), uImg = u("img"), uTime = u("time"), uMouse = u("mouse");

    let raf = 0;
    let visible = true;
    let ready = false;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      gl.viewport(0, 0, el.width, el.height);
      gl.uniform2f(uRes, el.width, el.height);
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || !ready) return;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const image = new Image();
    image.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // NPOT textures in WebGL1 must clamp, otherwise they sample black.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(uImg, image.naturalWidth, image.naturalHeight);
      ready = true;
      el.classList.add("is-live");
    };
    image.src = src;

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5;
      mouse.ty = e.clientY / window.innerHeight - 0.5;
    };
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(el);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    frame();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [src]);

  return (
    <div className="sea">
      <img className="sea__still" src={src} alt="" />
      <canvas className="sea__canvas" ref={canvas} aria-hidden="true" />
    </div>
  );
}
