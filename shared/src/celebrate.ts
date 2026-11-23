/**
 * A short burst of sparks in the brand's reds when a gig is settled (23 November 2026, Colly): the larger one on a
 * freelancer's own page when they say yes to a gig, a small one on the office's side when it confirms someone's yes.
 * Only ever over the page: a canvas laid over everything that takes no presses, gone once the last spark fades, and
 * nothing at all where the person has asked for less motion, since the words beside it already say what happened.
 *
 * It's one self-contained function, with nothing from outside it, so the server can put its own source into the
 * freelancer's page as it is (server/src/crew/page.ts) and the app can call it directly (web/src/celebrate.ts): the
 * same sparks on both sides. Kept to plain functions and `var`, which every phone still in use runs.
 */
export function sparks(x: number, y: number, size: 'big' | 'small'): void {
  var win = window
  if (!win.requestAnimationFrame || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  var doc = document
  var canvas = doc.createElement('canvas')
  var ctx = canvas.getContext('2d')
  if (!ctx) return
  var ratio = Math.min(win.devicePixelRatio || 1, 2)
  var width = win.innerWidth
  var height = win.innerHeight
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000'
  doc.body.appendChild(canvas)
  ctx.scale(ratio, ratio)
  // The brand red, a lighter and a deeper one, and a fleck of the page's own ink so it reads on light and dark alike.
  var ink = (getComputedStyle(doc.body).color || '').trim() || '#ffffff'
  var colours = ['#ee3744', '#ee3744', '#f47a83', '#c41f2c', ink]
  var big = size === 'big'
  type Spark = { x: number; y: number; vx: number; vy: number; r: number; c: string; born: number; life: number; trail: boolean }
  var list: Spark[] = []
  var burst = function (cx: number, cy: number, count: number, speed: number, at: number, up: number) {
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
      var v = speed * (0.45 + Math.random() * 0.55)
      list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - up,
        r: (big ? 1.6 : 1.2) + Math.random() * (big ? 1.8 : 1.2),
        c: colours[Math.floor(Math.random() * colours.length)]!,
        born: at,
        life: (big ? 1300 : 700) + Math.random() * (big ? 700 : 300),
        trail: Math.random() < 0.5,
      })
    }
  }
  var clampX = function (n: number) {
    return Math.max(24, Math.min(width - 24, n))
  }
  var clampY = function (n: number) {
    return Math.max(24, Math.min(height - 24, n))
  }
  if (big) {
    // Three shells: one from where the words are, then one either side, higher up, a moment apart.
    burst(clampX(x), clampY(y), 72, 8, 0, 1.5)
    burst(clampX(x - Math.min(140, width * 0.28)), clampY(y - 150), 56, 7, 260, 1)
    burst(clampX(x + Math.min(140, width * 0.28)), clampY(y - 110), 56, 7, 520, 1)
  } else burst(clampX(x), clampY(y), 22, 3.6, 0, 1.6)
  var start = 0
  var last = 0
  var frame = function (now: number) {
    if (!start) start = last = now
    var t = now - start
    // Each frame moves as if at 60 a second, whatever the screen's rate, so a fast screen doesn't make faster sparks.
    var step = Math.min(now - last, 50) / 16.7
    last = now
    ctx!.clearRect(0, 0, width, height)
    var alive = 0
    for (var i = 0; i < list.length; i++) {
      var s = list[i]!
      var age = t - s.born
      if (age < 0) {
        alive++
        continue
      }
      if (age > s.life) continue
      alive++
      s.vx *= Math.pow(0.95, step)
      s.vy = s.vy * Math.pow(0.95, step) + (big ? 0.09 : 0.07) * step
      var px = s.x
      var py = s.y
      s.x += s.vx * step
      s.y += s.vy * step
      var fade = 1 - age / s.life
      ctx!.globalAlpha = fade * fade
      ctx!.fillStyle = s.c
      ctx!.strokeStyle = s.c
      if (s.trail) {
        ctx!.lineWidth = s.r
        ctx!.lineCap = 'round'
        ctx!.beginPath()
        ctx!.moveTo(px - s.vx * 2, py - s.vy * 2)
        ctx!.lineTo(s.x, s.y)
        ctx!.stroke()
      } else {
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx!.fill()
      }
    }
    if (alive && t < 3000) win.requestAnimationFrame(frame)
    else canvas.remove()
  }
  win.requestAnimationFrame(frame)
}
