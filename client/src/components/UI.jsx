import { stringProp, functionProp, boolProp } from "./propValidation";
import { useState } from "react";
import { Heart, LoaderCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
export function Brand() {
  return (
    <Link to="/" className="brand" title="Ir al inicio">
      <img className="brand-mark" src="/brand.svg" alt="" />
      <div>
        poli<em>match</em>
        <div className="brand-caption">Conexiones entre clases</div>
      </div>
    </Link>
  );
}
export function Avatar({ src, name = "Perfil", size = 44 }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P";
  return (
    <span
      className="avatar"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Foto de ${name}`}
    >
      {src && src !== failedSrc ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        initials
      )}
    </span>
  );
}
Avatar.propTypes = {
  src: stringProp,
  name: stringProp,
  size: (props, key) =>
    typeof props[key] === "number" || props[key] == null
      ? null
      : new Error("size debe ser un número"),
};
export function StatePanel({
  title,
  description,
  loading = false,
  onRetry,
  children,
}) {
  return (
    <div className="state-panel" role={loading ? "status" : undefined}>
      <span className="state-symbol">
        {loading ? (
          <LoaderCircle className="spinner" size={27} />
        ) : (
          <Heart size={27} strokeWidth={1.5} />
        )}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      )}
      {children}
    </div>
  );
}
StatePanel.propTypes = {
  title: stringProp,
  description: stringProp,
  onRetry: functionProp,
  children: () => null,
  loading: boolProp,
};
export function BackHome() {
  return (
    <Link className="button button-primary" to="/">
      Volver a descubrir
      <ArrowRight size={16} />
    </Link>
  );
}
