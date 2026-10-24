import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!(await login({ email: email.trim(), password })))
      setError(
        "No pudimos iniciar sesión. Revisa tus datos o vuelve a intentarlo.",
      );
  };
  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          name="email"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <div className="password-wrap">
          <input
            id="password"
            name="password"
            className="input"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="button button-primary"
        type="submit"
        disabled={loading}
      >
        {loading ? (
          <>
            <LoaderCircle className="spinner" size={17} />
            Entrando…
          </>
        ) : (
          <>
            Iniciar sesión
            <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
};
export default LoginForm;
