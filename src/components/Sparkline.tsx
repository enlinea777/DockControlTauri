interface Props {
  data: number[];
  color?: string;
  height?: number;
  max?: number;
}

export default function Sparkline({
  data,
  color = "#8ab6f9",
  height = 120,
  max,
}: Props) {
  const width = 100;
  const n = data.length;
  const peak = Math.max(max ?? 0, ...data, 1);

  if (n === 0) {
    return <div style={{ height }} />;
  }

  const points = data
    .map((value, i) => {
      const x = n === 1 ? width : (i / (n - 1)) * width;
      const y = height - (value / peak) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        opacity={0.06}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
