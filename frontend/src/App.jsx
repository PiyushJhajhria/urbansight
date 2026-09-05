import { useState } from "react";
import { Activity } from "lucide-react";

import ErrorBanner from "./components/ErrorBanner";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import AlertsPage from "./pages/AlertsPage";
import CamerasPage from "./pages/CamerasPage";
import LiveMapPage from "./pages/LiveMapPage";
import OverviewPage from "./pages/OverviewPage";
import TrajectoriesPage from "./pages/TrajectoriesPage";
import VideoAnalysisPage from "./pages/VideoAnalysisPage";
import "./styles/dashboard.css";

function DashboardShell() {
  const [activePage, setActivePage] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const { loading, error, reload, metrics, alerts } = useDashboard();

  function navigate(page) {
    setActivePage(page);
    setMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Loading UrbanSight intelligence...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {menuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        online={!error}
        alertCount={alerts.length}
        open={menuOpen}
      />

      <main className="main-content">
        <Topbar
          activePage={activePage}
          onSearch={() => navigate("trajectories")}
          onRefresh={reload}
          onMenu={() => setMenuOpen((value) => !value)}
          refreshing={loading}
          online={!error}
        />

        <ErrorBanner message={error} onRetry={reload} />

        {activePage === "overview" ? (
          <OverviewPage onNavigate={navigate} />
        ) : null}
        {activePage === "map" ? <LiveMapPage /> : null}
        {activePage === "trajectories" ? <TrajectoriesPage /> : null}
        {activePage === "cameras" ? <CamerasPage /> : null}
        {activePage === "video-analysis" ? <VideoAnalysisPage /> : null}
        {activePage === "alerts" ? <AlertsPage /> : null}

        <footer className="app-footer">
          <Activity size={12} />
          UrbanSight AI · {metrics.activeCameras} camera nodes · FastAPI 127.0.0.1:8000
        </footer>
      </main>
    </div>
  );
}

function App() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}

export default App;
