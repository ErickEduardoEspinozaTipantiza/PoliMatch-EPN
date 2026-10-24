import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { Header } from "../components/Header";
import SwipeArea from "../components/SwipeArea";
import SwipeFeedback from "../components/SwipeFeedback";
import { StatePanel } from "../components/UI";
import { useMatchStore } from "../store/useMatchStore";
import "./discovery.css";
const HomePage = () => {
  const [swipeBusy, setSwipeBusy] = useState(false);
  const onSwipeBusy = useCallback((busy) => {
    setSwipeBusy(busy);
    useMatchStore.setState({ swipeAnimating: busy });
  }, []);
  const loading = useMatchStore((state) => state.isLoadingUserProfiles);
  const getProfiles = useMatchStore((state) => state.getUserProfiles);
  const getMatches = useMatchStore((state) => state.getMyMatches);
  const profiles = useMatchStore((state) => state.userProfiles);
  const error = useMatchStore((state) => state.profilesError);
  useEffect(() => {
    getProfiles();
    getMatches();
    return () => useMatchStore.setState({ swipeAnimating: false });
  }, [getProfiles, getMatches]);
  return (
    <div className="app-shell dating-shell">
      <Header />
      <main id="main-content" className="page-wrap dating-discovery">
        <div className="discover-heading">
          <div>
            <p className="eyebrow">Tu próxima historia</p>
            <h1>
              Descubre tu <span>chispa.</span>
            </h1>
          </div>
          <p className="campus-note">
            <Sparkles size={15} />
            Citas · Amistad · Campus
          </p>
        </div>
        <div className="discover-grid">
          <section className="discovery-stage" aria-label="Descubrir personas">
            <div className="stage-meta">
              <span>Para ti</span>
              <span>Una persona. Muchas posibilidades.</span>
            </div>
            {swipeBusy || (!loading && !error && profiles.length > 0) ? (
              <SwipeArea onBusyChange={onSwipeBusy} />
            ) : loading ? (
              <>
                <div
                  className="swipe-stack skeleton"
                  style={{ borderRadius: 20 }}
                  role="status"
                  aria-label="Cargando perfiles"
                />
                <p className="swipe-hint">Buscando nuevas posibilidades…</p>
              </>
            ) : error ? (
              <StatePanel
                title="Nos faltó conexión"
                description={error}
                onRetry={getProfiles}
              />
            ) : (
              <StatePanel
                title="Ya viste los perfiles disponibles"
                description="Las buenas conexiones tienen su momento. Vuelve más tarde o comprueba si hay alguien nuevo."
              >
                <button
                  className="button button-secondary"
                  onClick={getProfiles}
                >
                  Volver a buscar
                </button>
              </StatePanel>
            )}
            <SwipeFeedback />
          </section>
          <Sidebar />
        </div>
      </main>
    </div>
  );
};
export default HomePage;
