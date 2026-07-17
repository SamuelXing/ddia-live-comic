import { useEffect, useRef } from 'react'

/** Ambient hero animation: request dots flowing left→right through implied tiers. */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const x = c.getContext('2d')
    if (!x) return
    let w = 0
    let h = 0
    let raf = 0

    function size() {
      if (!c || !x) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = c.getBoundingClientRect()
      w = r.width
      h = r.height
      c.width = w * dpr
      c.height = h * dpr
      x.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const cols = [0.12, 0.34, 0.56, 0.78, 0.95]
    const colors = ['#3987e5', '#e6a72a', '#e5533b', '#9085e9', '#25b866']
    interface Dot {
      p: number
      lane: number
      c: string
      v: number
    }
    const dots: Dot[] = []
    let acc = 0
    let last = performance.now()

    function frame(t: number) {
      if (!x) return
      const dt = Math.min(50, t - last)
      last = t
      acc += dt
      while (acc > 90) {
        acc -= 90
        if (dots.length < 70)
          dots.push({
            p: 0,
            lane: Math.floor(Math.random() * 4),
            c: colors[Math.floor(Math.random() * colors.length)],
            v: 0.04 + Math.random() * 0.06,
          })
      }
      x.clearRect(0, 0, w, h)
      x.fillStyle = 'rgba(255,255,255,.04)'
      for (const cx of cols) {
        const nx = cx * w
        for (let ln = 0; ln < 4; ln++) {
          const ny = (0.22 + ln * 0.19) * h
          x.beginPath()
          x.roundRect(nx - 13, ny - 9, 26, 18, 5)
          x.fill()
        }
      }
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i]
        d.p += (d.v * dt) / 100
        if (d.p >= 1) {
          dots.splice(i, 1)
          continue
        }
        const seg = Math.min(cols.length - 2, Math.floor(d.p * (cols.length - 1)))
        const local = d.p * (cols.length - 1) - seg
        const x0 = cols[seg] * w
        const x1 = cols[seg + 1] * w
        const px = x0 + (x1 - x0) * local
        const py = (0.22 + d.lane * 0.19) * h + Math.sin(d.p * 6 + d.lane) * 4
        x.beginPath()
        x.arc(px, py, 2.6, 0, 7)
        x.fillStyle = d.c
        x.globalAlpha = 0.9
        x.fill()
        x.globalAlpha = 1
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [])

  return <canvas ref={ref} className="hero-canvas" />
}
