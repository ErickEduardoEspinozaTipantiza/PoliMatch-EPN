import { useState } from "react";
import { Heart, Sparkles, ArrowUpRight } from "lucide-react";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { Brand } from "../components/UI";
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const switchTab = (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const login = event.key === "Home" || (event.key !== "End" && !isLogin);
      setIsLogin(login);
      document.getElementById(login ? "login-tab" : "signup-tab")?.focus();
    }
  };
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-story" aria-label="Bienvenido a PoliMatch">
        <Brand />
        <div className="auth-story-content">
          <p className="eyebrow">Tu comunidad. Tu próxima conexión.</p>
          <div className="display-title" style={{ marginTop: 25 }}>
            Entre clases,
            <br />
            pasa <span className="serif">algo.</span>
          </div>
          <p className="muted">
            Hay personas por descubrir más allá de tu aula. Encuentra tu próxima
            buena conversación en la comunidad de la EPN.
          </p>
          <div className="connection-art" aria-hidden="true">
            <span className="connection-tile">
              <Sparkles size={27} strokeWidth={1.5} />
            </span>
            <span className="connection-tile">
              <Heart size={29} strokeWidth={1.5} />
            </span>
            <span className="connection-note">
              Una coincidencia.
              <br />
              Muchas posibilidades.
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>Hecho para conectar.</span>
          <span>
            PoliMatch <ArrowUpRight size={12} style={{ display: "inline" }} />
          </span>
        </div>
      </section>
      <section className="auth-content">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <p className="eyebrow">El comienzo de algo</p>
          <h1>{isLogin ? "Qué bueno verte." : "Tu historia empieza aquí."}</h1>
          <p className="muted">
            {isLogin
              ? "Entra y descubre con quién podrías conectar hoy."
              : "Crea tu perfil y haz espacio para nuevas conexiones."}
          </p>
          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Acceso a tu cuenta"
          >
            <button
              id="login-tab"
              role="tab"
              aria-selected={isLogin}
              aria-controls="auth-panel"
              tabIndex={isLogin ? 0 : -1}
              className="auth-tab"
              onClick={() => setIsLogin(true)}
              onKeyDown={switchTab}
            >
              Iniciar sesión
            </button>
            <button
              id="signup-tab"
              role="tab"
              aria-selected={!isLogin}
              aria-controls="auth-panel"
              tabIndex={!isLogin ? 0 : -1}
              className="auth-tab"
              onClick={() => setIsLogin(false)}
              onKeyDown={switchTab}
            >
              Crear cuenta
            </button>
          </div>
          <div
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={isLogin ? "login-tab" : "signup-tab"}
          >
            {isLogin ? <LoginForm /> : <SignUpForm />}
          </div>
          <p className="auth-footnote">
            Conecta a tu ritmo. Tus conversaciones empiezan cuando el interés es
            mutuo.
          </p>
        </div>
      </section>
    </main>
  );
};
export default AuthPage;
