import * as THREE from 'three'

export const GREEN = '#1f8a63'

// The ID cards. First one is the current job; the rest live in the suitcase.
// color: strap + folded strap, accent: text on the white card, text: lettering on the strap
export const CARDS = [
  { id: 'binocs-swe', company: 'Binocs', logo: true, color: GREEN, role: 'Software Engineer I', period: 'JUL 2026 – PRESENT' },
  { id: 'binocs-intern', company: 'Binocs', logo: true, color: GREEN, role: 'Software Engineering Intern', period: 'DEC 2025 – JUN 2026', old: true },
  { id: 'commitai', company: 'CommitAI', color: '#f4a52a', accent: '#d9770f', text: '#3a2200', role: 'Founding Software Engineer', period: 'MAY 2025 – SEP 2025', old: true },
  { id: 'kumars', company: "Kumar's Innovations", color: '#f7b8cb', accent: '#c2457a', text: '#7a2e4a', role: 'Software Development Intern', period: 'DEC 2024 – JAN 2025', old: true },
  { id: 'iiit', company: 'IIIT Sri City Labs', color: '#2f6fd6', role: 'Research Intern', period: 'JAN 2024 – DEC 2024', old: true },
]

const logo = new Image()
logo.src = import.meta.env.BASE_URL + 'binocs.jpg'
const logoReady = new Promise((r) => (logo.onload = r))

// logo -> white on transparent (alpha from how far each pixel is from white)
function whiteLogo() {
  const l = document.createElement('canvas')
  l.width = l.height = 64
  const g = l.getContext('2d')
  g.drawImage(logo, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64)
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i + 3] = 255 - Math.min(d.data[i], d.data[i + 1], d.data[i + 2])
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255
  }
  g.putImageData(d, 0, 0)
  return l
}

// shrink the font until the text fits
function fit(g, text, maxW, px, weight, family) {
  for (; px > 10; px--) {
    g.font = `${weight} ${px}px ${family}`
    if (g.measureText(text).width <= maxW) break
  }
}

// yellowed, speckled, dirtier toward the bottom
function dust(g, x, y, w, h) {
  g.fillStyle = 'rgba(140,100,45,0.2)'
  g.fillRect(x, y, w, h)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(90,65,30,${Math.random() * 0.25})`
    g.beginPath()
    g.arc(x + Math.random() * w, y + Math.random() * h, Math.random() * 2.5 + 0.5, 0, 7)
    g.fill()
  }
  const gr = g.createLinearGradient(0, y + h * 0.5, 0, y + h)
  gr.addColorStop(0, 'rgba(120,90,50,0)')
  gr.addColorStop(1, 'rgba(120,90,50,0.25)')
  g.fillStyle = gr
  g.fillRect(x, y, w, h)
}

function drawFront(g, d) {
  const accent = d.accent ?? d.color
  g.letterSpacing = '4px'
  g.textBaseline = 'middle'
  g.fillStyle = accent
  if (d.logo) {
    g.drawImage(logo, 24, 24, 80, 80)
    g.font = '700 30px monospace'
    g.fillText('BINOCS', 108, 64)
  } else {
    fit(g, d.company.toUpperCase(), 450, 30, 700, 'monospace')
    g.fillText(d.company.toUpperCase(), 32, 64)
  }
  g.letterSpacing = '0px'
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#888'
  g.font = '22px monospace'
  g.fillText('NAME', 40, 520)
  g.fillStyle = '#111'
  g.font = '600 40px sans-serif'
  g.fillText('Abhiram', 40, 568)
  g.fillText('Kothagundu', 40, 614)
  g.fillStyle = '#888'
  g.font = '22px monospace'
  g.fillText('ROLE', 40, 660)
  g.fillStyle = accent
  fit(g, d.role, 440, 32, 600, 'sans-serif')
  g.fillText(d.role, 40, 698)
  g.fillStyle = '#888'
  g.font = '20px monospace'
  g.fillText(d.period, 40, 742)
}

// frontOnly: a 512x770 texture of just the front (for cards lying in the suitcase).
// Otherwise the full 1024 sheet in the GLB card's UV layout (front = left half, back = right half).
export function makeCard(d, frontOnly = false) {
  const c = document.createElement('canvas')
  c.width = frontOnly ? 512 : 1024
  c.height = frontOnly ? 770 : 1024
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  t.flipY = frontOnly
  logoReady.then(() => {
    drawFront(g, d)
    if (!frontOnly) {
      if (d.logo) g.drawImage(logo, 612, 235, 300, 300)
      else {
        g.fillStyle = d.accent ?? d.color
        g.textAlign = 'center'
        fit(g, d.company.toUpperCase(), 440, 40, 700, 'monospace')
        g.fillText(d.company.toUpperCase(), 768, 385)
      }
    }
    if (d.old) dust(g, 0, 0, c.width, frontOnly ? 770 : 1024)
    t.needsUpdate = true
  })
  return t
}

// Strap tile: 512x195 matches the on-screen tile shape so nothing is squished
export function makeStrap(d) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 195
  const g = c.getContext('2d')
  g.fillStyle = d.color
  g.fillRect(0, 0, 512, 195)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  logoReady.then(() => {
    g.fillStyle = d.text ?? '#fff'
    g.textBaseline = 'middle'
    g.letterSpacing = '4px'
    if (d.logo) {
      g.drawImage(whiteLogo(), 128, 66, 64, 64)
      g.font = '700 40px monospace'
      g.fillText('BINOCS', 216, 100)
    } else {
      g.textAlign = 'center'
      fit(g, d.company.toUpperCase(), 440, 40, 700, 'monospace')
      g.fillText(d.company.toUpperCase(), 256, 100)
    }
    if (d.old) dust(g, 0, 0, 512, 195)
    t.needsUpdate = true
  })
  return t
}
