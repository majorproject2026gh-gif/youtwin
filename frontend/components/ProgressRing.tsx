export default function ProgressRing({ percent }: { percent: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-24 w-24">
      <svg height="96" width="96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} stroke="#D8CBAE" strokeWidth="8" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="#C22A2A"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-rec-500">
        {percent}%
      </div>
    </div>
  );
}
