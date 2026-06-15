import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WavyPlane = () => {
  const geomRef = useRef<THREE.PlaneGeometry>(null);
  const mousePos = useRef(new THREE.Vector2(0, 0));

  useFrame((state) => {
    // Smoothly track mouse position mapped to plane coordinates
    // pointer.x goes from -1 to 1, map to -30 to 30
    // pointer.y goes from -1 to 1, map to -30 to 30
    mousePos.current.x = THREE.MathUtils.lerp(mousePos.current.x, state.pointer.x * 30, 0.1);
    mousePos.current.y = THREE.MathUtils.lerp(mousePos.current.y, state.pointer.y * 30, 0.1);

    if (geomRef.current) {
      const time = state.clock.elapsedTime * 1.5;
      const position = geomRef.current.attributes.position;
      
      for (let i = 0; i < position.count; i++) {
        // PlaneGeometry has X and Y on the plane grid, Z is depth.
        const x = position.getX(i);
        const y = position.getY(i);
        
        // Base wavy pattern
        let z = Math.sin(x * 0.4 + time) * 1.5 + Math.sin(y * 0.4 + time) * 1.5;

        // Disturbance from mouse
        const dx = x - mousePos.current.x;
        const dy = y - mousePos.current.y;
        const distSq = dx * dx + dy * dy;
        
        // Gaussian bump
        if (distSq < 400) { // optimization: only calculate if distance < 20
          const influence = Math.exp(-distSq * 0.02);
          z += influence * 8; // Height of the bump
        }

        position.setZ(i, z);
      }
      position.needsUpdate = true;
    }
  });

  return (
    <group rotation={[-Math.PI / 2.2, 0, 0]} position={[0, -5, -5]}>
      <mesh>
        <planeGeometry ref={geomRef} args={[60, 60, 50, 50]} />
        <meshBasicMaterial color="#1A7FD4" wireframe transparent opacity={0.12} />
      </mesh>
      {geomRef.current && (
        <points geometry={geomRef.current}>
          <pointsMaterial color="#1A7FD4" size={0.1} sizeAttenuation={true} transparent opacity={0.5} />
        </points>
      )}
    </group>
  );
};

const Hero3D = () => {
  return (
    <div className="hero-3d-container">
      <Canvas 
        camera={{ position: [0, 2, 10], fov: 60 }}
        eventSource={document.getElementById('root') as HTMLElement}
        eventPrefix="client"
      >
        <WavyPlane />
      </Canvas>
    </div>
  );
};

export default Hero3D;
