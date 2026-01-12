import React from 'react';

interface S2LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function S2Logo({ className = '', size = 'md' }: S2LogoProps) {
  const sizes = {
    sm: { width: 40, height: 40, fontSize: '8px' },
    md: { width: 60, height: 60, fontSize: '10px' },
    lg: { width: 80, height: 80, fontSize: '12px' },
  };

  const { width, height, fontSize } = sizes[size];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer blue ring */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="#003366"
        strokeWidth="4"
      />
      
      {/* Inner red circle */}
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="#8B1538"
      />
      
      {/* Top text: SOLUTION SOURCE */}
      <text
        x="50"
        y="25"
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        SOLUTION SOURCE
      </text>
      
      {/* Bottom text: REALTIME. REALWORLD. SOLUTIONS */}
      <text
        x="50"
        y="85"
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        letterSpacing="0.3"
      >
        REALTIME. REALWORLD. SOLUTIONS
      </text>
      
      {/* S2 in center */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="white"
        fontSize="24"
        fontFamily="serif"
        fontWeight="bold"
      >
        S2
      </text>
      
      {/* EST. 2005 */}
      <text
        x="50"
        y="68"
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontFamily="Arial, sans-serif"
      >
        EST. 2005
      </text>
    </svg>
  );
}