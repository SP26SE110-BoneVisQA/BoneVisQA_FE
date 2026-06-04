'use client';

interface MiniProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
}

export default function MiniProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel = 'Complete',
  color = 'var(--primary)',
  trackColor = 'var(--muted)',
}: MiniProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-headline text-4xl font-black text-foreground">
          {progress}%
        </span>
        {label ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
