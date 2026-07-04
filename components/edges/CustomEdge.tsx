import React from "react";
import { BaseEdge, EdgeProps, getBezierPath } from "reactflow";

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
  animated,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Glow path behind the actual edge */}
      <path
        id={`${id}-glow`}
        d={edgePath}
        fill="none"
        stroke={style.stroke || "#a1a1aa"}
        strokeWidth={5}
        strokeOpacity={0.12}
        className="react-flow__edge-path"
      />
      {/* Active colored path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: 2,
        }}
        markerEnd={markerEnd}
        interactionWidth={10}
      />
    </>
  );
}
