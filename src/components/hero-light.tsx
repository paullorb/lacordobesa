"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

/**
 * The light over the hero: the Sol de Mayo's rays falling from the top right corner across the map
 * of Córdoba, drifting slowly and leaning towards the pointer. One fragment shader in raw WebGL, a
 * couple of kilobytes, no library.
 *
 * It is decoration and is built to cost nothing that matters:
 *
 *  - The <canvas> is in the server HTML with its box fixed by CSS (absolute, inset 0), so it can
 *    never shift the layout, and a canvas is never the page's LCP element.
 *  - WebGL starts when the browser is idle after load, renders at half resolution (it is soft light,
 *    there is no detail to lose), and stops whenever the hero is off screen or the tab is hidden.
 *  - It fades away from the left, where the copy is, so the headline's contrast is the scrim's.
 *  - No WebGL, Save-Data, or `prefers-reduced-motion: reduce`: the canvas simply stays empty and
 *    the hero is exactly the static map it always was.
 */
export function HeroLight() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!canvas || reducedMotion() || saveData) return;
    let stop = () => {};
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 400));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      stop = run(canvas);
    });
    return () => {
      cancelIdle(handle);
      stop();
    };
  }, []);

  return <canvas ref={ref} className="hero-light" aria-hidden="true" />;
}

const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAGMENT = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;float ar=r.x/r.y;vec2 p=vec2(uv.x*ar,uv.y);
  vec2 sun=vec2((.86+m.x*.05)*ar,1.08+m.y*.04);
  vec2 d=p-sun;float dist=length(d);float ang=atan(d.y,d.x);
  float wob=fbm(vec2(ang*2.,t*.06));
  float rays=pow(.5+.5*sin(ang*16.+t*.04+wob*2.4),3.);
  float glow=exp(-dist*1.35);
  float haze=fbm(p*1.8+vec2(t*.025,-t*.018));
  float light=(rays*.6+.4)*glow*(.55+.7*haze);
  vec3 col=mix(vec3(.46,.76,.93),vec3(.98,.76,.34),smoothstep(1.,.05,dist));
  float a=light*.5*smoothstep(.12,.62,uv.x);
  a=clamp(a+(h(gl_FragCoord.xy+fract(t))-.5)*.015,0.,1.);
  gl_FragColor=vec4(col*a,a);
}`;

function run(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return () => {};

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);

  // One triangle that covers the whole viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, "r");
  const uTime = gl.getUniformLocation(program, "t");
  const uMouse = gl.getUniformLocation(program, "m");

  const hero = canvas.parentElement ?? canvas;
  const target = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0 };
  let frame = 0;
  let visible = true;
  let shown = false;
  const started = performance.now();

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  const draw = (now: number) => {
    frame = 0;
    mouse.x += (target.x - mouse.x) * 0.05;
    mouse.y += (target.y - mouse.y) * 0.05;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - started) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) {
      shown = true;
      canvas.classList.add("is-lit");
    }
    schedule();
  };
  const schedule = () => {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const onPointer = (e: PointerEvent) => {
    const box = hero.getBoundingClientRect();
    target.x = (e.clientX - box.left) / box.width - 0.5;
    target.y = 0.5 - (e.clientY - box.top) / box.height;
  };
  const onVisibility = () => (document.hidden ? pause() : schedule());
  const onLost = (e: Event) => {
    e.preventDefault();
    visible = false;
    pause();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else pause();
  });
  const resizer = new ResizeObserver(resize);

  observer.observe(hero);
  resizer.observe(canvas);
  hero.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  schedule();

  return () => {
    pause();
    observer.disconnect();
    resizer.disconnect();
    hero.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
