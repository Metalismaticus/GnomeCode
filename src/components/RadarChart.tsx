// Радар сравнения двух моделей (усиление сравнения, как на
// opencode.ai/data/compare): пентагон пяти осей, полигон на модель, полые
// точки — фолбэки без данных, заполненные — реальные бенчмарки/цены. Чистый
// SVG без библиотек: осей пять, перерисовка дешёвая.

export type RadarChartSeries = {
  name: string;
  color: string;
  /** Значения по осям 0–100, в порядке RadarChartProps.axes. */
  values: number[];
  /** Точка реальная (заполненная) или фолбэк (полая). */
  real: boolean[];
};

export type RadarChartProps = {
  axes: string[];
  series: RadarChartSeries[];
  size?: number;
};

const RINGS = 4;

/** Вершина оси i на кольце радиуса r: нулевая ось — верх, дальше по часовой. */
function vertex(index: number, count: number, radius: number): [number, number] {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function polygon(indexes: number[], count: number, radius: number): string {
  return indexes
    .map((value, index) => {
      const [x, y] = vertex(index, count, (radius * value) / 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function RadarChart({ axes, series, size = 240 }: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 40;
  const count = axes.length;
  return (
    <div className="radar" data-testid="compare-radar">
      <svg
        className="radar__svg"
        width={size}
        height={size}
        viewBox={`${-center} ${-center} ${size} ${size}`}
        role="img"
        aria-label={`Радар сравнения по осям: ${axes.join(", ")}`}
      >
        {/* Кольца и оси — сетка пентагона. */}
        {Array.from({ length: RINGS }, (_, ring) => (
          <polygon
            key={ring}
            className="radar__ring"
            points={polygon(
              Array.from({ length: count }, () => (100 * (ring + 1)) / RINGS),
              count,
              radius,
            )}
          />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = vertex(index, count, radius);
          const [lx, ly] = vertex(index, count, radius + 18);
          return (
            <g key={axis}>
              <line className="radar__axis" x1={0} y1={0} x2={x} y2={y} />
              <text
                className="radar__axis-label"
                x={lx}
                y={ly}
                textAnchor={Math.abs(lx) < 12 ? "middle" : lx > 0 ? "start" : "end"}
                dominantBaseline="middle"
              >
                {axis}
              </text>
            </g>
          );
        })}
        {/* Полигоны моделей: заливка с прозрачностью, точки — полые на фолбэках. */}
        {series.map((one) => {
          const values = one.values.map((value) => Math.max(0, Math.min(100, value)));
          return (
            <g key={one.name}>
              <polygon
                className="radar__shape"
                points={polygon(values, count, radius)}
                style={{ fill: one.color, stroke: one.color }}
              />
              {values.map((value, index) => (
                <circle
                  key={index}
                  className={one.real[index] ? "radar__point" : "radar__point radar__point--hollow"}
                  cx={vertex(index, count, (radius * value) / 100)[0].toFixed(1)}
                  cy={vertex(index, count, (radius * value) / 100)[1].toFixed(1)}
                  r={4}
                  style={{ fill: one.real[index] ? one.color : "var(--bg-panel, #fff)", stroke: one.color }}
                >
                  <title>{`${one.name} · ${axes[index]}: ${value}${one.real[index] ? "" : " (нет данных)"}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="radar__legend">
        {series.map((one) => (
          <div className="radar__legend-item" key={one.name}>
            <span className="radar__legend-chip" style={{ background: one.color }} aria-hidden="true" />
            <span className="radar__legend-name">{one.name}</span>
          </div>
        ))}
        <div className="radar__legend-note">Полые точки — нет данных по оси</div>
      </div>
    </div>
  );
}
