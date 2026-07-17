import { useEffect, useRef } from 'react'

/** Tiny animated topology thumbnail for a gallery card. */
export default function ThumbCanvas({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const x = cv.getContext('2d')
    if (!x) return
    let raf = 0
    let w = 0
    let h = 0

    function size() {
      if (!cv || !x) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = cv.getBoundingClientRect()
      w = r.width
      h = r.height
      cv.width = r.width * dpr
      cv.height = r.height * dpr
      x.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()

    const dots = Array.from({ length: 14 }, () => ({
      p: Math.random(),
      v: 0.15 + Math.random() * 0.25,
    }))
    const nodes = [0.2, 0.5, 0.8]
    let last = performance.now()

    function frame(t: number) {
      if (!cv || !cv.isConnected || !x) return
      const dt = Math.min(50, t - last)
      last = t
      x.clearRect(0, 0, w, h)
      x.strokeStyle = 'rgba(255,255,255,.08)'
      x.lineWidth = 1
      x.beginPath()
      x.moveTo(0.06 * w, 0.5 * h)
      x.lineTo(0.94 * w, 0.5 * h)
      x.stroke()
      nodes.forEach((n, i) => {
        x.fillStyle = i === 2 ? accent : 'rgba(255,255,255,.12)'
        x.beginPath()
        x.arc(n * w, 0.5 * h, i === 2 ? 9 : 7, 0, 7)
        x.fill()
        if (i === 2) {
          x.strokeStyle = accent
          x.globalAlpha = 0.5
          x.beginPath()
          x.arc(n * w, 0.5 * h, 9, 0, 7)
          x.stroke()
          x.globalAlpha = 1
        }
      })
      dots.forEach((d) => {
        d.p += (d.v * dt) / 1000
        if (d.p > 1) d.p = 0
        const px = (0.06 + d.p * 0.88) * w
        const py = 0.5 * h + Math.sin(d.p * 8) * 7
        x.fillStyle = accent
        x.globalAlpha = 0.85
        x.beginPath()
        x.arc(px, py, 2.2, 0, 7)
        x.fill()
        x.globalAlpha = 1
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [accent])

  return <canvas ref={ref} />
}
