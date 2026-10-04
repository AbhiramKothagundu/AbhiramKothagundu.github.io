import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Lightformer } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
extend({ MeshLineGeometry, MeshLineMaterial })

const TAG = 'https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/5huRVDzcoDwnbgrKUo1Lzs/53b6dd7d6b4ffcdbd338fa60265949e1/tag.glb'
const GREEN = '#1f8a63'
useGLTF.preload(TAG)

// Card face: same UV layout as the original (front = left half, back = right half)
function useCardTexture() {
  const [tex] = useState(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 1024, 1024)
    const t = new THREE.CanvasTexture(c)
    t.flipY = false
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 16
    const img = new Image()
    img.src = import.meta.env.BASE_URL + 'binocs.jpg'
    img.onload = () => {
      // front: logo + BINOCS top-left, minimal details below
      g.drawImage(img, 24, 24, 80, 80)
      g.fillStyle = GREEN
      g.font = '700 30px monospace'
      g.letterSpacing = '4px'
      g.textBaseline = 'middle'
      g.fillText('BINOCS', 108, 64)
      g.letterSpacing = '0px'
      g.textBaseline = 'alphabetic'
      g.fillStyle = '#888'
      g.font = '22px monospace'
      g.fillText('NAME', 40, 560)
      g.fillStyle = '#111'
      g.font = '600 40px sans-serif'
      g.fillText('Abhiram', 40, 610)
      g.fillText('Kothagundu', 40, 660)
      g.fillStyle = '#888'
      g.font = '22px monospace'
      g.fillText('ROLE', 40, 705)
      g.fillStyle = GREEN
      g.font = '600 32px sans-serif'
      g.fillText('Software Engineer', 40, 745)
      // back: centred logo
      g.drawImage(img, 612, 235, 300, 300)
      t.needsUpdate = true
    }
    return t
  })
  return tex
}

// Jack of Spades hologram: rainbow-tinted emblem that fades in as the card tilts away from the camera
const holoShader = {
  uniforms: { map: { value: null } },
  vertexShader: `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - w.xyz);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `
    uniform sampler2D map; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    vec3 hsv(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
    void main() {
      float a = texture2D(map, vUv).a;
      float tilt = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
      vec3 c = mix(vec3(1.0), hsv(fract(tilt * 4.0 + vUv.y * 0.8 + vUv.x * 0.4)), 0.85);
      gl_FragColor = vec4(c * 0.8, a * clamp(0.12 + tilt * 3.0, 0.0, 0.9));
    }`,
}
function useHoloTexture() {
  const [tex] = useState(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 716
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.font = '420px serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('\u2660', 256, 330)
    g.globalCompositeOperation = 'destination-out' // cut a J out of the spade
    g.font = '700 150px serif'
    g.fillText('J', 256, 350)
    return new THREE.CanvasTexture(c)
  })
  return tex
}

// Strap: green with [logo  BINOCS] across its width, repeating along its length
function useStrapTexture() {
  const [tex] = useState(() => {
    const c = document.createElement('canvas')
    c.width = 512 // along the strap; 512:195 matches the on-screen tile (~2.6:1) so nothing is squished
    c.height = 195 // across the strap
    const g = c.getContext('2d')
    g.fillStyle = GREEN
    g.fillRect(0, 0, 512, 195)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 16
    const img = new Image()
    img.src = import.meta.env.BASE_URL + 'binocs.jpg'
    img.onload = () => {
      // logo -> white on transparent (alpha from how far each pixel is from white)
      const l = document.createElement('canvas')
      l.width = l.height = 64
      const lg = l.getContext('2d')
      lg.drawImage(img, 0, 0, 64, 64)
      const d = lg.getImageData(0, 0, 64, 64)
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i + 3] = 255 - Math.min(d.data[i], d.data[i + 1], d.data[i + 2])
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255
      }
      lg.putImageData(d, 0, 0)
      // along the strap's length: [logo  BINOCS], centred
      g.drawImage(l, 128, 66, 64, 64)
      g.fillStyle = '#fff'
      g.font = '700 40px monospace'
      g.letterSpacing = '4px'
      g.textBaseline = 'middle'
      g.fillText('BINOCS', 216, 100)
      t.needsUpdate = true
    }
    return t
  })
  return tex
}

// Live Bengaluru weather (Open-Meteo, no key needed), refreshed every 10 min
const WX = 'https://api.open-meteo.com/v1/forecast?latitude=12.97&longitude=77.59&current=temperature_2m,weather_code,wind_speed_10m,is_day'
const isRain = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95
function label(c) {
  if (c === 0) return 'Clear'
  if (c <= 3) return 'Partly cloudy'
  if (c <= 48) return 'Fog'
  if (c <= 67 || (c >= 80 && c <= 82)) return 'Rain'
  return c >= 95 ? 'Thunderstorm' : 'Cloudy'
}
function useWeather() {
  const [wx, setWx] = useState(null)
  useEffect(() => {
    const load = () =>
      fetch(WX).then((r) => r.json()).then((d) => setWx(d.current)).catch(() => {}) // offline: keep defaults
    load()
    const id = setInterval(load, 600000)
    return () => clearInterval(id)
  }, [])
  return wx
}

function Rain({ count = 500 }) {
  const ref = useRef()
  const [pos] = useState(() => {
    const a = new Float32Array(count * 6)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 24, y = Math.random() * 16 - 4, z = (Math.random() - 0.5) * 8
      a.set([x, y, z, x, y + 0.4, z], i * 6)
    }
    return a
  })
  useFrame((_, dt) => {
    for (let i = 0; i < count; i++) {
      const j = i * 6 + 1
      pos[j] -= 18 * dt
      pos[j + 3] = pos[j] + 0.4
      if (pos[j] < -4) pos[j] += 16
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#9fd3c7" transparent opacity={0.5} />
    </lineSegments>
  )
}

// Faint streaks blowing sideways, speed follows the real wind
function WindLines({ wind, count = 40 }) {
  const ref = useRef()
  const [pos] = useState(() => {
    const a = new Float32Array(count * 6)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 24, y = (Math.random() - 0.5) * 12, z = (Math.random() - 0.5) * 6
      a.set([x, y, z, x + 1.5, y, z], i * 6)
    }
    return a
  })
  useFrame((_, dt) => {
    const v = (1 + wind / 4) * dt
    for (let i = 0; i < count; i++) {
      const j = i * 6
      pos[j] += v
      pos[j + 3] = pos[j] + 1 + wind / 15
      if (pos[j] > 12) pos[j] -= 26
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.12} />
    </lineSegments>
  )
}

export default function App() {
  const wx = useWeather()
  const code = wx?.weather_code ?? 0
  const rain = isRain(code)
  const wind = wx?.wind_speed_10m ?? 8 // km/h, always a little breeze
  const day = wx ? wx.is_day === 1 : true
  const bg = rain ? '#07140f' : !day ? '#08231a' : code === 0 ? '#1f5f48' : '#14332a'
  return (
    <>
      <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
        <ambientLight intensity={Math.PI} color={day && code === 0 ? '#fff3d6' : '#ffffff'} />
        <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
          <Band wind={wind} />
        </Physics>
        <WindLines wind={wind} />
        {rain && <Rain />}
        <Environment background blur={0.75}>
          <color attach="background" args={[bg]} />
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
      <div style={{ position: 'fixed', left: 24, bottom: 20, color: '#fff', font: '14px/1.4 monospace', opacity: 0.8, pointerEvents: 'none' }}>
        <div>Bengaluru</div>
        <div>{wx ? `${Math.round(wx.temperature_2m)}°C · ${label(code)} · wind ${Math.round(wind)} km/h` : '…'}</div>
      </div>
    </>
  )
}

function Band({ wind = 8, maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef() // prettier-ignore
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3() // prettier-ignore
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 2, linearDamping: 2 }
  const { nodes, materials } = useGLTF(TAG)
  const cardTexture = useCardTexture()
  const strapTexture = useStrapTexture()
  const holoTexture = useHoloTexture()
  const { width, height } = useThree((state) => state.size)
  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]))
  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]) // prettier-ignore

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab'
      return () => void (document.body.style.cursor = 'auto')
    }
  }, [hovered, dragged])

  // Wobble the card on scroll / touch-drag
  useEffect(() => {
    const kick = (dy) => {
      const k = Math.max(-1, Math.min(1, dy / 100))
      ;[card, j3].forEach((r) => r.current?.wakeUp())
      card.current?.applyImpulse({ x: k * 0.6, y: 0, z: Math.abs(k) * 0.3 }, true)
      card.current?.applyTorqueImpulse({ x: 0, y: k * 0.4, z: 0 }, true)
    }
    let ty
    const wheel = (e) => kick(e.deltaY)
    const start = (e) => (ty = e.touches[0].clientY)
    const move = (e) => (kick(ty - e.touches[0].clientY), (ty = e.touches[0].clientY))
    addEventListener('wheel', wheel)
    addEventListener('touchstart', start)
    addEventListener('touchmove', move)
    return () => (removeEventListener('wheel', wheel), removeEventListener('touchstart', start), removeEventListener('touchmove', move))
  }, [])

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      dir.copy(vec).sub(state.camera.position).normalize()
      vec.add(dir.multiplyScalar(state.camera.position.length()))
      ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z })
    }
    // Wind: constant breeze with gusts, pushing the card sideways (force scales with mass)
    if (card.current && !dragged) {
      const t = state.clock.elapsedTime
      const gust = 0.6 + 0.4 * Math.sin(t * 0.8) + 0.3 * Math.sin(t * 2.3 + 1)
      const f = card.current.mass() * wind * 0.3 * gust * Math.min(delta, 1 / 30)
      card.current.applyImpulse({ x: f, y: 0, z: f * 0.4 * Math.sin(t * 1.3) }, true)
    }
    if (fixed.current) {
      // Fix most of the jitter when over pulling the card
      ;[j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())))
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)))
      })
      // Calculate catmul curve
      curve.points[0].copy(j3.current.translation())
      curve.points[1].copy(j2.current.lerped)
      curve.points[2].copy(j1.current.lerped)
      curve.points[3].copy(fixed.current.translation())
      band.current.geometry.setPoints(curve.getPoints(32))
      // Tilt it back towards the screen
      ang.copy(card.current.angvel())
      rot.copy(card.current.rotation())
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z })
    }
  })

  curve.curveType = 'chordal'

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => (e.target.releasePointerCapture(e.pointerId), drag(false))}
            onPointerDown={(e) => (e.target.setPointerCapture(e.pointerId), drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation()))))}>
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial map={cardTexture} clearcoat={1} clearcoatRoughness={0.15} roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.523, 0.0065]}>
              <planeGeometry args={[0.716, 1]} />
              <shaderMaterial args={[holoShader]} uniforms-map-value={holoTexture} transparent depthWrite={false} />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" resolution={[width, height]} useMap depthTest={false} map={strapTexture} repeat={[-3.5, 1]} lineWidth={1.4} />
      </mesh>
    </>
  )
}
