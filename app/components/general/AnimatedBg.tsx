"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "../../../../styles/ThemeContext";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}


export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect prefers-reduced-motion: render a single static frame instead of
    // animating. Honors WCAG 2.3.3 and prevents motion sickness for users who
    // have enabled the setting at the OS level.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceMotion = motionQuery.matches;

    let animationId: number;
    const NODE_COUNT = 120;
    const MAX_DISTANCE = 120;
    const nodes: Node[] = [];

    // Resize canvas to full window size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize nodes
    for (let i = 0; i < NODE_COUNT; i++) {
      const speedFactor = 0.6;
      nodes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5 * speedFactor,
        vy: (Math.random() - 0.5) * 0.5 * speedFactor,
        radius: Math.random() * 3.5 + 1.5,
        color: colors.animatedColors[Math.floor(Math.random() * Object.keys(colors.animatedColors).length)],
      });
    }

    // Convert hex color to rgba
    const hexToRgba = (hex: string, alpha: number): string => {
      const clean = hex.replace("#", "");
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // When reduced motion is requested, skip velocity updates so the scene
      // is drawn once and stays still.
      if (!reduceMotion) {
        for (const node of nodes) {
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
          if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DISTANCE) {
            const alpha = (1 - dist / MAX_DISTANCE) * 0.95;
            const gradient = ctx.createLinearGradient(
              nodes[i].x,
              nodes[i].y,
              nodes[j].x,
              nodes[j].y
            );
            gradient.addColorStop(0, hexToRgba(nodes[i].color, alpha));
            gradient.addColorStop(1, hexToRgba(nodes[j].color, alpha));
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(node.color, 0.85);
        ctx.fill();
      }

      // Skip re-scheduling when reduced motion: one static frame, no RAF loop.
      if (!reduceMotion) {
        animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        // Fixed so the dots continue to paint behind the viewport as the user
        // scrolls past the hero into the accordion section, instead of being
        // clipped at the first 100vh.
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        opacity: 0.7,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}