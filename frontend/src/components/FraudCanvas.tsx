'use client';

import React, { useEffect, useRef } from 'react';

const FraudCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 800);
    let height = (canvas.height = canvas.offsetHeight || 250);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate account nodes
    const numNodes = 15;
    const nodes: any[] = [];
    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        id: i,
        x: Math.random() * (width - 80) + 40,
        y: Math.random() * (height - 60) + 30,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1.2,
        isFraud: false,
        fraudIntensity: 0,
      });
    }

    // Generate connections between nodes
    const connections: { from: number; to: number }[] = [];
    for (let i = 0; i < numNodes; i++) {
      const targets = [...nodes]
        .map((n, idx) => ({ idx, dist: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
        .filter((t) => t.idx !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, Math.random() > 0.5 ? 2 : 1);

      targets.forEach((t) => {
        if (!connections.some((c) => (c.from === i && c.to === t.idx) || (c.from === t.idx && c.to === i))) {
          connections.push({ from: i, to: t.idx });
        }
      });
    }

    // Data pulses traveling along connections
    const pulses: any[] = [];
    const maxPulses = 8;
    for (let i = 0; i < maxPulses; i++) {
      if (connections.length > 0) {
        const conn = connections[Math.floor(Math.random() * connections.length)];
        pulses.push({
          from: conn.from,
          to: conn.to,
          t: Math.random(),
          speed: Math.random() * 0.003 + 0.0015,
        });
      }
    }

    // Fraud catch state
    let lastFraudCatch = Date.now();
    let fraudNodeIdx = -1;
    let rippleRadius = 0;
    let rippleOpacity = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Update node positions
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 15 || node.x > width - 15) node.vx *= -1;
        if (node.y < 15 || node.y > height - 15) node.vy *= -1;
      });

      // 2. Trigger periodic Fraud Catch
      const now = Date.now();
      if (now - lastFraudCatch > 4500) {
        fraudNodeIdx = Math.floor(Math.random() * nodes.length);
        nodes[fraudNodeIdx].isFraud = true;
        nodes[fraudNodeIdx].fraudIntensity = 1.0;
        rippleRadius = 0;
        rippleOpacity = 0.7;
        lastFraudCatch = now;
      }

      // Fade out fraud intensities
      nodes.forEach((node) => {
        if (node.isFraud) {
          node.fraudIntensity -= 0.015;
          if (node.fraudIntensity <= 0) {
            node.isFraud = false;
            node.fraudIntensity = 0;
          }
        }
      });

      if (fraudNodeIdx !== -1 && rippleOpacity > 0) {
        rippleRadius += 1.5;
        rippleOpacity -= 0.008;
        if (rippleOpacity <= 0) {
          fraudNodeIdx = -1;
        }
      }

      // 3. Draw connections
      connections.forEach((conn) => {
        const fromNode = nodes[conn.from];
        const toNode = nodes[conn.to];
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);

        if (fromNode.isFraud || toNode.isFraud) {
          const intensity = Math.max(fromNode.fraudIntensity, toNode.fraudIntensity);
          ctx.strokeStyle = `rgba(245, 61, 61, ${0.1 + intensity * 0.4})`;
          ctx.lineWidth = 1 + intensity * 0.5;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; // Barely visible grey lines
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
      });

      // 4. Draw ripple effect
      if (fraudNodeIdx !== -1 && fraudNodeIdx < nodes.length) {
        const fn = nodes[fraudNodeIdx];
        ctx.beginPath();
        ctx.arc(fn.x, fn.y, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 61, 61, ${rippleOpacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 5. Draw data pulses
      pulses.forEach((pulse) => {
        pulse.t += pulse.speed;
        if (pulse.t >= 1) {
          pulse.t = 0;
          const conn = connections[Math.floor(Math.random() * connections.length)];
          pulse.from = conn.from;
          pulse.to = conn.to;
        }

        const fromNode = nodes[pulse.from];
        const toNode = nodes[pulse.to];
        const px = fromNode.x + (toNode.x - fromNode.x) * pulse.t;
        const py = fromNode.y + (toNode.y - fromNode.y) * pulse.t;

        ctx.beginPath();
        ctx.arc(px, py, 1.0, 0, Math.PI * 2);
        if (fromNode.isFraud || toNode.isFraud) {
          ctx.fillStyle = '#FF3333'; // alert red
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Stark light grey instead of green
        }
        ctx.fill();
      });

      // 6. Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (node.isFraud ? 1.5 : 0), 0, Math.PI * 2);
        if (node.isFraud) {
          ctx.fillStyle = `rgba(245, 61, 61, ${node.fraudIntensity})`;
          ctx.strokeStyle = '#FF3333';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        }
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-0 bg-transparent" />;
};

export default FraudCanvas;
