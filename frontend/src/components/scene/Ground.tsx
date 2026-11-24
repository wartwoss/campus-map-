import { useMemo } from 'react'
import * as THREE from 'three'
import type { CampusData, CampusPath } from '../../types'
import { flatGeometry, type SceneColors } from './shared'
import { buildInstances, hash01, MODEL_URLS, useMonochromeModelParts, type InstanceSpec } from './assets'

/**
 * A ribbon builder with mitered joins. Every path is tessellated along its
 * centreline so turns remain continuous instead of leaving wedge-shaped gaps.
 */
function ribbonGeometry(paths: CampusPath[], y: number, widthScale = 1): THREE.BufferGeometry {
  const positions: number[] = []

  for (const path of paths) {
    const points = path.points
    if (points.length < 2) continue
    const half = Math.max(0.45, path.width * widthScale / 2)
    const normals: [number, number][] = []
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0]
      const dz = points[i][1] - points[i - 1][1]
      const length = Math.hypot(dx, dz)
      normals.push(length < 1e-4 ? [0, 0] : [-dz / length, dx / length])
    }

    const left: [number, number][] = []
    const right: [number, number][] = []
    for (let i = 0; i < points.length; i++) {
      let nx: number
      let nz: number
      let miter = half
      if (i === 0) {
        ;[nx, nz] = normals[0]
      } else if (i === points.length - 1) {
        ;[nx, nz] = normals.at(-1)!
      } else {
        const before = normals[i - 1]
        const after = normals[i]
        nx = before[0] + after[0]
        nz = before[1] + after[1]
        const length = Math.hypot(nx, nz)
        if (length < 1e-4) {
          ;[nx, nz] = after
        } else {
          nx /= length
          nz /= length
          const projection = Math.abs(nx * after[0] + nz * after[1])
          miter = Math.min(half / Math.max(projection, 0.35), half * 2.5)
        }
      }
      const [x, z] = points[i]
      left.push([x + nx * miter, z + nz * miter])
      right.push([x - nx * miter, z - nz * miter])
    }

    for (let i = 1; i < points.length; i++) {
      const corners = [left[i - 1], right[i - 1], left[i], right[i]]
      // Reverse winding so the surface normal points up toward the camera.
      for (const index of [0, 2, 1, 2, 3, 1]) {
        const [x, z] = corners[index]
        positions.push(x, y, z)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function Trees({ data, colors }: { data: CampusData; colors: SceneColors }) {
  const species = [
    useMonochromeModelParts(MODEL_URLS.treeOak, colors.tree),
    useMonochromeModelParts(MODEL_URLS.treePine, colors.buildingLine),
    useMonochromeModelParts(MODEL_URLS.treeRound, colors.inactive),
  ]

  const trees = useMemo(() => {
    const perSpecies: InstanceSpec[][] = [[], [], []]
    for (const [x, z] of data.campus.features.trees) {
      const index = Math.floor(hash01(x, z, 1) * perSpecies.length)
      const scale = 1.8 + hash01(x, z, 2) * 1.2
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(x, z, 3) * Math.PI * 2),
        new THREE.Vector3(scale, scale, scale),
      )
      perSpecies[index].push({ matrix })
    }
    return species.flatMap((parts, index) => buildInstances(parts, perSpecies[index]))
    // Models are stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <group>
      {trees.map((mesh, index) => <primitive key={index} object={mesh} />)}
    </group>
  )
}

function GroundSurfaces({ data, colors }: { data: CampusData; colors: SceneColors }) {
  const lawnGeometry = useMemo(() => flatGeometry(data.campus.features.boundary.ring), [data])
  const roads = useMemo(
    () => ribbonGeometry(data.campus.features.paths.filter((path) => path.kind === 'road'), 0.065),
    [data],
  )
  const walkways = useMemo(
    () => ribbonGeometry(data.campus.features.paths.filter((path) => path.kind === 'walkway'), 0.09, 1.08),
    [data],
  )
  const sidewalks = useMemo(
    () => ribbonGeometry(data.campus.features.paths.filter((path) => path.kind === 'sidewalk'), 0.11, 1.08),
    [data],
  )

  return (
    <group>
      <mesh geometry={lawnGeometry} position={[0, 0.02, 0]} receiveShadow>
        <meshLambertMaterial color={colors.lawn} />
      </mesh>
      <mesh geometry={roads} receiveShadow>
        <meshLambertMaterial color={colors.pathLine} />
      </mesh>
      <mesh geometry={walkways} receiveShadow>
        <meshLambertMaterial color={colors.path} />
      </mesh>
      <mesh geometry={sidewalks} receiveShadow>
        <meshLambertMaterial color={colors.lineStrong} />
      </mesh>
      <Trees data={data} colors={colors} />
    </group>
  )
}

export default function Ground({ data, colors }: { data: CampusData; colors: SceneColors }) {
  return <GroundSurfaces data={data} colors={colors} />
}
