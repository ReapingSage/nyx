import { useRef, useEffect } from 'react'

/**
 * Background — animated space/nebula canvas behind everything.
 * Renders soft floating particles and volumetric purple glow.
 */
export default function Background() {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Generate stable floating particles
    let seed = 777
    const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    const particles = Array.from({ length: 80 }, () => ({
      x: r(), y: r(),
      vx: (r() - 0.5) * 0.00015,
      vy: (r() - 0.5) * 0.00008,
      radius: 0.3 + r() * 1.2,
      opacity: 0.05 + r() * 0.25,
      color: r() > 0.6 ? '167,139,250' : r() > 0.3 ? '124,58,237' : '200,190,255',
    }))

    let t = 0
    const draw = () => {
      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      t += 0.008

      ctx.clearRect(0, 0, W, H)

      // Deep space gradient
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75)
      bg.addColorStop(0,   '#0d0818')
      bg.addColorStop(0.4, '#080610')
      bg.addColorStop(1,   '#05050f')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Volumetric purple bloom — top center
      const bloom1 = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, W * 0.4)
      bloom1.addColorStop(0, `rgba(109,40,217,${0.06 + 0.02 * Math.sin(t)})`)
      bloom1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bloom1
      ctx.fillRect(0, 0, W, H)

      // Secondary bloom — bottom left
      const bloom2 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, W * 0.3)
      bloom2.addColorStop(0, `rgba(76,29,149,${0.04 + 0.015 * Math.sin(t * 0.7)})`)
      bloom2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bloom2
      ctx.fillRect(0, 0, W, H)

      // Floating ambient particles
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = 1
        if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1
        if (p.y > 1) p.y = 0

        ctx.fillStyle = `rgba(${p.color},${p.opacity})`
        ctx.beginPath()
        ctx.arc(p.x * W, p.y * H, p.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}