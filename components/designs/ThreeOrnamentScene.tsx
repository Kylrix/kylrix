'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeOrnamentSceneProps {
  accent: string;
  secondary: string;
  tertiary: string;
}

export default function ThreeOrnamentScene({ accent, secondary, tertiary }: ThreeOrnamentSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0908, 6, 18);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.3, 8.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const geometry = new THREE.Group();

    const eggMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accent),
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });

    const egg1 = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), eggMaterial);
    egg1.scale.set(0.8, 1.2, 0.8);
    egg1.position.set(-1.8, -0.15, 0.6);
    geometry.add(egg1);

    const egg2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 48, 48),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(secondary),
        roughness: 0.25,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      })
    );
    egg2.scale.set(0.9, 1.35, 0.9);
    egg2.position.set(1.4, 0.2, -0.3);
    geometry.add(egg2);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.22, 24, 120),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(tertiary),
        transparent: true,
        opacity: 0.75,
        emissive: new THREE.Color(tertiary),
        emissiveIntensity: 0.65,
      })
    );
    halo.rotation.x = Math.PI / 2.7;
    halo.position.set(0.15, -0.6, -1.3);
    geometry.add(halo);

    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xf9e8c9,
        emissive: 0xf2cd9d,
        emissiveIntensity: 0.2,
      })
    );
    pearl.position.set(0, 1.6, 0.3);
    geometry.add(pearl);

    scene.add(geometry);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 6, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(new THREE.Color(secondary), 1.2);
    fill.position.set(-5, -2, 3);
    scene.add(fill);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame += 0.01;
      geometry.rotation.y = frame * 0.35;
      geometry.rotation.x = Math.sin(frame * 0.4) * 0.08;
      egg1.position.y = -0.15 + Math.sin(frame * 2.1) * 0.08;
      egg2.position.y = 0.2 + Math.cos(frame * 1.8) * 0.08;
      halo.rotation.z = frame * 0.55;
      pearl.position.y = 1.6 + Math.sin(frame * 1.4) * 0.05;
      renderer.render(scene, camera);
      requestId = requestAnimationFrame(animate);
    };

    let requestId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestId);
      ro.disconnect();
      geometry.traverse((object) => {
        if ('geometry' in object) object.geometry.dispose();
        if ('material' in object) {
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [accent, secondary, tertiary]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
