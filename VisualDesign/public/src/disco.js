import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { prepareDiscoData } from "./api.js";
import { getLayout } from "./layout.js";


function cameraDistanceForFill({ radius, fovDeg, fill }) {
  const fovRad = (fovDeg * Math.PI) / 180;
  return (radius / fill) / Math.tan(fovRad / 2);
}

function clampInt(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x | 0));
}

function makeDataTexture(values, width, height) {
  const data = new Float32Array(width * height);
  data.set(values);

  const tex = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RedFormat,
    THREE.FloatType
  );

  // IMPORTANT for DataTexture mapping
  tex.flipY = false;
  tex.needsUpdate = true;

  // crisp tiles
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;

  // Seam safe: clamp; (RepeatWrapping can cause seam columns to "wrap")
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  return tex;
}

function makeMaskTexture(missing, width, height) {
  const data = new Uint8Array(width * height);
  data.set(missing);

  const tex = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType
  );

  tex.flipY = false;
  tex.needsUpdate = true;

  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;

  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  return tex;
}

function createDiscoMaterial(valueTex, missingTex, lonCount, latCount) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uValues: { value: valueTex },
      uMissing: { value: missingTex },
      uLonCount: { value: lonCount },
      uLatCount: { value: latCount },
      uTime: { value: 0 },
      uHoverOn: { value: 0.0 },
      uHoverLon: { value: 0.0 },
      uHoverLat: { value: 0.0 },

      // 3 static point lights (world-space)
      uLightPos1: { value: new THREE.Vector3(3, 2, 4) },
      uLightPos2: { value: new THREE.Vector3(-4, 1, 3) },
      uLightPos3: { value: new THREE.Vector3(0, -3, -4) },
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,

    fragmentShader: `
      precision highp float;

      uniform sampler2D uValues;
      uniform sampler2D uMissing;
      uniform float uLonCount;
      uniform float uLatCount;
      uniform float uTime;

      uniform float uHoverOn;
      uniform float uHoverLon;
      uniform float uHoverLat;

      uniform vec3 uLightPos1;
      uniform vec3 uLightPos2;
      uniform vec3 uLightPos3;

      vec3 hoverColor = vec3(1.0, 0.486, 0.035);

      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      float hash(vec2 p){
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      void main() {
        // IMPORTANT:
        // clamp UV *before* floor to prevent u==1.0 causing lonCount index
        float eps = 1e-6;
        float u = clamp(vUv.x, 0.0, 1.0 - eps);
        float v = clamp(vUv.y, 0.0, 1.0 - eps);

        // tile indices of current fragment
        float lonI = floor(u * uLonCount);
        float latI = floor(v * uLatCount);

        // local position inside tile (0..1)
        float fu = fract(u * uLonCount);
        float fv = fract(v * uLatCount);

        // outline thickness (in tile-local units)
        float t = 0.08;

        // outline mask: 1 at border, 0 inside
        float edgeU = step(fu, t) + step(1.0 - t, fu);
        float edgeV = step(fv, t) + step(1.0 - t, fv);
        float outline = clamp(edgeU + edgeV, 0.0, 1.0);

        // is this the hovered tile?
        float isHover =
          (uHoverOn > 0.5 &&
          abs(lonI - uHoverLon) < 0.5 &&
          abs(latI - uHoverLat) < 0.5) ? 1.0 : 0.0;

        // Quantize -> tile centers
        vec2 tileUV;
        tileUV.x = (floor(u * uLonCount) + 0.5) / uLonCount;
        tileUV.y = (floor(v * uLatCount) + 0.5) / uLatCount;

        float d = texture2D(uValues, tileUV).r;   // 0..1
        float m = texture2D(uMissing, tileUV).r;  // 0..1 (0=present, 1=missing)

        vec3 N = normalize(vNormalW);

        vec3 L1 = normalize(uLightPos1 - vPosW);
        vec3 L2 = normalize(uLightPos2 - vPosW);
        vec3 L3 = normalize(uLightPos3 - vPosW);

        float lambert =
          max(dot(N, L1), 0.0) * 0.60 +
          max(dot(N, L2), 0.0) * 0.45 +
          max(dot(N, L3), 0.0) * 0.30;

        vec3 V = normalize(cameraPosition - vPosW);

        float specPow = 45.0;
        float spec = 0.0;

        vec3 H1 = normalize(L1 + V);
        vec3 H2 = normalize(L2 + V);
        vec3 H3 = normalize(L3 + V);

        spec += pow(max(dot(N, H1), 0.0), specPow) * 0.60;
        spec += pow(max(dot(N, H2), 0.0), specPow) * 0.45;
        spec += pow(max(dot(N, H3), 0.0), specPow) * 0.30;

        float rnd = hash(floor(vec2(u * uLonCount, v * uLatCount)));
        float sparkle = smoothstep(0.70, 1.0, spec) * (0.6 + 0.4*sin(uTime*2.0 + rnd*6.283));

        // Missing tiles
        if (m > 0.5) {
          vec3 missCol = vec3(0.35, 1.0, 0.45);

          if (isHover > 0.5) {
            missCol = mix(missCol, hoverColor, outline);
          }

          float missLight = 0.15 + 0.15 * lambert;
          gl_FragColor = vec4(missCol * missLight, 1.0);
          return;
        }

        // Present tiles
        vec3 base = vec3(0.75);
        float intensity = 0.15 + 0.85 * d;
        vec3 col = base * (0.10 + 0.90 * lambert) * intensity;

        col += vec3(1.0) * spec * (0.55 + 2.0 * d);
        col += vec3(1.0) * sparkle * (0.20 + 0.90 * d);

        // Hover highlight: subtle glow + outline
        if (isHover > 0.5) {
          col = mix(col, hoverColor, outline);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export async function discoBall() {
  // layout
  const layout = getLayout();
  const root = document.querySelector("#discoRoot");
  root.style.width = `${layout.disco.width}px`;
  root.style.height = `${layout.disco.height}px`;

  // grab data
  const { years, lonCount, latCount, values, missing, meta } =
    await prepareDiscoData();

  const isMissingAt = (idx) => missing[idx] > 127;

  const avgByYear = new Array(lonCount).fill(null);     // lonIndex -> avg
  const avgByPos = new Array(latCount).fill(null);      // latIndex -> avg

  // avg per year (lonIndex)
  for (let x = 0; x < lonCount; x++) {
    let sum = 0, n = 0;
    for (let y = 0; y < latCount; y++) {
      const idx = x + y * lonCount;
      if (!isMissingAt(idx)) { sum += values[idx]; n++; }
    }
    avgByYear[x] = n ? (sum / n) : null;
  }

  // avg per position (latIndex)
  for (let y = 0; y < latCount; y++) {
    let sum = 0, n = 0;
    for (let x = 0; x < lonCount; x++) {
      const idx = x + y * lonCount;
      if (!isMissingAt(idx)) { sum += values[idx]; n++; }
    }
    avgByPos[y] = n ? (sum / n) : null;
  }

  // render scene + cam
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    45,
    root.clientWidth / root.clientHeight,
    0.1,
    100
  );

  const R = 1.0;
  const fill = 0.75;
  const dCam = cameraDistanceForFill({ radius: R, fovDeg: 45, fill });
  camera.position.set(0, 0, dCam);
  camera.lookAt(0, 0, 0);

  function applySize() {
    const l = getLayout();
    root.style.width = `${l.disco.width}px`;
    root.style.height = `${l.disco.height}px`;

    const w = l.disco.innerWidth;
    const h = l.disco.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  applySize();
  window.addEventListener("resize", applySize);

  // ctrls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableRotate = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 6.0;
  controls.target.set(0, 0, 0);
  controls.update();

  // mesh + materia
  const valueTex = makeDataTexture(values, lonCount, latCount);
  const missingTex = makeMaskTexture(missing, lonCount, latCount);
  const material = createDiscoMaterial(valueTex, missingTex, lonCount, latCount);

  const geometry = new THREE.SphereGeometry(R, 128, 128);
  const ball = new THREE.Mesh(geometry, material);
  ball.position.y = -0.20 * R;
  scene.add(ball);

  // tooltip
  const tooltipEl = document.querySelector(".tooltip");

  // info panel on rigthclick
  let infoPanel = document.querySelector("#discoInfoPanel");
  if (!infoPanel) {
    infoPanel = document.createElement("div");
    infoPanel.id = "discoInfoPanel";
    infoPanel.style.overflow = "auto";

    root.style.position = "relative"; 
    root.appendChild(infoPanel);
  }

  function showPanel(html) {
    infoPanel.innerHTML = html;
    infoPanel.classList.add("show");
  }

  function hidePanel() {
    infoPanel.classList.remove("show");
  }

  function setTooltip(html, clientX, clientY, mode) {
    tooltipEl.innerHTML = html;
    tooltipEl.style.opacity = "1";
    tooltipEl.dataset.mode = mode;
    tooltipEl.style.left = `${clientX + 12}px`;
    tooltipEl.style.top = `${clientY + 12}px`;
  }
  function hideTooltip() {
    tooltipEl.style.opacity = "0";
    tooltipEl.dataset.mode = "";
  }
  function fmt(x) {
    return x == null ? "n/a" : x.toFixed(3);
  }

  // helper for raycasting 
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function setMouseFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // pos calcs
  function tileFromUV(uv) {
    const eps = 1e-7;
    const u = Math.min(1 - eps, Math.max(0, uv.x));
    const v = Math.min(1 - eps, Math.max(0, uv.y));
    const lonIndex = clampInt(Math.floor(u * lonCount), 0, lonCount - 1);
    const latIndex = clampInt(Math.floor(v * latCount), 0, latCount - 1);
    const idx = lonIndex + latIndex * lonCount;
    return { lonIndex, latIndex, idx };
  }

  // states during interaction with discoball
  let autoRotate = true;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  const dragSpeed = 0.005;

  // prevent contextmenu popup
  renderer.domElement.addEventListener(
    "contextmenu",
    (e) => e.preventDefault(),
    { passive: false }
  );

  renderer.domElement.addEventListener("pointerdown", (event) => {
    setMouseFromEvent(event);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(ball, false);

    if (hit.length) {
      // click on ball: stop auto rotate + start drag
      autoRotate = false;
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    } else {
      // click outside: resume auto rotate
      autoRotate = true;
      isDragging = false;
      hideTooltip();
      hidePanel();
      material.uniforms.uHoverOn.value = 0.0;
    }
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (isDragging) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      ball.rotation.y += dx * dragSpeed;
      ball.rotation.x += dy * dragSpeed;
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }

    // hover tooltip
    setMouseFromEvent(event);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(ball, false);

    if (!hit.length || !hit[0].uv) {
      hideTooltip();
      material.uniforms.uHoverOn.value = 0.0;
      return;
    }

    const { lonIndex, latIndex, idx } = tileFromUV(hit[0].uv);
    material.uniforms.uHoverOn.value = 1.0;
    material.uniforms.uHoverLon.value = lonIndex;
    material.uniforms.uHoverLat.value = latIndex;

    const year = years[lonIndex];
    const position = latCount - latIndex;

    const m = meta?.[idx];
    const song = m?.track_name ?? "n/a";
    const artists = m?.artists ?? "n/a";

    if (isMissingAt(idx)) {
      setTooltip(
        `<strong>Track: ${song}</strong><br>
         Artist: ${artists}<br>
         Year: ${year}<br>
         Chart position: #${position}<br>
         Danceability: <em>Missing information</em>`,
        event.clientX,
        event.clientY,
        "hover"
      );
      return;
    }

    setTooltip(
      `<strong>Track: ${song}</strong><br>
       Artist: ${artists}<br>
       Year: ${year}<br>
       Chart position: #${position}<br>
       Danceability: ${fmt(values[idx])}`,
      event.clientX,
      event.clientY,
      "hover"
    );
  });

  renderer.domElement.addEventListener("pointerup", () => {
    isDragging = false;
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    isDragging = false;
    hideTooltip();
    material.uniforms.uHoverOn.value = 0.0;
  });

  // accept zoom if mouse on ball
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      setMouseFromEvent(e);
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(ball, false);

      if (!hit.length) return; 

      e.preventDefault();
      const zoomStep = 0.10;
      const factor = 1 + Math.sign(e.deltaY) * zoomStep;

      const newZ = THREE.MathUtils.clamp(
        camera.position.z * factor,
        controls.minDistance,
        controls.maxDistance
      );
      camera.position.setZ(newZ);
    },
    { passive: false }
  );

  renderer.domElement.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
      setMouseFromEvent(event);
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(ball, false);
      if (!hit.length || !hit[0].uv) return;

      const { lonIndex, latIndex, idx } = tileFromUV(hit[0].uv);

      const year = years[lonIndex];
      const position = latCount - latIndex;

      const m = meta?.[idx];
      const song = m?.track_name ?? "n/a";
      const artists = m?.artists ?? "n/a";

      const d = isMissingAt(idx) ? null : values[idx];

      const avgPos = avgByPos[latIndex];
      const avgYear = avgByYear[lonIndex];

      const fmt3 = (x) => (x == null ? "n/a" : x.toFixed(3));

      showPanel(`
        <div class="disco-panel-head">
          <div class="panel-title">Detailed information</div>
          <button id="closeDiscoPanel" class="disco-panel-close" aria-label="Close">✕</button>
        </div>

        <div class="disco-panel-body">
          <div class="song-title">${song}</div>
          <div class="artist">${artists}</div>

          <div class="kv"><b>Year:</b> ${year}</div>
          <div class="kv"><b>Position:</b> #${position}</div>
          <div class="kv"><b>Danceability:</b> ${
            d == null ? "<em>Missing information</em>" : fmt3(d)
          }</div>

          <hr />

          <div class="kv"><b>Ø Danceability at place ${position}:</b> ${fmt3(avgPos)}</div>
          <div class="kv"><b>Ø Danceability of ${year}:</b> ${fmt3(avgYear)}</div>
        </div>
      `);

      // close button wiring
      const closeBtn = infoPanel.querySelector("#closeDiscoPanel");
      if (closeBtn) closeBtn.onclick = () => hidePanel();
    },
    { passive: false }
  );

  // animation
  const clock = new THREE.Clock();
  function animate() {
    material.uniforms.uTime.value = clock.getElapsedTime();

    if (autoRotate && !isDragging) {
      ball.rotation.y += 0.003;
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}