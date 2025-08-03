"use client"

import React, { useEffect, useState } from "react"

interface Orb {
  id: number
  size: number
  x: number
  y: number
  color: string
  duration: number
  delay: number
}

export function AnimatedBackground() {
  const [orbs, setOrbs] = useState<Orb[]>([])

  useEffect(() => {
    const generateOrbs = () => {
      const colors = ["#9999FF", "#90EE90", "#B3B3FF", "#B9F6B9"]
      const newOrbs: Orb[] = []

      for (let i = 0; i < 8; i++) {
        newOrbs.push({
          id: i,
          size: Math.random() * 300 + 200,
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          duration: Math.random() * 20 + 20,
          delay: Math.random() * 5,
        })
      }

      setOrbs(newOrbs)
    }

    generateOrbs()
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95" />
      
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(153, 153, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(153, 153, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Floating orbs */}
      {orbs.map((orb) => (
        <div
          key={orb.id}
          className="absolute rounded-full floating-orb animate-float"
          style={{
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background: `radial-gradient(circle at 30% 30%, ${orb.color}33, ${orb.color}11)`,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${orb.delay}s`,
            filter: "blur(60px)",
          }}
        />
      ))}

      {/* Gradient overlays */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-periwinkle/10 rounded-full filter blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-light-green/10 rounded-full filter blur-[100px] animate-pulse-slow animation-delay-2000" />
      
      {/* Rotating gradient */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-20 animate-rotate-slow"
          style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(153, 153, 255, 0.1) 90deg,
              transparent 180deg,
              rgba(144, 238, 144, 0.1) 270deg,
              transparent 360deg
            )`,
          }}
        />
      </div>

      {/* Light rays */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 w-[200%] h-[200%] opacity-[0.02]"
          style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(153, 153, 255, 0.3) 5deg,
              transparent 10deg,
              transparent 350deg,
              rgba(144, 238, 144, 0.3) 355deg,
              transparent 360deg
            )`,
            transform: "translate(-50%, -50%) rotate(0deg)",
            animation: "rotate-slow 30s linear infinite",
          }}
        />
      </div>
    </div>
  )
}