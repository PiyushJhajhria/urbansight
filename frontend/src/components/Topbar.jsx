import { Menu, RefreshCw, Search } from "lucide-react";

const PAGE_COPY = {
  overview: {
    eyebrow: "City-wide AI engine",
    title: "Traffic Intelligence Command Center",
    description:
      "Multi-camera ANPR, trajectory reconstruction, and urban traffic analytics.",
  },
  map: {
    eyebrow: "GIS intelligence",
    title: "Live City Network Map",
    description:
      "Camera nodes, traffic intensity, and reconstructed vehicle routes.",
  },
  trajectories: {
    eyebrow: "Multi-camera ANPR",
    title: "Vehicle Trajectories",
    description: "Search plates and inspect ordered camera-to-camera movement.",
  },
  cameras: {
    eyebrow: "Distributed camera network",
    title: "ANPR Camera Nodes",
    description: "Prototype camera activity from analytics counts and heatmap data.",
  },
  alerts: {
    eyebrow: "Security intelligence",
    title: "Alerts & Anomalies",
    description:
      "Blacklist matches, impossible-speed events, and restricted routes.",
  },
};

function Topbar({
  activePage,
  onSearch,
  onRefresh,
  onMenu,
  refreshing,
  online,
}) {
  const copy = PAGE_COPY[activePage] || PAGE_COPY.overview;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <button className="menu-button" onClick={onMenu} type="button">
          <Menu size={18} />
        </button>
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="header-description">{copy.description}</p>
        </div>
      </div>

      <div className="top-actions">
        <div className={online ? "live-pill" : "live-pill offline"}>
          <span />
          {online ? "API LIVE" : "OFFLINE"}
        </div>

        <button className="ghost-button" onClick={onRefresh} type="button">
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          Refresh
        </button>

        <button className="search-button" onClick={onSearch} type="button">
          <Search size={16} />
          Search vehicle
        </button>
      </div>
    </header>
  );
}

export default Topbar;
