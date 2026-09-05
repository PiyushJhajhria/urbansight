import {
  Activity,
  AlertTriangle,
  Camera,
  MapPinned,
  Route,
  Video,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "map", label: "Live Map", icon: MapPinned },
  { id: "trajectories", label: "Trajectories", icon: Route },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "video-analysis", label: "Video Analysis", icon: Video },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
];

function Sidebar({ activePage, onNavigate, online, alertCount, open }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-icon">
          <Activity size={22} />
        </div>
        <div>
          <h2>UrbanSight AI</h2>
          <span>Traffic Intelligence</span>
        </div>
      </div>

      <nav className="nav-menu">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              className={isActive ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === "alerts" && alertCount > 0 ? (
                <em className="nav-badge">{alertCount}</em>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="system-status">
        <div className="status-row">
          <span className={online ? "status-dot" : "status-dot offline"} />
          {online ? "System Operational" : "API Offline"}
        </div>
        <p>
          {online
            ? "ANPR engine connected to FastAPI analytics services."
            : "Waiting for the local backend at port 8000."}
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
