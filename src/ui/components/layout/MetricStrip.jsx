export function MetricStrip({ kpis }) {
  return (
    <section className="metric-strip">
      {kpis.map((kpi) => (
        <article key={kpi.label} className="metric-card">
          <p>{kpi.label}</p>
          <h3>{kpi.value}</h3>
        </article>
      ))}
    </section>
  );
}
