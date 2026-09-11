'use client';

// Cosmic field — painted in depths so it feels like volume, not a curtain:
//   1) Nebula plane     (NDC quad, dark FBM haze, no color ribbons)   renderOrder -2
//   2) Bright pinpoints (~120 standout stars with slow pulse)         renderOrder -1
//   3) Star sphere      (the existing 900 morphing particles)         renderOrder  0
//   4) Core wireframe   (faded as you scroll into the grid)           renderOrder  1
//
// Color policy: brand acid (#c6f24e) is the single accent. No per-path tinting,
// no purple ribbons. Stars are mostly pure white with a small fraction picking
// up the acid tint; the nebula stays dark and mostly monochromatic so the stars
// and the brand color carry the cosmic feel without looking like a synth-wave poster.
//
// History note: there used to be a "distant dust" layer (~3000 near-white
// speckles, ~12% acid tint, subtle twinkle). It read as static gray dust on
// the dark background — the operator literally described it as looking
// "dirty" — so it's removed. The bright pinpoint layer below carries the
// cosmic feel on its own without the speckle haze.
//
// Performance budget on mobile: pixel ratio capped at 1.5, antialias off,
// nebula shader skips one FBM octave. Reduced-motion users get zero rotation
// and a fully static field (twinkle off).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Single brand accent — `--acid` in globals.css. Everything green-tinted samples this.
const ACID = '#c6f24e';

export function WebGLField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMobile = window.innerWidth <= 820;
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 14;

    // ── Shared uniforms ─────────────────────────────────────────────────
    const uTime = { value: 0 };
    const uScroll = { value: 0 };
    const uMouse = { value: new THREE.Vector2(0, 0) };
    const uAspect = { value: window.innerWidth / window.innerHeight };
    const uAcid = { value: new THREE.Color(ACID) };

    // ── 1. NEBULA PLANE (background, locked to NDC back wall) ───────────
    // Dark only — no color ribbons. Just a deep void with a touch of texture
    // (haze + in-shader sparkle) so it doesn't feel like a flat black canvas.
    const nebGeo = new THREE.BufferGeometry();
    nebGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime, uScroll, uMouse, uAspect },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.999, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform float uScroll;
        uniform vec2  uMouse;
        uniform float uAspect;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        ${isMobile ? '' : '#define HQ 1'}
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          v += a * vnoise(p); p *= 2.03; a *= 0.5;
          v += a * vnoise(p); p *= 2.03; a *= 0.5;
          v += a * vnoise(p); p *= 2.03; a *= 0.5;
          v += a * vnoise(p);
          #ifdef HQ
            p *= 2.03; a *= 0.5;
            v += a * vnoise(p);
          #endif
          return v;
        }

        // Soft radial "celestial light" — a single distant glow at center c
        // with falloff k. Used to paint 3-4 muted nebula cores into the deep
        // background. Kept very dim so they read as "way back" not "in your face".
        vec3 celestial(vec2 uv, vec2 c, float k, vec3 tint, float intensity) {
          vec2 d = uv - c;
          float r2 = dot(d, d);
          return tint * exp(-r2 * k) * intensity;
        }

        void main() {
          vec2 uv = vUv;
          uv.x *= uAspect;
          vec2 drift = vec2(uTime * 0.012, uTime * -0.008);

          // ── PROPER BLACK BASE ──
          // The previous (0.02, 0.022, 0.028) + 0.055 * haze maxed near 0.08
          // grey, which is what made the bg look washed out. Now: near-pure
          // black, and the haze is masked to a tiny additive contribution
          // only where the FBM peaks above 0.7 — so most of the screen is void.
          vec3 col = vec3(0.003, 0.004, 0.008);
          float haze = fbm(uv * 0.9 + drift + uMouse * 0.04);
          col += vec3(0.03, 0.025, 0.04) * smoothstep(0.55, 0.95, haze) * 0.6;

          // ── DEEP-BACKGROUND CELESTIAL LIGHTS ──
          // Three muted nebula cores at fixed UV positions, each breathing
          // very slowly on its own period. Aspect-aware so they don't squash
          // on wide screens. Colors stay dim — these are "distant galaxies",
          // not foreground features. One dusty magenta, one cool indigo, one
          // faint acid (brand tie-in, kept quietest of the three).
          float pulse1 = 0.85 + 0.15 * sin(uTime * 0.08);
          float pulse2 = 0.85 + 0.15 * sin(uTime * 0.06 + 1.7);
          float pulse3 = 0.85 + 0.15 * sin(uTime * 0.11 + 3.4);
          vec2 uvA = vec2(vUv.x * uAspect, vUv.y);
          col += celestial(uvA, vec2(0.18 * uAspect, 0.78), 14.0, vec3(0.45, 0.18, 0.42), 0.22 * pulse1);
          col += celestial(uvA, vec2(0.82 * uAspect, 0.22), 18.0, vec3(0.14, 0.22, 0.50), 0.16 * pulse2);
          col += celestial(uvA, vec2(0.62 * uAspect, 0.58), 24.0, vec3(0.32, 0.48, 0.18), 0.08 * pulse3);

          // ── CRISP STAR SCATTER (unchanged — the spray-paint speckle) ──
          float starField = vnoise(uv * 200.0);
          float hardStar = step(0.987, starField);
          float softStar = pow(vnoise(uv * 95.0 + 7.3), 32.0);
          col += vec3(hardStar * 0.95) + vec3(softStar) * 0.55;

          // ── CINEMATIC VIGNETTE ──
          // Stronger now (was 1.6, now 1.9 with deeper floor) so the corners
          // really fall off into black — keeps the eye on center.
          vec2 cv = vUv - 0.5;
          float vig = 1.0 - dot(cv, cv) * 1.9;
          col *= clamp(vig, 0.12, 1.0);

          // ── SCROLL LIFT ──
          // Reduced from 0.85+0.20 to 0.95+0.10 — keeps the void dark even when
          // the user is deep in the grid section.
          col *= 0.95 + uScroll * 0.10;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const nebula = new THREE.Mesh(nebGeo, nebMat);
    nebula.frustumCulled = false;
    nebula.renderOrder = -2;
    scene.add(nebula);

    // [removed] DISTANT DUST layer — 3000 near-white speckles with subtle
    // acid tint + faint twinkle. On the dark cosmic background they read as
    // static gray dust and made the page look "dirty". The brand-acid
    // pinpoint layer below provides enough cosmic depth on its own.

    // ── 2. BRIGHT PINPOINT STARS (standout reference stars) ──────────────
    const BRIGHT_COUNT = isMobile ? 60 : 120;
    const brightGeo = new THREE.BufferGeometry();
    const brightPos = new Float32Array(BRIGHT_COUNT * 3);
    const brightRand = new Float32Array(BRIGHT_COUNT);
    for (let i = 0; i < BRIGHT_COUNT; i++) {
      const r = 14 + Math.random() * 18;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      brightPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      brightPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      brightPos[i * 3 + 2] = r * Math.cos(ph) - 6;
      brightRand[i] = Math.random();
    }
    brightGeo.setAttribute('position', new THREE.BufferAttribute(brightPos, 3));
    brightGeo.setAttribute('aRand', new THREE.BufferAttribute(brightRand, 1));
    const brightMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime, uAcid },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aRand;
        varying float vTwk;
        varying float vR;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (3.0 + aRand * 4.5) * (8.0 / -mv.z);
          // Slow asymmetric pulse — one star at a time flares.
          vTwk = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * (0.3 + aRand * 0.5) + aRand * 9.0), 6.0);
          vR = aRand;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAcid;
        varying float vTwk;
        varying float vR;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          float spike = smoothstep(0.5, 0.45, d);
          // Brightest 30% get a stronger acid tint so they read as the brand.
          vec3 base = mix(vec3(1.0), uAcid, step(0.70, vR) * 0.6);
          gl_FragColor = vec4(base, (core * 0.55 + spike * 0.35) * vTwk);
        }
      `,
    });
    const brightStars = new THREE.Points(brightGeo, brightMat);
    brightStars.renderOrder = -1;
    scene.add(brightStars);

    // ── 3. STAR SPHERE (the morph layer — preserved behavior) ─────────────
    const COUNT = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const rand = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 6 + Math.random() * 3;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      rand[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime, uScroll, uMouse, uAcid },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform vec2 uMouse;
        attribute float aRand;
        varying float vA;
        varying float vM;
        varying float vTwk;
        void main() {
          vec3 p = position;
          float w = sin(uTime * 0.5 + aRand * 12.0) * 0.6;
          p += normalize(p) * w;
          float m = smoothstep(0.0, 1.0, uScroll);
          vec3 g = vec3(
            (aRand - 0.5) * 22.0,
            (fract(aRand * 97.0) - 0.5) * 14.0,
            sin(aRand * 30.0 + uTime * 0.3) * 2.0
          );
          p = mix(p, g, m * 0.85);
          p.x += uMouse.x * 1.5;
          p.y += uMouse.y * 1.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.2 + aRand * 2.5) * (10.0 / -mv.z);
          vA = 0.35 + aRand * 0.5;
          vM = m;
          vTwk = 0.55 + 0.45 * sin(uTime * (0.9 + aRand * 1.6) + aRand * 17.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAcid;
        varying float vA;
        varying float vM;
        varying float vTwk;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          // Core + soft halo — gives a glow falloff instead of a flat dot.
          float core = smoothstep(0.5, 0.0, d);
          float halo = smoothstep(0.5, 0.18, d);
          // Cool white → acid as the sphere unspools into the grid.
          vec3 cool = vec3(0.86, 0.90, 0.95);
          vec3 col = mix(cool, uAcid, 0.30 + vM * 0.55);
          float a = (core * 0.55 + halo * 0.18) * vA * (0.7 + vTwk * 0.55);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 0;
    scene.add(points);

    // ── 4. CORE WIREFRAME ─────────────────────────────────────────────────
    // Was plasma purple — now acid to match the new monochrome theme.
    const coreGeo = new THREE.IcosahedronGeometry(3.4, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xc6f24e,
      wireframe: true,
      transparent: true,
      opacity: 0.10,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.renderOrder = 1;
    scene.add(core);

    // ── Scroll + mouse + animation loop ──────────────────────────────────
    let tScroll = 0,
      cScroll = 0,
      tmx = 0,
      tmy = 0,
      cmx = 0,
      cmy = 0;

    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      tScroll = h > 0 ? window.scrollY / h : 0;
    };
    const onMouse = (e: MouseEvent) => {
      tmx = e.clientX / window.innerWidth - 0.5;
      tmy = -(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouse);

    const clock = new THREE.Clock();
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const tm = clock.getElapsedTime();
      cScroll += (tScroll - cScroll) * 0.06;
      cmx += (tmx - cmx) * 0.05;
      cmy += (tmy - cmy) * 0.05;
      uTime.value = reduceMotion ? 0 : tm;
      uScroll.value = cScroll;
      uMouse.value.set(cmx, cmy);

      if (!reduceMotion) {
        points.rotation.y = tm * 0.04 + cScroll * (isMobile ? 2.0 : 1.2);
        points.rotation.x = cScroll * (isMobile ? 0.9 : 0.5);
        brightStars.rotation.y = tm * 0.003;
        core.rotation.y = tm * 0.08;
        core.rotation.x = tm * 0.05;
      }
      core.scale.setScalar(1 - cScroll * 0.6);
      coreMat.opacity = 0.10 * (1 - cScroll);
      camera.position.z = 14 + cScroll * (isMobile ? 10 : 6);
      camera.position.x = cmx * 2;
      camera.position.y = cmy * 2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      uAspect.value = window.innerWidth / window.innerHeight;
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      nebGeo.dispose();
      nebMat.dispose();
      brightGeo.dispose();
      brightMat.dispose();
      geo.dispose();
      mat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} id="webgl" />;
}
