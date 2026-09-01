function StatCard({ title, value, subtitle, icon: Icon, tone = "blue" }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <div className="stat-icon">
          <Icon size={20} />
        </div>
        <span className="trend-pill">LIVE DATA</span>
      </div>
      <h3>{value}</h3>
      <p className="stat-title">{title}</p>
      <span className="stat-subtitle">{subtitle}</span>
    </article>
  );
}

export default StatCard;
