interface Props {
  data: number[];
  times?: number[];
  color?: string;
  height?: number;
  format?: (value: number) => string;
}

function niceMax(value: number): number {
  if (!isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  let nice: number;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

function hhmmss(t: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LineChart({
  data,
  times,
  color = "#8ab6f9",
  height = 130,
  format = (v: number) => String(v),
}: Props) {
  const width = 100;
  const n = data.length;
  const max = niceMax(Math.max(0, ...data));

  const points = data
    .map((value, i) => {
      const x = n === 1 ? width : (i / (n - 1)) * width;
      const y = height - (value / max) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const fracs = [0, 0.25, 0.5, 0.75, 1];
  const yLabels = [1, 0.75, 0.5, 0.25, 0].map((f) => format(max * f));

  const t0 = times?.[0];
  const tm = times?.[Math.floor((n - 1) / 2)];
  const t1 = times?.[n - 1];

  return (
    <div className="lc">
      <div className="lc-yaxis" style={{ height }}>
        {yLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="lc-right">
        <div className="lc-plot" style={{ height }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {fracs.map((f, i) => {
              const y = height * (1 - f);
              return (
                <line
                  key={i}
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
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
        </div>
        <div className="lc-xaxis">
          <span>{t0 ? hhmmss(t0) : ""}</span>
          <span>{tm ? hhmmss(tm) : ""}</span>
          <span>{t1 ? hhmmss(t1) : ""}</span>
        </div>
      </div>
    </div>
  );
}
