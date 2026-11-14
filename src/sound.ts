// Small sounds, made by the browser's own synthesiser: there are no sound files to download.
// Every sound is a few notes. If the browser cannot play sound, the game simply stays quiet.

export type SoundName = 'click' | 'on' | 'off' | 'assign' | 'start' | 'alert' | 'storm' | 'good' | 'bad' | 'star' | 'evening'

let audio: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('muted') === '1'
} catch {
  // Private browsing can forbid this. The sound just starts switched on.
}
let lastTick = 0

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem('muted', value ? '1' : '0')
  } catch {
    // Not remembered next time: that is fine.
  }
}

/** One note: it starts at `from` hertz, may slide to `to`, and fades out. */
function note(ctx: AudioContext, at: number, length: number, from: number, to: number, shape: OscillatorType, loud: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = shape
  osc.frequency.setValueAtTime(from, at)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(loud, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

/** A rush of noise, for the storm. */
function rush(ctx: AudioContext, at: number, length: number, loud: number) {
  const frames = Math.floor(ctx.sampleRate * length)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(300, at)
  filter.frequency.linearRampToValueAtTime(1400, at + length * 0.4)
  filter.frequency.linearRampToValueAtTime(250, at + length)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(loud, at + length * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(at)
}

export function play(name: SoundName) {
  if (muted) return
  try {
    audio ??= new AudioContext()
    const ctx = audio
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    // The little ticks for each thing that happens can come in a burst: keep them apart.
    if (name === 'good' || name === 'bad') {
      if (now - lastTick < 0.12) return
      lastTick = now
    }
    switch (name) {
      case 'click':
        note(ctx, now, 0.06, 620, 620, 'triangle', 0.05)
        break
      case 'on':
        note(ctx, now, 0.09, 440, 660, 'triangle', 0.07)
        break
      case 'off':
        note(ctx, now, 0.09, 520, 330, 'triangle', 0.06)
        break
      case 'assign':
        note(ctx, now, 0.07, 520, 520, 'sine', 0.07)
        note(ctx, now + 0.07, 0.1, 780, 780, 'sine', 0.07)
        break
      case 'start':
        ;[392, 494, 587].forEach((f, i) => note(ctx, now + i * 0.09, 0.16, f, f, 'triangle', 0.08))
        break
      case 'alert':
        for (let i = 0; i < 3; i++) note(ctx, now + i * 0.32, 0.26, 660, 990, 'square', 0.045)
        break
      case 'storm':
        rush(ctx, now, 3.2, 0.16)
        note(ctx, now, 1.6, 70, 45, 'sawtooth', 0.06)
        break
      case 'good':
        note(ctx, now, 0.12, 880, 1175, 'sine', 0.05)
        break
      case 'bad':
        note(ctx, now, 0.2, 220, 150, 'triangle', 0.08)
        break
      case 'star':
        ;[523, 659, 784, 1047].forEach((f, i) => note(ctx, now + i * 0.11, 0.3, f, f, 'triangle', 0.09))
        break
      case 'evening':
        note(ctx, now, 0.5, 523, 523, 'sine', 0.05)
        note(ctx, now + 0.18, 0.6, 392, 392, 'sine', 0.05)
        break
    }
  } catch {
    // No sound is fine.
  }
}
