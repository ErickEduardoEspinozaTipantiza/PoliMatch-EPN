import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Header } from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useMatchStore } from "../store/useMatchStore";
import "./connections.css";

export default function ConnectionsPage() {
  const getMatches = useMatchStore((state) => state.getMyMatches);
  useEffect(() => {
    getMatches();
  }, [getMatches]);
  return (
    <div className="app-shell">
      <Header />
      <main id="main-content" className="page-wrap connections-page">
        <div className="connections-page-heading">
          <div>
            <p className="eyebrow">El interés ya es mutuo</p>
            <h1>
              Ahora, empieza con un <span>hola.</span>
            </h1>
            <p className="muted">
              Tus matches, en un solo lugar. Elige a alguien para conversar.
            </p>
          </div>
          <Link to="/" className="button button-secondary">
            <Compass size={17} />
            Descubrir personas
          </Link>
        </div>
        <Sidebar />
      </main>
    </div>
  );
}
