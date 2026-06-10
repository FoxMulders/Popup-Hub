'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface LayoutSpringPose {
  x: number
  y: number
  rotation: number
}

export interface LayoutSpringTarget {
  id: string
  from: LayoutSpringPose
  to: LayoutSpringPose
}

export interface LayoutSpringOptions {
  /** Spring stiffness (default 180). */
  stiffness?: number
  /** Damping ratio (default 22). */
  damping?: number
  /** Stop when all channels settle below this delta (default 0.02 ft). */
  precision?: number
  /** Called once when every target has settled at its destination. */
  onComplete?: () => void
}

interface SpringChannel {
  value: number
  velocity: number
  target: number
}

interface ActiveSpring {
  id: string
  x: SpringChannel
  y: SpringChannel
  rotation: SpringChannel
}

function springChannel(
  current: number,
  target: number,
  velocity: number,
  stiffness: number,
  damping: number,
  dt: number
): { value: number; velocity: number } {
  const force = -stiffness * (current - target) - damping * velocity
  const nextVelocity = velocity + force * dt
  const nextValue = current + nextVelocity * dt
  return { value: nextValue, velocity: nextVelocity }
}

function channelSettled(
  channel: SpringChannel,
  precision: number
): boolean {
  return (
    Math.abs(channel.value - channel.target) < precision &&
    Math.abs(channel.velocity) < precision * 4
  )
}

/**
 * Animate booth layout transitions with a damped spring (requestAnimationFrame).
 * Returns interpolated poses keyed by object id while animating.
 */
export function useLayoutSpringAnimation() {
  const [poses, setPoses] = useState<Map<string, LayoutSpringPose> | null>(null)
  const springsRef = useRef<ActiveSpring[]>([])
  const rafRef = useRef<number | null>(null)
  const onCompleteRef = useRef<(() => void) | undefined>(undefined)
  const optionsRef = useRef<Required<
    Pick<LayoutSpringOptions, 'stiffness' | 'damping' | 'precision'>
  >>({
    stiffness: 180,
    damping: 22,
    precision: 0.02,
  })

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    springsRef.current = []
    setPoses(null)
  }, [])

  const tick = useCallback(() => {
    const springs = springsRef.current
    if (springs.length === 0) {
      setPoses(null)
      rafRef.current = null
      return
    }

    const { stiffness, damping, precision } = optionsRef.current
    const dt = 1 / 60
    let allSettled = true
    const next = new Map<string, LayoutSpringPose>()

    for (const spring of springs) {
      spring.x = {
        ...spring.x,
        ...springChannel(
          spring.x.value,
          spring.x.target,
          spring.x.velocity,
          stiffness,
          damping,
          dt
        ),
      }
      spring.y = {
        ...spring.y,
        ...springChannel(
          spring.y.value,
          spring.y.target,
          spring.y.velocity,
          stiffness,
          damping,
          dt
        ),
      }
      spring.rotation = {
        ...spring.rotation,
        ...springChannel(
          spring.rotation.value,
          spring.rotation.target,
          spring.rotation.velocity,
          stiffness * 0.85,
          damping,
          dt
        ),
      }

      if (
        !channelSettled(spring.x, precision) ||
        !channelSettled(spring.y, precision) ||
        !channelSettled(spring.rotation, precision * 2)
      ) {
        allSettled = false
      }

      next.set(spring.id, {
        x: spring.x.value,
        y: spring.y.value,
        rotation: spring.rotation.value,
      })
    }

    setPoses(next)

    if (allSettled) {
      springsRef.current = []
      rafRef.current = null
      setPoses(null)
      onCompleteRef.current?.()
      onCompleteRef.current = undefined
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const startAnimation = useCallback(
    (targets: LayoutSpringTarget[], options: LayoutSpringOptions = {}) => {
      stop()
      if (targets.length === 0) {
        options.onComplete?.()
        return
      }

      optionsRef.current = {
        stiffness: options.stiffness ?? 180,
        damping: options.damping ?? 22,
        precision: options.precision ?? 0.02,
      }
      onCompleteRef.current = options.onComplete

      springsRef.current = targets.map((t) => ({
        id: t.id,
        x: { value: t.from.x, velocity: 0, target: t.to.x },
        y: { value: t.from.y, velocity: 0, target: t.to.y },
        rotation: {
          value: t.from.rotation,
          velocity: 0,
          target: t.to.rotation,
        },
      }))

      const initial = new Map<string, LayoutSpringPose>()
      for (const t of targets) {
        initial.set(t.id, { ...t.from })
      }
      setPoses(initial)
      rafRef.current = requestAnimationFrame(tick)
    },
    [stop, tick]
  )

  useEffect(() => () => stop(), [stop])

  return {
    layoutSpringPoses: poses,
    isLayoutSpringActive: poses != null,
    startLayoutSpring: startAnimation,
    stopLayoutSpring: stop,
  }
}

/**
 * Build spring targets from booth positions before/after auto-arrange.
 */
export function layoutSpringTargetsFromBooths<
  T extends { id: string; x: number; y: number; rotation?: number },
>(
  before: ReadonlyArray<T>,
  after: ReadonlyArray<T>
): LayoutSpringTarget[] {
  const beforeById = new Map(before.map((b) => [b.id, b]))
  const targets: LayoutSpringTarget[] = []

  for (const next of after) {
    const prev = beforeById.get(next.id)
    if (!prev) continue
    if (
      Math.abs(prev.x - next.x) < 0.01 &&
      Math.abs(prev.y - next.y) < 0.01 &&
      Math.abs((prev.rotation ?? 0) - (next.rotation ?? 0)) < 0.5
    ) {
      continue
    }
    targets.push({
      id: next.id,
      from: {
        x: prev.x,
        y: prev.y,
        rotation: prev.rotation ?? 0,
      },
      to: {
        x: next.x,
        y: next.y,
        rotation: next.rotation ?? 0,
      },
    })
  }

  return targets
}
