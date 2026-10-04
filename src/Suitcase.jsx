import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { makeCard } from './textures'

const INK = '#1a1008'
const BROWN = '#8b5a2b'
const LINING = '#7a2e2e'
const BELT = '#5a3518'
const CAP = '#3b2412'
const GOLD = '#d9b44a'
const WEB = '#efeadb'

// Comic look: flat toon fill + a slightly bigger black back-face copy as the outline
function Ink({ size, color, position, rotation, shape = 'box', ink = 0.03, children }) {
  const geo = (s) =>
    shape === 'box' ? <boxGeometry args={s} /> : shape === 'cyl' ? <cylinderGeometry args={[s[0], s[0], s[1], 12]} /> : <icosahedronGeometry args={[s[0], 0]} />
  const r = 1 + ink / size[0]
  const hull = shape === 'box' ? size.map((v) => (v + ink * 2) / v) : shape === 'cyl' ? [r, (size[1] + ink * 2) / size[1], r] : [r, r, r]
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        {geo(size)}
        <meshToonMaterial color={color} />
      </mesh>
      <mesh scale={hull}>
        {geo(size)}
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {children}
    </group>
  )
}

// Floating dust motes; opacity eases to the `opacity` prop
export function Dust({ count = 80, area = [2, 1, 1], position = [0, 0, 0], size = 0.03, color = '#d9c9a3', opacity = 0.6, speed = 0.05 }) {
  const ref = useRef()
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) a.set(area.map((v) => (Math.random() - 0.5) * v), i * 3)
    return a
  }, [count])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += dt * speed
      pos[i * 3] += Math.sin(t + i) * dt * speed * 0.6
      if (pos[i * 3 + 1] > area[1] / 2) pos[i * 3 + 1] -= area[1]
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.material.opacity = THREE.MathUtils.damp(ref.current.material.opacity, opacity, 2, dt)
  })
  return (
    <points ref={ref} position={position} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={0} depthWrite={false} />
    </points>
  )
}

// Low-poly quarter cobweb: spokes + sagging rings, corner at the origin, spreading along +x/+y
function Cobweb({ position, rotation, scale = 1, flip = [1, 1, 1] }) {
  const pos = useMemo(() => {
    const p = [], R = 0.5, A = [0, 1, 2, 3, 4].map((k) => (k * Math.PI) / 8)
    A.forEach((a) => p.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0))
    ;[0.15, 0.3, 0.5].forEach((r) => {
      for (let k = 0; k < 4; k++) {
        const ax = Math.cos(A[k]) * r, ay = Math.sin(A[k]) * r, bx = Math.cos(A[k + 1]) * r, by = Math.sin(A[k + 1]) * r
        const mx = ((ax + bx) / 2) * 0.85, my = ((ay + by) / 2) * 0.85 // sag toward the corner
        p.push(ax, ay, 0, mx, my, 0, mx, my, 0, bx, by, 0)
      }
    })
    return new Float32Array(p)
  }, [])
  return (
    <lineSegments position={position} rotation={rotation} scale={flip.map((f) => f * scale)}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={WEB} transparent opacity={0.85} />
    </lineSegments>
  )
}

// Low-poly spider. Bobs on a thread from `anchor`, or with `path` crawls back and forth between two points
// (path is in the group's local frame, local +y = away from the surface it walks on).
function Spider({ anchor = [0, 0, 0], rotation, len = 0.5, path, speed = 1, phase = 0, size = 1.2 }) {
  const body = useRef(), thread = useRef(), legs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase
    if (path) {
      const [a, b] = path, k = 0.5 - 0.5 * Math.cos(t * 0.5), back = Math.sin(t * 0.5) < 0
      body.current.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.04 * size, a[2] + (b[2] - a[2]) * k)
      body.current.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]) + (back ? Math.PI : 0)
    } else {
      const L = len + Math.sin(t) * 0.12
      body.current.position.y = -L
      thread.current.scale.y = L
      thread.current.position.y = -L / 2
    }
    legs.current.forEach((l, i) => (l.rotation.z = (i < 4 ? 1 : -1) * (0.45 + 0.3 * Math.sin(t * (path ? 12 : 7) + i))))
  })
  return (
    <group position={anchor} rotation={rotation}>
      {!path && (
        <mesh ref={thread}>
          <cylinderGeometry args={[0.005, 0.005, 1, 3]} />
          <meshBasicMaterial color={WEB} />
        </mesh>
      )}
      <group ref={body} scale={size}>
        <Ink shape="ico" size={[0.06]} color="#4a2f63" ink={0.015} />
        <Ink shape="ico" size={[0.035]} color="#4a2f63" position={[0, 0, 0.07]} ink={0.012} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} rotation={[0, ((i % 4) - 1.5) * 0.55, 0]}>
            <mesh position={[(i < 4 ? 1 : -1) * 0.08, 0, 0]}>
              <boxGeometry args={[0.14, 0.014, 0.014]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

const W = 2, D = 1.3, H = 0.45, T = 0.07 // suitcase width, depth, wall height, wall thickness

// A brown comic suitcase. `open` swings the lid up; cards inside are clickable.
export function Suitcase({ position, scale = 0.7, open, onOpen, onPick, cards }) {
  const root = useRef(), lid = useRef(), spiders = useRef()
  const [hover, setHover] = useState(null)
  const fronts = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, makeCard(c, true)])), [cards])

  useEffect(() => {
    document.body.style.cursor = hover || !open ? (hover ? 'pointer' : 'auto') : 'auto'
    return () => void (document.body.style.cursor = 'auto')
  }, [hover, open])

  useFrame((_, dt) => {
    spiders.current.visible = lid.current.rotation.x < -1.2
    lid.current.rotation.x = THREE.MathUtils.damp(lid.current.rotation.x, open ? -1.95 : 0, 3, dt)
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, open ? 0 : -0.4, 3, dt)
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, open ? 0.5 : 0.35, 3, dt)
  })

  return (
    <group ref={root} position={position} scale={scale} onClick={(e) => !open && (e.stopPropagation(), onOpen())}
      onPointerOver={() => !open && setHover('case')} onPointerOut={() => setHover(null)}>
      {/* tray */}
      <Ink size={[W, T, D]} color={BROWN} position={[0, T / 2, 0]} />
      <mesh position={[0, T + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - T * 2, D - T * 2]} />
        <meshToonMaterial color={LINING} />
      </mesh>
      <Ink size={[W, H, T]} color={BROWN} position={[0, H / 2, D / 2 - T / 2]} />
      <Ink size={[W, H, T]} color={BROWN} position={[0, H / 2, -D / 2 + T / 2]} />
      <Ink size={[T, H, D]} color={BROWN} position={[-W / 2 + T / 2, H / 2, 0]} />
      <Ink size={[T, H, D]} color={BROWN} position={[W / 2 - T / 2, H / 2, 0]} />
      {/* leather belts down the front, brass corner caps */}
      {[-0.55, 0.55].map((x) => (
        <Ink key={x} size={[0.14, H - 0.14, 0.02]} color={BELT} position={[x, (H - 0.14) / 2 + 0.02, D / 2 + 0.012]} ink={0.012} />
      ))}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
        <Ink key={`${sx}${sz}`} size={[0.13, 0.16, 0.13]} color={CAP} position={[(sx * W) / 2, 0.08, (sz * D) / 2]} ink={0.02} />
      ))}
      {/* latches + handle */}
      {[-0.55, 0.55].map((x) => (
        <Ink key={x} size={[0.18, 0.16, 0.05]} color={GOLD} position={[x, H - 0.06, D / 2 + 0.03]} ink={0.02} />
      ))}
      <mesh position={[0, 0.25, D / 2 + 0.05]}>
        <torusGeometry args={[0.2, 0.035, 4, 8, Math.PI]} />
        <meshToonMaterial color={INK} />
      </mesh>

      {/* lid, hinged at the back */}
      <group ref={lid} position={[0, H, -D / 2]}>
        <Ink size={[W, 0.14, D]} color={BROWN} position={[0, 0.07, D / 2]} />
        {[-0.55, 0.55].map((x) => (
          <group key={x}>
            <Ink size={[0.14, 0.02, D + 0.02]} color={BELT} position={[x, 0.15, D / 2]} ink={0.012} />
            <Ink size={[0.14, 0.16, 0.02]} color={BELT} position={[x, 0.07, D + 0.012]} ink={0.012} />
          </group>
        ))}
        {[[-1, 0], [1, 0], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <Ink key={`${sx}${sz}`} size={[0.13, 0.16, 0.13]} color={CAP} position={[(sx * W) / 2, 0.07, sz * D]} ink={0.02} />
        ))}
        <Ink shape="cyl" size={[0.17, 0.01]} color="#efe2bd" position={[-0.15, 0.15, 0.45]} ink={0.015} />
        <Ink shape="cyl" size={[0.1, 0.01]} color="#c0392b" position={[0.22, 0.155, 0.32]} ink={0.015} />
        <Ink size={[0.36, 0.01, 0.2]} color="#3d7ea6" position={[0.18, 0.155, 0.9]} rotation={[0, 0.3, 0]} ink={0.015} />
        <Ink size={[0.22, 0.01, 0.16]} color="#e6b84a" position={[-0.25, 0.155, 0.95]} rotation={[0, -0.25, 0]} ink={0.015} />
        <mesh position={[0, -0.003, D / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.14, D - 0.14]} />
          <meshToonMaterial color={LINING} />
        </mesh>
        <Cobweb position={[W / 2 - 0.08, -0.01, D - 0.08]} rotation={[-Math.PI / 2, 0, 0]} flip={[-1, 1, 1]} />
        <Cobweb position={[-W / 2 + 0.08, -0.01, D - 0.08]} rotation={[-Math.PI / 2, 0, 0]} />
        <Spider rotation={[Math.PI, 0, 0]} path={[[0.45, 0, -0.95], [0.8, 0, -0.55]]} speed={0.9} size={1.1} />
      </group>

      {/* cobwebs in the tray's back corners */}
      <Cobweb position={[-W / 2 + T, H - 0.02, -D / 2 + T + 0.01]} scale={0.9} flip={[1, -1, 1]} />
      <Cobweb position={[W / 2 - T, H - 0.02, -D / 2 + T + 0.01]} scale={0.9} flip={[-1, -1, 1]} />

      {/* ID cards leaning back in the tray, each with its strap folded on top */}
      {cards.map((c, i) => {
        const x = (i - (cards.length - 1) / 2) * 0.44
        const h = hover === c.id
        return (
          <group key={c.id} position={[x, 0.27 + (h ? 0.08 : 0), -0.24]} rotation={[-1.0, 0, (i % 2 ? 1 : -1) * 0.04]} scale={h ? 0.96 : 0.9}
            onClick={(e) => open && (e.stopPropagation(), onPick(c))}
            onPointerOver={(e) => open && (e.stopPropagation(), setHover(c.id))}
            onPointerOut={() => setHover(null)}>
            <Ink size={[0.46, 0.66, 0.02]} color="#f5f0e6" ink={0.02} />
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.44, 0.64]} />
              <meshBasicMaterial map={fronts[c.id]} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
      {cards.map((c, i) => (
        <group key={c.id} position={[(i - (cards.length - 1) / 2) * 0.44, T + 0.012, 0.2]}>
          {[[0, 0, 0.35], [0.03, 0.06, -0.35], [-0.01, 0.12, 0.3]].map(([px, pz, ry], k) => (
            <Ink key={k} size={[0.3, 0.012, 0.055]} color={c.color} position={[px, k * 0.014, pz]} rotation={[0, ry, 0]} ink={0.01} />
          ))}
        </group>
      ))}

      {/* spiders: one dangling from the lid, one over the front edge, one walking the back wall */}
      <group ref={spiders}>
        <Spider anchor={[-0.5, 1.12, -0.6]} len={0.45} />
        <Spider anchor={[0.82, H + 0.02, D / 2 + 0.07]} len={0.22} speed={1.3} phase={2} size={1} />
        <Spider path={[[0.15, H, -D / 2 + T / 2], [0.8, H, -D / 2 + T / 2]]} speed={0.7} phase={1} size={1} />
      </group>

      <Dust count={90} area={[W - 0.2, 1.2, D - 0.2]} position={[0, 0.7, 0]} size={0.02} opacity={open ? 0.8 : 0} speed={0.06} />
    </group>
  )
}
