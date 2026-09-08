import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * The hero's 3D centerpiece: two distorted, liquid-metal icosahedra in
 * the brand's coral/gold, slowly counter-rotating — a literal visual
 * metaphor for the "twin" concept, not decoration for its own sake.
 * Kept deliberately simple (no custom shaders, well-supported drei
 * helpers only) since this needs to work reliably without live tuning.
 */
function TwinShape({
  position,
  color,
  rotationSpeed,
}: {
  position: [number, number, number];
  color: string;
  rotationSpeed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * rotationSpeed * 0.25;
    meshRef.current.rotation.y = state.clock.elapsedTime * rotationSpeed * 0.18;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[1.3, 4]} />
      <MeshDistortMaterial color={color} distort={0.4} speed={1.8} roughness={0.2} metalness={0.55} />
    </mesh>
  );
}

export default function TwinOrb() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 5, 5]} intensity={1.3} color="#C22A2A" />
      <pointLight position={[-5, -3, 4]} intensity={0.9} color="#D9A441" />

      <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.8}>
        <TwinShape position={[-1.0, 0.1, 0]} color="#C22A2A" rotationSpeed={1} />
      </Float>
      <Float speed={1.1} rotationIntensity={0.45} floatIntensity={0.7}>
        <TwinShape position={[1.0, -0.1, 0]} color="#D9A441" rotationSpeed={-0.85} />
      </Float>

      <Sparkles count={35} scale={6} size={2} speed={0.25} color="#F5F5F0" opacity={0.35} />
    </Canvas>
  );
}
