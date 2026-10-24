import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/useAuthStore";
import { useMatchStore } from "./store/useMatchStore";
import { BackHome, Brand, StatePanel } from "./components/UI";
import MatchCelebration from "./components/MatchCelebration";
const HomePage = lazy(() => import("./pages/HomePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
function App() {
  const location = useLocation();
  const authUser = useAuthStore((state) => state.authUser);
  const onboardingPending = useAuthStore((state) => state.onboardingPending);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const checkingAuth = useAuthStore((state) => state.checkingAuth);
  const authError = useAuthStore((state) => state.authError);
  const subscribe = useMatchStore((state) => state.subscribeToNewMatches);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (authUser?._id) return subscribe();
  }, [authUser?._id, subscribe]);
  if (checkingAuth)
    return (
      <main id="main-content" className="full-page-state">
        <StatePanel
          loading
          title="Preparando tu espacio"
          description="Estamos comprobando tu sesión."
        />
      </main>
    );
  if (!authUser && authError)
    return (
      <main id="main-content" className="page-wrap">
        <Brand />
        <StatePanel
          title="No pudimos conectar"
          description={authError}
          onRetry={checkAuth}
        />
      </main>
    );
  return (
    <>
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <Suspense
        fallback={
          <main id="main-content" className="route-loading">
            <StatePanel
              loading
              title="Un momento"
              description="Estamos abriendo esta página."
            />
          </main>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              authUser ? (
                location.hash === "#conexiones" ? (
                  <Navigate replace to="/connections" />
                ) : (
                  <HomePage />
                )
              ) : (
                <Navigate replace to="/auth" />
              )
            }
          />
          <Route
            path="/connections"
            element={
              authUser ? <ConnectionsPage /> : <Navigate replace to="/auth" />
            }
          />
          <Route
            path="/auth"
            element={
              authUser ? (
                <Navigate
                  replace
                  to={onboardingPending ? "/onboarding/photos" : "/"}
                />
              ) : (
                <AuthPage />
              )
            }
          />
          <Route
            path="/onboarding/photos"
            element={
              authUser ? (
                <ProfilePage onboarding />
              ) : (
                <Navigate replace to="/auth" />
              )
            }
          />
          <Route
            path="/profile"
            element={
              authUser ? <ProfilePage /> : <Navigate replace to="/auth" />
            }
          />
          <Route
            path="/chat/:id"
            element={authUser ? <ChatPage /> : <Navigate replace to="/auth" />}
          />
          <Route
            path="*"
            element={
              <main id="main-content" className="full-page-state">
                <StatePanel
                  title="Este camino no lleva a ninguna parte"
                  description="La página que buscas no está disponible."
                >
                  <BackHome />
                </StatePanel>
              </main>
            }
          />
        </Routes>
      </Suspense>
      <MatchCelebration />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#122D39",
            color: "#fff",
            fontSize: "14px",
            borderRadius: "12px",
          },
          duration: 4000,
        }}
      />
    </>
  );
}
export default App;
