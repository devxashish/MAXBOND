// src/components/FallingAnimation.js
import React, { useEffect, useRef } from 'react';
import './FallingAnimation.css';

const FallingAnimation = ({ numberOfElements = 150 }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const createFallingElement = () => {
      if (!containerRef.current) return;

      const element = document.createElement('div');
      element.classList.add('falling-element');

      const startX = Math.random() * 100;
      const duration = Math.random() * 8 + 12;
      const delay = Math.random() * 15;
      const baseSize = Math.random() * 8 + 10;
      const sizeVariation = Math.random() * 8 - 4;
      const finalSize = Math.max(5, baseSize + sizeVariation);
      const opacity = Math.random() * 0.4 + 0.2;
      const swayDistance = Math.random() * 80 + 30;

      element.style.left = `${startX}vw`;
      element.style.animationDuration = `${duration}s`;
      element.style.animationDelay = `${delay}s`;
      element.style.width = `${finalSize}px`;
      element.style.height = `${finalSize * (0.8 + Math.random() * 0.4)}px`;
      element.style.opacity = opacity;
      element.style.setProperty('--sway-distance', `${swayDistance}px`);
      element.style.setProperty('--initial-opacity', opacity);

      const initialRotation = Math.random() * 360;
      const rotationSpeed = (Math.random() * 2 - 1) * (Math.random() * 3 + 0.5);
      element.style.setProperty('--initial-rotation', `${initialRotation}deg`);
      element.style.setProperty('--rotation-speed', `${rotationSpeed}`);
      element.style.transform = `rotateZ(${initialRotation}deg)`;

      const leafType = Math.floor(Math.random() * 8);
      if (leafType === 0) {
        element.classList.add('leaf-type-1');
      } else if (leafType === 1) {
        element.classList.add('leaf-type-2');
      } else if (leafType === 2) {
        element.classList.add('leaf-type-3');
      } else if (leafType === 3) {
        element.classList.add('leaf-type-4');
      } else if (leafType === 4) {
        element.classList.add('leaf-type-5');
      } else if (leafType === 5) {
        element.classList.add('leaf-type-6');
      } else if (leafType === 6) {
        element.classList.add('leaf-type-7');
      } else {
        element.classList.add('leaf-type-8');
      }
      
      containerRef.current.appendChild(element);

      element.addEventListener('animationend', () => {
        element.remove();
        createFallingElement();
      });
    };

    for (let i = 0; i < numberOfElements; i++) {
      createFallingElement();
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [numberOfElements]);

  return <div ref={containerRef} className="falling-animation-container"></div>;
};

export default FallingAnimation;