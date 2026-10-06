import * as THREE from "three";

export interface TraceLook {
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    wetness: number,
    sky: THREE.Color,
  ): void;
  dispose(): void;
}

const SSR_FS = `
  #include <packing>
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform mat4 cameraProjectionMatrix;
  uniform mat4 cameraInverseProjectionMatrix;
  uniform float wetness;
  uniform vec3 skyColor;
  uniform vec3 viewUp;
  uniform vec2 resolution;
  varying vec2 vUv;

  vec3 viewPosition(vec2 uv, float depth) {
    float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
    float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];
    vec4 clipPosition = vec4((vec3(uv, depth) - 0.5) * 2.0, 1.0);
    clipPosition *= clipW;
    return (cameraInverseProjectionMatrix * clipPosition).xyz;
  }

  void main() {
    float depth = texture2D(tDepth, vUv).x;
    if (depth >= 0.999) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 pos = viewPosition(vUv, depth);
    vec2 texel = 1.0 / resolution;
    vec3 posX = viewPosition(vUv + vec2(texel.x, 0.0), texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x);
    vec3 posY = viewPosition(vUv + vec2(0.0, texel.y), texture2D(tDepth, vUv + vec2(0.0, texel.y)).x);
    vec3 normal = normalize(cross(posX - pos, posY - pos));
    if (dot(normal, pos) > 0.0) normal = -normal;
    float upness = dot(normal, viewUp);
    if (upness < 0.62) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 incident = normalize(pos);
    vec3 refl = normalize(reflect(incident, normal));
    if (dot(refl, viewUp) < 0.02) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float roughness = mix(0.55, 0.06, clamp(wetness, 0.0, 1.0));
    vec3 from = pos + normal * 0.12;
    vec3 to = from + refl * 9.0;
    vec4 c0 = cameraProjectionMatrix * vec4(from, 1.0);
    vec4 c1 = cameraProjectionMatrix * vec4(to, 1.0);
    vec3 n0 = c0.xyz / max(c0.w, 0.0001);
    vec3 n1 = c1.xyz / max(c1.w, 0.0001);
    vec2 uv0 = n0.xy * 0.5 + 0.5;
    vec2 uv1 = n1.xy * 0.5 + 0.5;
    float z0 = n0.z * 0.5 + 0.5;
    float z1 = n1.z * 0.5 + 0.5;
    const int STEPS = 14;
    vec2 stepUv = (uv1 - uv0) / float(STEPS);
    float stepZ = (z1 - z0) / float(STEPS);
    vec2 uv = uv0;
    float rayZ = z0;
    bool hit = false;
    vec2 hitUv = uv;
    float hitDelta = 1.0;
    for (int i = 0; i < STEPS; i++) {
      uv += stepUv;
      rayZ += stepZ;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
      if (i < 2) continue;
      float sceneZ = texture2D(tDepth, uv).x;
      float gap = rayZ - sceneZ;
      float thickness = 0.012 + roughness * 0.045;
      if (sceneZ < 0.999 && gap > 0.0015 && gap < thickness) {
        hit = true;
        hitUv = uv;
        hitDelta = gap;
        break;
      }
    }
    if (hit) {
      vec2 lo = hitUv - stepUv;
      float loZ = rayZ - stepZ;
      for (int b = 0; b < 4; b++) {
        vec2 mid = (lo + hitUv) * 0.5;
        float midZ = (loZ + rayZ) * 0.5;
        float sceneZ = texture2D(tDepth, mid).x;
        if (sceneZ < 0.999 && midZ > sceneZ) {
          hitUv = mid;
          rayZ = midZ;
        } else {
          lo = mid;
          loZ = midZ;
        }
      }
    }

    vec3 color = skyColor;
    if (hit) {
      float spread = (1.0 + roughness * 7.0 + hitDelta * 18.0);
      vec2 texel = spread / resolution;
      float hash = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 jitter = (vec2(hash, fract(hash * 17.0)) - 0.5) * texel * roughness * 2.0;
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y));
          float w = 1.0 - length(o) * 0.22;
          vec2 sampleUv = clamp(hitUv + o * texel + jitter, 0.001, 0.999);
          acc += texture2D(tColor, sampleUv).rgb * w;
          wsum += w;
        }
      }
      color = acc / wsum;
      float edge = smoothstep(0.0, 0.04, hitUv.x) * smoothstep(1.0, 0.96, hitUv.x);
      edge *= smoothstep(0.0, 0.04, hitUv.y) * smoothstep(1.0, 0.96, hitUv.y);
      color = mix(skyColor, color, edge);
    }

    float ndotv = clamp(dot(normal, -incident), 0.0, 1.0);
    float fresnel = 0.42 + 0.58 * pow(1.0 - ndotv, 5.0);
    float fade = smoothstep(0.62, 0.86, upness);
    float alpha = min(0.78, fresnel * fade * smoothstep(0.04, 0.28, wetness));
    gl_FragColor = vec4(color, hit ? alpha : alpha * 0.35);
  }
`;

const SSAO_FS = `
  #include <packing>
  uniform sampler2D tDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform mat4 cameraProjectionMatrix;
  uniform mat4 cameraInverseProjectionMatrix;
  uniform vec3 viewUp;
  uniform vec2 resolution;
  varying vec2 vUv;

  vec3 viewPosition(vec2 uv, float depth) {
    float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
    float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];
    vec4 clipPosition = vec4((vec3(uv, depth) - 0.5) * 2.0, 1.0);
    clipPosition *= clipW;
    return (cameraInverseProjectionMatrix * clipPosition).xyz;
  }

  void main() {
    float depth = texture2D(tDepth, vUv).x;
    if (depth >= 0.999) {
      gl_FragColor = vec4(1.0);
      return;
    }
    vec3 pos = viewPosition(vUv, depth);
    vec2 texel = 1.0 / resolution;
    vec3 posX = viewPosition(vUv + vec2(texel.x, 0.0), texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x);
    vec3 posY = viewPosition(vUv + vec2(0.0, texel.y), texture2D(tDepth, vUv + vec2(0.0, texel.y)).x);
    vec3 normal = normalize(cross(posX - pos, posY - pos));
    if (dot(normal, pos) > 0.0) normal = -normal;
    float radius = 0.52;
    float occ = 0.0;
    float samples = 8.0;
    float noise = fract(sin(dot(vUv, vec2(41.2, 289.1))) * 43758.5453);
    for (int i = 0; i < 8; i++) {
      float ang = float(i) * 2.399963 + noise * 6.28318;
      float r = radius * (float(i) + 0.35) / samples;
      vec3 axis = cross(normal, vec3(0.0, 0.0, 1.0));
      if (dot(axis, axis) < 0.0001) axis = cross(normal, viewUp);
      vec3 tangent = normalize(axis);
      vec3 bitangent = normalize(cross(normal, tangent));
      vec3 samplePos = pos + normal * 0.04 + (tangent * cos(ang) + bitangent * sin(ang)) * r;
      vec4 clip = cameraProjectionMatrix * vec4(samplePos, 1.0);
      vec2 uv = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
      float sceneDepth = texture2D(tDepth, uv).x;
      vec3 scenePos = viewPosition(uv, sceneDepth);
      float range = smoothstep(radius * 1.4, radius * 0.15, abs(pos.z - scenePos.z));
      occ += step(samplePos.z + 0.025, scenePos.z) * range;
    }
    float ao = 1.0 - (occ / samples) * 0.85;
    gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
  }
`;

const BLUR_FS = `
  uniform sampler2D tMap;
  uniform vec2 direction;
  uniform vec2 resolution;
  varying vec2 vUv;
  void main() {
    vec2 texel = direction / resolution;
    vec3 acc = texture2D(tMap, vUv).rgb * 0.227;
    acc += texture2D(tMap, vUv + texel * 1.4).rgb * 0.316;
    acc += texture2D(tMap, vUv - texel * 1.4).rgb * 0.316;
    acc += texture2D(tMap, vUv + texel * 3.2).rgb * 0.070;
    acc += texture2D(tMap, vUv - texel * 3.2).rgb * 0.070;
    gl_FragColor = vec4(acc, 1.0);
  }
`;

const BLOOM_FS = `
  uniform sampler2D tColor;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(tColor, vUv).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float glow = smoothstep(0.72, 0.98, luma);
    gl_FragColor = vec4(color * glow, 1.0);
  }
`;

const COPY_FS = `
  uniform sampler2D tMap;
  uniform float gain;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(tMap, vUv).rgb * gain, 1.0);
  }
`;

const REFLECT_FS = `
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() {
    vec4 sampleColor = texture2D(tMap, vUv);
    gl_FragColor = vec4(sampleColor.rgb, sampleColor.a);
  }
`;

export function createTraceLook(): TraceLook {
  const blit = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry);
  blit.add(quad);

  const holder = { r: 0, g: 0, b: 0 };
  const viewUp = new THREE.Vector3();
  const proj = new THREE.Matrix4();
  const inv = new THREE.Matrix4();

  let width = 0;
  let height = 0;
  let depthType: THREE.TextureDataType = THREE.UnsignedIntType;
  let depthChecked = false;
  let sceneTarget: THREE.WebGLRenderTarget | null = null;
  let ssrTarget: THREE.WebGLRenderTarget | null = null;
  let aoTarget: THREE.WebGLRenderTarget | null = null;
  let aoBlur: THREE.WebGLRenderTarget | null = null;
  let bloomTarget: THREE.WebGLRenderTarget | null = null;
  let bloomBlur: THREE.WebGLRenderTarget | null = null;

  const ssr = shader(SSR_FS, {
    tColor: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 180 },
    cameraProjectionMatrix: { value: proj },
    cameraInverseProjectionMatrix: { value: inv },
    wetness: { value: 0 },
    skyColor: { value: new THREE.Vector3() },
    viewUp: { value: new THREE.Vector3(0, 1, 0) },
    resolution: { value: new THREE.Vector2(1, 1) },
  });
  const ssao = shader(SSAO_FS, {
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 180 },
    cameraProjectionMatrix: { value: proj },
    cameraInverseProjectionMatrix: { value: inv },
    viewUp: { value: new THREE.Vector3(0, 1, 0) },
    resolution: { value: new THREE.Vector2(1, 1) },
  });
  const blur = shader(BLUR_FS, {
    tMap: { value: null },
    direction: { value: new THREE.Vector2(1, 0) },
    resolution: { value: new THREE.Vector2(1, 1) },
  });
  const bloom = shader(BLOOM_FS, { tColor: { value: null } });
  const copy = shader(COPY_FS, { tMap: { value: null }, gain: { value: 1 } });
  copy.blending = THREE.AdditiveBlending;
  const reflect = shader(REFLECT_FS, { tMap: { value: null } });
  reflect.blending = THREE.CustomBlending;
  reflect.blendSrc = THREE.SrcAlphaFactor;
  reflect.blendDst = THREE.OneMinusSrcAlphaFactor;
  reflect.blendSrcAlpha = THREE.ZeroFactor;
  reflect.blendDstAlpha = THREE.OneFactor;
  const multiply = shader(COPY_FS, { tMap: { value: null }, gain: { value: 1 } });
  multiply.premultipliedAlpha = true;
  multiply.blending = THREE.MultiplyBlending;
  const materials = [ssr, ssao, blur, bloom, copy, reflect, multiply];

  function ensure(nextWidth: number, nextHeight: number): void {
    if (sceneTarget && width === nextWidth && height === nextHeight) return;
    disposeTargets();
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    sceneTarget = makeColor(width, height, true, depthType);
    ssrTarget = makeColor(Math.max(1, width >> 1), Math.max(1, height >> 1), false);
    aoTarget = makeColor(Math.max(1, width >> 1), Math.max(1, height >> 1), false);
    aoBlur = makeColor(Math.max(1, width >> 1), Math.max(1, height >> 1), false);
    bloomTarget = makeColor(Math.max(1, width >> 2), Math.max(1, height >> 2), false);
    bloomBlur = makeColor(Math.max(1, width >> 2), Math.max(1, height >> 2), false);
  }

  function render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    view: THREE.PerspectiveCamera,
    wetness: number,
    sky: THREE.Color,
  ): void {
    ensure(renderer.domElement.width, renderer.domElement.height);
    const colorTarget = sceneTarget;
    const reflectTarget = ssrTarget;
    const aoA = aoTarget;
    const aoB = aoBlur;
    const bloomA = bloomTarget;
    const bloomB = bloomBlur;
    if (!colorTarget || !reflectTarget || !aoA || !aoB || !bloomA || !bloomB) return;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(colorTarget);
    renderer.clear();
    renderer.render(scene, view);
    if (!depthChecked) {
      depthChecked = true;
      const gl = renderer.getContext();
      if (depthType === THREE.UnsignedIntType && gl.getError() !== gl.NO_ERROR) {
      depthType = THREE.UnsignedShortType;
      disposeTargets();
      width = 0;
      ensure(renderer.domElement.width, renderer.domElement.height);
      render(renderer, scene, view, wetness, sky);
        return;
      }
    }

    view.updateMatrixWorld();
    proj.copy(view.projectionMatrix);
    inv.copy(view.projectionMatrixInverse);
    viewUp.set(0, 1, 0).transformDirection(view.matrixWorldInverse);
    sky.getRGB(holder, THREE.SRGBColorSpace);
    const skyVec = ssr.uniforms.skyColor.value as THREE.Vector3;
    skyVec.set(holder.r, holder.g, holder.b);
    ssr.uniforms.tColor.value = colorTarget.texture;
    ssr.uniforms.tDepth.value = colorTarget.depthTexture;
    ssr.uniforms.cameraNear.value = view.near;
    ssr.uniforms.cameraFar.value = view.far;
    ssr.uniforms.wetness.value = wetness;
    (ssr.uniforms.viewUp.value as THREE.Vector3).copy(viewUp);
    (ssr.uniforms.resolution.value as THREE.Vector2).set(colorTarget.width, colorTarget.height);
    ssao.uniforms.tDepth.value = colorTarget.depthTexture;
    ssao.uniforms.cameraNear.value = view.near;
    ssao.uniforms.cameraFar.value = view.far;
    (ssao.uniforms.viewUp.value as THREE.Vector3).copy(viewUp);
    (ssao.uniforms.resolution.value as THREE.Vector2).set(colorTarget.width, colorTarget.height);

    pass(renderer, reflectTarget, ssr);
    pass(renderer, aoA, ssao);
    blur.uniforms.tMap.value = aoA.texture;
    (blur.uniforms.direction.value as THREE.Vector2).set(1, 0);
    (blur.uniforms.resolution.value as THREE.Vector2).set(aoA.width, aoA.height);
    pass(renderer, aoB, blur);
    blur.uniforms.tMap.value = aoB.texture;
    (blur.uniforms.direction.value as THREE.Vector2).set(0, 1);
    pass(renderer, aoA, blur);

    bloom.uniforms.tColor.value = colorTarget.texture;
    pass(renderer, bloomA, bloom);
    blur.uniforms.tMap.value = bloomA.texture;
    (blur.uniforms.direction.value as THREE.Vector2).set(1, 0);
    (blur.uniforms.resolution.value as THREE.Vector2).set(bloomA.width, bloomA.height);
    pass(renderer, bloomB, blur);
    blur.uniforms.tMap.value = bloomB.texture;
    (blur.uniforms.direction.value as THREE.Vector2).set(0, 1);
    pass(renderer, bloomA, blur);

    const sceneBlit = new THREE.MeshBasicMaterial({ map: colorTarget.texture, depthTest: false, depthWrite: false });
    renderer.setRenderTarget(previousTarget);
    renderer.autoClear = true;
    quad.material = sceneBlit;
    renderer.render(blit, camera);
    sceneBlit.dispose();

    renderer.autoClear = false;
    reflect.uniforms.tMap.value = reflectTarget.texture;
    quad.material = reflect;
    renderer.render(blit, camera);
    multiply.uniforms.tMap.value = aoA.texture;
    multiply.uniforms.gain.value = 1;
    quad.material = multiply;
    renderer.render(blit, camera);
    copy.uniforms.tMap.value = bloomA.texture;
    copy.uniforms.gain.value = 0.2;
    quad.material = copy;
    renderer.render(blit, camera);

    renderer.autoClear = previousAutoClear;
    renderer.setRenderTarget(previousTarget);
  }

  function pass(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, material: THREE.ShaderMaterial): void {
    renderer.setRenderTarget(target);
    renderer.clear();
    quad.material = material;
    renderer.render(blit, camera);
  }

  return {
    render,
    dispose() {
      disposeTargets();
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };

  function disposeTargets(): void {
    sceneTarget?.dispose();
    ssrTarget?.dispose();
    aoTarget?.dispose();
    aoBlur?.dispose();
    bloomTarget?.dispose();
    bloomBlur?.dispose();
    sceneTarget = null;
    ssrTarget = null;
    aoTarget = null;
    aoBlur = null;
    bloomTarget = null;
    bloomBlur = null;
  }
}

function makeColor(
  width: number,
  height: number,
  sceneColor: boolean,
  depthType?: THREE.TextureDataType,
): THREE.WebGLRenderTarget {
  const depthTexture = sceneColor ? new THREE.DepthTexture(width, height, depthType ?? THREE.UnsignedIntType) : undefined;
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthTexture,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  target.texture.colorSpace = sceneColor ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  return target;
}

function shader(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader,
  });
}
