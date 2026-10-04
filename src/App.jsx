import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Lightformer } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import { CARDS, makeCard, makeStrap } from './textures'
import { Suitcase, Dust } from './Suitcase'
extend({ MeshLineGeometry, MeshLineMaterial })

const TAG = 'https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/5huRVDzcoDwnbgrKUo1Lzs/53b6dd7d6b4ffcdbd338fa60265949e1/tag.glb'
useGLTF.preload(TAG)

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
  const [selected, setSelected] = useState(() => CARDS.find((c) => c.id === new URLSearchParams(location.search).get('card')) ?? CARDS[0])
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('open'))
  const pick = (c) => (setSelected(c), setOpen(false))
  const btn = { position: 'fixed', right: 24, top: 20, padding: '8px 14px', font: '14px monospace', color: '#fff', background: 'rgba(0,0,0,0.45)', border: '1px solid #fff6', borderRadius: 6, cursor: 'pointer' }
  return (
    <>
      <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
        <World wx={wx} open={open} setOpen={setOpen} selected={selected} pick={pick} />
      </Canvas>
      <div style={{ position: 'fixed', left: 24, bottom: 20, color: '#fff', font: '14px/1.4 monospace', opacity: 0.8, pointerEvents: 'none' }}>
        <div>Bengaluru</div>
        <div>{wx ? `${Math.round(wx.temperature_2m)}°C · ${label(wx.weather_code)} · wind ${Math.round(wx.wind_speed_10m)} km/h` : '…'}</div>
      </div>
      {open && <button style={btn} onClick={() => setOpen(false)}>Close suitcase</button>}
      {!open && selected.old && <button style={btn} onClick={() => setSelected(CARDS[0])}>Back to current ID</button>}
    </>
  )
}

// Everything inside the canvas; also pans the camera into the suitcase when it's opened
function World({ wx, open, setOpen, selected, pick }) {
  const size = useThree((s) => s.size)
  const code = wx?.weather_code ?? 0
  const rain = isRain(code)
  const wind = wx?.wind_speed_10m ?? 8 // km/h, always a little breeze
  const day = wx ? wx.is_day === 1 : true
  const bg = rain ? '#07140f' : !day ? '#08231a' : code === 0 ? '#1f5f48' : '#14332a'
  // suitcase sits at the bottom-right of the home view
  const halfH = 13 * Math.tan((12.5 * Math.PI) / 180), halfW = (halfH * size.width) / size.height
  const casePos = useMemo(() => new THREE.Vector3(halfW - 1.45, -halfH + 1.0, 0.5), [halfW, halfH])
  const home = useMemo(() => [new THREE.Vector3(0, 0, 13), new THREE.Vector3()], [])
  const inside = useMemo(() => [casePos.clone().add(new THREE.Vector3(0, 3.4, 4.3)), casePos.clone().add(new THREE.Vector3(0, 0.45, -0.2))], [casePos])
  const look = useRef(new THREE.Vector3())
  useFrame((s, dt) => {
    const [p, l] = open ? inside : home
    const k = 1 - Math.exp(-3 * dt)
    s.camera.position.lerp(p, k)
    look.current.lerp(l, k)
    s.camera.lookAt(look.current)
  })
  return (
    <>
      <ambientLight intensity={Math.PI} color={day && code === 0 ? '#fff3d6' : '#ffffff'} />
      <directionalLight position={[3, 5, 4]} intensity={2} />
      <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band key={selected.id} data={selected} wind={wind} />
      </Physics>
      {selected.old && <Dust count={120} area={[6, 8, 3]} position={[0.5, 1, 0]} size={0.04} opacity={0.5} />}
      <Suitcase position={casePos} open={open} onOpen={() => setOpen(true)} onPick={pick} cards={CARDS.filter((c) => c.old)} />
      <WindLines wind={wind} />
      {rain && <Rain />}
      <Environment background blur={0.75}>
        <color attach="background" args={[bg]} />
        <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
      </Environment>
    </>
  )
}

function Band({ data, wind = 8, maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef() // prettier-ignore
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3() // prettier-ignore
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 2, linearDamping: 2 }
  const { nodes, materials } = useGLTF(TAG)
  const cardTexture = useMemo(() => makeCard(data), [data])
  const strapTexture = useMemo(() => makeStrap(data), [data])
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
        ref.current.lerped.lerp(ref.current.translation(), Math.min(delta, 1 / 30) * (minSpeed + clampedDistance * (maxSpeed - minSpeed)))
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
