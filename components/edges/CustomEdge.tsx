import React from "react";
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow } from "reactflow";

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <g className="group pointer-events-auto">
      {/* Invisible thicker interaction edge */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
        className="cursor-pointer"
      />
      {/* Active colored path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: 3,
        }}
        markerEnd={markerEnd}
        interactionWidth={15}
      />
      {/* Delete button centered on hover */}
      <foreignObject
        width={20}
        height={20}
        x={labelX - 10}
        y={labelY - 10}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <button
          onClick={onEdgeDelete}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-[9px] shadow-md cursor-pointer transition select-none leading-none border border-white"
          title="Delete Connection"
        >
          ✕
        </button>
      </foreignObject>
    </g>
  );
}
