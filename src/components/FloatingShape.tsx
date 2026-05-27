import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron } from '@react-three/drei';
import * as THREE from 'three';

const Shape = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x += 0.002;
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 1.0) * 0.3;
    }
  });

  return (
    <Icosahedron ref={meshRef} args={[1, 1]} scale={2.5}>
      <meshBasicMaterial 
        wireframe 
        color="#1A7FD4" 
        transparent 
        opacity={0.6} 
      />
    </Icosahedron>
  );
};

const FloatingShape = () => {
  return (
    <div className="hero-3d-object" style={{ width: '400px', height: '400px' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Shape />
      </Canvas>
    </div>
  );
};

export default FloatingShape;
