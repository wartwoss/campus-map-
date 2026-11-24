import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

/**
 * Served asset paths. Only the tree meshes are still used by the two-building
 * map; everything is CC0 (see public/assets/manifest.json).
 */
const KENNEY = '/assets/models/kenney'

export const MODEL_URLS = {
  treeRound: `${KENNEY}/nature-kit/tree_default.glb`,
  treeOak: `${KENNEY}/nature-kit/tree_oak.glb`,
  treePine: `${KENNEY}/nature-kit/tree_pineRoundA.glb`,
  treeFat: `${KENNEY}/nature-kit/tree_fat.glb`,
} as const

Object.values(MODEL_URLS).forEach((url) => useGLTF.preload(url))

export interface MeshPart {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** Transform of this mesh relative to the model's root. */
  matrix: THREE.Matrix4
}

/** Flattens a loaded GLB into its mesh parts, keeping their local transforms. */
export function meshParts(root: THREE.Object3D): MeshPart[] {
  root.updateMatrixWorld(true)
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const parts: MeshPart[] = []
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    parts.push({
      geometry: mesh.geometry,
      material,
      matrix: new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld),
    })
  })
  return parts
}

export interface InstanceSpec {
  /** Placement matrix for the whole model. */
  matrix: THREE.Matrix4
  /** Optional per-instance colour multiplied with the material. */
  color?: THREE.Color
}

/**
 * Builds one InstancedMesh per mesh part of a model, all sharing the same
 * placement list. Returns the meshes ready to be mounted with <primitive>.
 */
export function buildInstances(parts: MeshPart[], specs: InstanceSpec[]): THREE.InstancedMesh[] {
  return parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, specs.length)
    const local = new THREE.Matrix4()
    specs.forEach((spec, index) => {
      local.multiplyMatrices(spec.matrix, part.matrix)
      mesh.setMatrixAt(index, local)
      if (spec.color) mesh.setColorAt(index, spec.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  })
}

/** Stable pseudo-random number in [0, 1) from campus coordinates. */
export function hash01(x: number, y: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

export function useModelParts(url: string): MeshPart[] {
  const gltf = useGLTF(url)
  return useMemo(() => meshParts(gltf.scene), [gltf])
}

/** Clone an asset's materials into a flat grayscale palette for this exterior. */
export function useMonochromeModelParts(url: string, color = '#d0d0d0'): MeshPart[] {
  const source = useModelParts(url)
  const parts = useMemo(
    () =>
      source.map((part) => {
        const material = part.material.clone() as THREE.MeshStandardMaterial
        material.color.set(color)
        material.map = null
        material.vertexColors = false
        material.emissive.set('#000000')
        material.emissiveMap = null
        material.roughness = 0.92
        material.metalness = 0
        return { ...part, material }
      }),
    [source, color],
  )

  usePartsCleanup(parts)

  return parts
}

function usePartsCleanup(parts: MeshPart[]) {
  useEffect(
    () => () => {
      for (const part of parts) part.material.dispose()
    },
    [parts],
  )
}
