'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { roomSkeletonToFlow, type ZoneNodeData } from '@/lib/experience-designer/room-skeleton-flow'
import type { RoomSkeleton } from '@/lib/experience-designer/types'
import { ZoneNode } from '@/components/experience-designer/canvas/zone-node'

const nodeTypes = { zone: ZoneNode }

export interface BlueprintCanvasProps {
  roomSkeleton: RoomSkeleton | null
  selectedZoneId: string | null
  onZoneSelect: (zoneId: string | null) => void
}

export function BlueprintCanvas({
  roomSkeleton,
  selectedZoneId,
  onZoneSelect,
}: BlueprintCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => roomSkeletonToFlow(roomSkeleton),
    [roomSkeleton]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ZoneNodeData>>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === selectedZoneId,
      }))
    )
  }, [selectedZoneId, setNodes])

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      onZoneSelect(selectedNodes[0]?.id ?? null)
    },
    [onZoneSelect]
  )

  if (!roomSkeleton?.zones.length) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0f14]">
        <div className="max-w-sm rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center">
          <p className="text-sm font-medium text-white/80">Blueprint canvas</p>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Set constraints, then generate an architectural skeleton to populate zones on the
            spatial canvas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0b0f14]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#334155"
          className="!bg-[#0b0f14]"
        />
        <Controls
          className="!border-white/10 !bg-[#151b23] !shadow-lg [&>button]:!border-white/10 [&>button]:!bg-[#151b23] [&>button]:!fill-white/70 [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as ZoneNodeData
            if (data.zoneType === 'puzzle') return '#38bdf8'
            if (data.zoneType === 'climax') return '#f472b6'
            if (data.zoneType === 'entry') return '#4ade80'
            return '#64748b'
          }}
          maskColor="rgba(11, 15, 20, 0.85)"
          className="!border-white/10 !bg-[#151b23]/90"
        />
      </ReactFlow>
    </div>
  )
}
