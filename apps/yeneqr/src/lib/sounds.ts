// ============================================================
// Yene QR — Sound Alert Utility
// ============================================================
// Uses Web Audio API to generate alert sounds without external
// audio files. Works on all modern browsers.
//
// Usage:
//   import { playNewOrderSound, playOrderReadySound, playUrgentSound } from '@/lib/sounds'
//   playNewOrderSound()

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Play a pleasant two-tone chime when a new order arrives.
 */
export function playNewOrderSound() {
  try {
    const ctx = getAudioContext()

    // First tone — A5
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 880
    gain1.gain.value = 0.3
    osc1.start(ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc1.stop(ctx.currentTime + 0.3)

    // Second tone — C#6 (slightly delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 1100
    gain2.gain.value = 0.3
    osc2.start(ctx.currentTime + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc2.stop(ctx.currentTime + 0.5)
  } catch {
    // Silently fail — audio not critical
  }
}

/**
 * Play three ascending tones when an order is marked ready.
 */
export function playOrderReadySound() {
  try {
    const ctx = getAudioContext()

    ;[660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.value = 0.2
      osc.start(ctx.currentTime + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.2)
      osc.stop(ctx.currentTime + i * 0.12 + 0.2)
    })
  } catch {
    // Silently fail
  }
}

/**
 * Play repeated beeps for urgent/overdue items.
 * More alarming tone to grab attention.
 */
export function playUrgentSound() {
  try {
    const ctx = getAudioContext()

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 700
      osc.type = 'square'
      gain.gain.value = 0.15
      osc.start(ctx.currentTime + i * 0.2)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15)
      osc.stop(ctx.currentTime + i * 0.2 + 0.15)
    }
  } catch {
    // Silently fail
  }
}

/**
 * Play a gentle reminder chime for unaccepted orders.
 * Two soft ascending tones — less aggressive than urgent, but noticeable.
 */
export function playReminderSound() {
  try {
    const ctx = getAudioContext()

    // First gentle tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 520
    osc1.type = 'sine'
    gain1.gain.value = 0.25
    osc1.start(ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc1.stop(ctx.currentTime + 0.3)

    // Second slightly higher tone
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 660
    osc2.type = 'sine'
    gain2.gain.value = 0.25
    osc2.start(ctx.currentTime + 0.35)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65)
    osc2.stop(ctx.currentTime + 0.65)

    // Repeat pair once more after a brief pause
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.connect(gain3)
    gain3.connect(ctx.destination)
    osc3.frequency.value = 520
    osc3.type = 'sine'
    gain3.gain.value = 0.25
    osc3.start(ctx.currentTime + 0.8)
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.1)
    osc3.stop(ctx.currentTime + 1.1)

    const osc4 = ctx.createOscillator()
    const gain4 = ctx.createGain()
    osc4.connect(gain4)
    gain4.connect(ctx.destination)
    osc4.frequency.value = 660
    osc4.type = 'sine'
    gain4.gain.value = 0.25
    osc4.start(ctx.currentTime + 1.15)
    gain4.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.45)
    osc4.stop(ctx.currentTime + 1.45)
  } catch {
    // Silently fail
  }
}
