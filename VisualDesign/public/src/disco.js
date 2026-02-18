import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { prepareDiscoData } from "./api.js";
import { getLayout } from "./layout.js";


function cameraDistanceForFill({ radius, fovDeg, fill }) {
  const fovRad = (fovDeg * Math.PI) / 180;
  return (radius / fill) / Math.tan(fovRad / 2);
}

function makeDataTexture(values, width, height) {
  // Red channel only (0..1)
  const data = new Float32Array(width * height);
  data.set(values);
  const tex = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.FloatType);
  tex.needsUpdate = true;

  // Wichtig: keine Interpolation, damit die Tiles "pixlig" bleiben
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;

  // U wrapping für Longitude (Jahre) soll nahtlos sein
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  return tex;
}

function makeMaskTexture(missing, width, height) {
  // Missing als 0/1 in Red channel (0=present, 1=missing)
  const data = new Uint8Array(width * height);
  data.set(missing);
  const tex = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
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

    uLightPos1: { value: new THREE.Vector3( 3,  2,  4) },
    uLightPos2: { value: new THREE.Vector3(-4,  1,  3) },
    uLightPos3: { value: new THREE.Vector3( 0, -3, -4) },
  },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosW = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D uValues;
      uniform sampler2D uMissing;
      uniform float uLonCount;
      uniform float uLatCount;
      uniform float uTime;
      uniform vec3 uLightPos1;
      uniform vec3 uLightPos2;
      uniform vec3 uLightPos3;

      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      // simple hash for tiny sparkle variation
      float hash(vec2 p){
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      void main() {
        // Quantize UV -> discrete tiles (66 x 100)
        vec2 tileUV;
        tileUV.x = (floor(vUv.x * uLonCount) + 0.5) / uLonCount;
        tileUV.y = (floor(vUv.y * uLatCount) + 0.5) / uLatCount;

        float d = texture2D(uValues, tileUV).r;     // 0..1 brightness
        float m = texture2D(uMissing, tileUV).r;    // 0 or 1

        vec3 N = normalize(vNormalW);

      // statische point lights im Weltkoordinatenraum
      vec3 L1 = normalize(uLightPos1 - vPosW);
      vec3 L2 = normalize(uLightPos2 - vPosW);
      vec3 L3 = normalize(uLightPos3 - vPosW);

      // Diffuse (Lambert) gewichtet
      float lambert =
          max(dot(N, L1), 0.0) * 0.60 +
          max(dot(N, L2), 0.0) * 0.45 +
          max(dot(N, L3), 0.0) * 0.30;

      // View direction korrekt (macht Dragging richtig)
      vec3 V = normalize(cameraPosition - vPosW);

      // Specular (Blinn-Phong) pro Licht
      float specPow = 80.0;
      float spec = 0.0;

      vec3 H1 = normalize(L1 + V);
      vec3 H2 = normalize(L2 + V);
      vec3 H3 = normalize(L3 + V);

      spec += pow(max(dot(N, H1), 0.0), specPow) * 0.60;
      spec += pow(max(dot(N, H2), 0.0), specPow) * 0.45;
      spec += pow(max(dot(N, H3), 0.0), specPow) * 0.30;

        // Tile sparkle: small random factor + time wobble
        float rnd = hash(floor(vUv * vec2(uLonCount, uLatCount)));
        float sparkle = smoothstep(0.85, 1.0, spec) * (0.6 + 0.4*sin(uTime*2.0 + rnd*6.283));

        // Base: metallic-ish gray
        vec3 base = vec3(0.75);

        // Missing tiles: darker + almost no specular
        if (m > 0.5) {
          vec3 missCol = vec3(0.10);
          float missLight = 0.15 + 0.15 * lambert;
          gl_FragColor = vec4(missCol * missLight, 1.0);
          return;
        }

        // Present tiles: brightness controls reflectivity / intensity
        float intensity = 0.15 + 0.85 * d; // keep some floor
        vec3 col = base * (0.10 + 0.90 * lambert) * intensity;

        // Specular highlight stronger for higher danceability
        col += vec3(1.0) * spec * (0.25 + 1.2 * d);
        col += vec3(1.0) * sparkle * (0.10 + 0.50 * d);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export async function discoBall() {
  const layout = getLayout();
  const root = document.querySelector("#discoRoot");
  root.style.width = `${layout.disco.width}px`;
  root.style.height = `${layout.disco.height}px`;

  const { lonCount, latCount, values, missing } = await prepareDiscoData();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(root.clientWidth, root.clientHeight);
  root.appendChild(renderer.domElement);


  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    45,
    root.clientWidth / root.clientHeight,
    0.1,
    100
  );

  const R = 1;             
  const FOV = 45;           
  const fill = 0.75;        // bigger val for closer appearance
  const d = cameraDistanceForFill({ radius: R, fovDeg: FOV, fill });
  camera.position.set(0, 0, d);
  camera.lookAt(0, 0, 0);
  const w = layout.disco.innerWidth;
  const h = layout.disco.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const controls = new OrbitControls(camera, renderer.domElement);
  let userInteractionDetected = false;
  controls.addEventListener("start", () => {
    userInteractionDetected = true;
  });

  // feel-good defaults
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  controls.enableZoom = true;
  controls.zoomSpeed = 0.9;

  controls.enablePan = false;           // meistens besser für “hero object”
  controls.rotateSpeed = 0.6;

  // verhindert, dass du “durch” die Kugel zoomst
  controls.minDistance = 1.6;
  controls.maxDistance = 6.0;

  // Fokuspunkt auf Kugelzentrum
  controls.target.set(0, 0, 0);
  controls.update();

  // Build textures: width = lonCount (years), height = latCount (100)
  const valueTex = makeDataTexture(values, lonCount, latCount);
  const missingTex = makeMaskTexture(missing, lonCount, latCount);

  const material = createDiscoMaterial(valueTex, missingTex, lonCount, latCount);

  // Sphere geometry: lots of segments for smooth look
  const geometry = new THREE.SphereGeometry(1.0, 128, 128);
  const ball = new THREE.Mesh(geometry, material);
  scene.add(ball);

  // Stop rotation on click on ball, continue if click nxt to ball
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("click", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hit = raycaster.intersectObject(ball, false);

    if (hit.length > 0) {
      // Klick AUF Ball -> Rotation bleibt aus
      userInteractionDetected = true;
    } else {
      // Klick NEBEN Ball -> Rotation wieder an
      userInteractionDetected = false;
    }
  });

  const yOffset = -0.20 * R; // Y-Offset
  ball.position.y = yOffset;

  // Resize handling
  function onResize() {
  const layout = getLayout();

  root.style.width  = `${layout.disco.width}px`;
  root.style.height = `${layout.disco.height}px`;

  const w = layout.disco.innerWidth;
  const h = layout.disco.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;

    // rotate ball if it's not actively selected
    if (!userInteractionDetected) {
    ball.rotation.y += 0.003;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    controls.update();
  }
  animate();
}