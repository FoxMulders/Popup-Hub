import type { CSSProperties } from 'react'
import Dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { RoomFlowPattern, RoomSkeleton, RoomZone } from '@/lib/experience-designer/types'

export interface ZoneNodeData extends Record<string, unknown> {
  label: string
  zoneType: RoomZone['zoneType']
  hasPuzzle: boolean
  puzzleTitle?: string
}

const ZONE_TYPE_COLORS: Record<RoomZone['zoneType'], string> = {
  entry: '#4ade80',
  corridor: '#94a3b8',
  puzzle: '#38bdf8',
  climax: '#f472b6',
  utility: '#a78bfa',
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 88

export function zoneNodeStyle(zoneType: RoomZone['zoneType']): CSSProperties {
  return {
    borderColor: ZONE_TYPE_COLORS[zoneType],
    boxShadow: `0 0 0 1px ${ZONE_TYPE_COLORS[zoneType]}40, 0 8px 24px rgba(0,0,0,0.35)`,
  }
}

function horizontalFallbackPosition(index: number): { x: number; y: number } {
  return { x: index * 250, y: 100 }
}

function gridFallbackPosition(
  index: number,
  total: number,
  flowPattern?: RoomFlowPattern
): { x: number; y: number } {
  if (flowPattern === 'nonlinear_open') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(total)))
    return {
      x: 40 + (index % cols) * 260,
      y: 40 + Math.floor(index / cols) * 160,
    }
  }
  if (flowPattern === 'multilinear') {
    return { x: 40 + index * 220, y: index % 2 === 0 ? 60 : 180 }
  }
  return horizontalFallbackPosition(index)
}

function layoutNodesWithDagre(
  nodes: Node<ZoneNodeData>[],
  edges: Edge[],
  flowPattern?: RoomFlowPattern
): Node<ZoneNodeData>[] {
  if (nodes.length === 0) return nodes

  try {
    const graph = new Dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({
      rankdir: flowPattern === 'nonlinear_open' ? 'TB' : 'LR',
      nodesep: 72,
      ranksep: flowPattern === 'multilinear' ? 96 : 120,
      marginx: 24,
      marginy: 24,
    })

    nodes.forEach((node) => {
      graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    })
    edges.forEach((edge) => {
      graph.setEdge(edge.source, edge.target)
    })

    Dagre.layout(graph)

    return nodes.map((node, index) => {
      const layout = graph.node(node.id) as { x: number; y: number } | undefined
      if (!layout) {
        return {
          ...node,
          position: gridFallbackPosition(index, nodes.length, flowPattern),
        }
      }
      return {
        ...node,
        position: {
          x: layout.x - NODE_WIDTH / 2,
          y: layout.y - NODE_HEIGHT / 2,
        },
      }
    })
  } catch {
    return nodes.map((node, index) => ({
      ...node,
      position: gridFallbackPosition(index, nodes.length, flowPattern),
    }))
  }
}

/** Map a room skeleton to React Flow nodes and edges with dagre auto-layout. */
export function mapSkeletonToFlow(skeleton: RoomSkeleton | null): {
  nodes: Node<ZoneNodeData>[]
  edges: Edge[]
} {
  return roomSkeletonToFlow(skeleton)
}

export function roomSkeletonToFlow(skeleton: RoomSkeleton | null): {
  nodes: Node<ZoneNodeData>[]
  edges: Edge[]
} {
  if (!skeleton?.zones.length) {
    return { nodes: [], edges: [] }
  }

  const nodes: Node<ZoneNodeData>[] = skeleton.zones.map((zone) => ({
    id: zone.id,
    type: 'zone',
    position: zone.position,
    data: {
      label: zone.name,
      zoneType: zone.zoneType,
      hasPuzzle: Boolean(zone.puzzleTitle),
      puzzleTitle: zone.puzzleTitle,
    },
  }))

  const edges: Edge[] = skeleton.connections.map((connection) => ({
    id: connection.id,
    source: connection.fromZoneId,
    target: connection.toZoneId,
    label: connection.label,
    animated: true,
    style: { stroke: '#64748b' },
  }))

  const needsLayout = nodes.every(
    (node) => node.position.x === 0 && node.position.y === 0
  )

  const laidOut = needsLayout
    ? layoutNodesWithDagre(nodes, edges, skeleton.flowPattern)
    : nodes.map((node, index) =>
        node.position.x === 0 && node.position.y === 0
          ? {
              ...node,
              position: gridFallbackPosition(index, nodes.length, skeleton.flowPattern),
            }
          : node
      )

  return { nodes: laidOut, edges }
}

export function findZoneById(
  skeleton: RoomSkeleton | null,
  zoneId: string | null
): RoomZone | null {
  if (!skeleton || !zoneId) return null
  return skeleton.zones.find((zone) => zone.id === zoneId) ?? null
}
