import type * as THREE from 'three'

/**
 * Fade every material under `root` to `opacity` (0..1). Each material keeps
 * its own authored opacity as the baseline, so glass or decals that are
 * partly transparent stay that way at full strength.
 */
export function applyOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((node) => {
    const material = (node as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    for (const item of Array.isArray(material) ? material : [material]) {
      const data = item.userData as { baseOpacity?: number }
      if (typeof data.baseOpacity !== 'number') data.baseOpacity = item.opacity
      const base = data.baseOpacity
      item.opacity = base * opacity
      const transparent = base < 1 || opacity < 1
      if (item.transparent !== transparent) {
        // three.js compiles opaque materials with alpha forced to 1. Flipping
        // the flag needs a shader rebuild, or the fade has no visible effect.
        item.transparent = transparent
        item.needsUpdate = true
      }
    }
  })
}
