import { Compass, Heart, LogOut, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { Avatar, Brand } from "./UI";
export const Header = () => {
  const authUser = useAuthStore((state) => state.authUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.loading);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="nav-links" aria-label="Principal">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Compass size={17} />
              Descubrir
            </NavLink>
            <NavLink
              to="/connections"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Heart size={17} />
              Conexiones
            </NavLink>
          </nav>
          <div className="header-profile">
            <Link to="/profile" aria-label="Editar mi perfil">
              <Avatar src={authUser?.image} name={authUser?.name} size={38} />
            </Link>
            <Link className="profile-name" to="/profile">
              {authUser?.name}
            </Link>
            <button
              className="icon-button"
              onClick={logout}
              disabled={loading}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Principal móvil">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          <Compass size={20} />
          Descubrir
        </NavLink>
        <NavLink
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          to="/connections"
        >
          <Heart size={20} />
          Conexiones
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          <UserRound size={20} />
          Mi perfil
        </NavLink>
      </nav>
    </>
  );
};
