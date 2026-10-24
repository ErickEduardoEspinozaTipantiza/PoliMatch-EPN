import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMatchStore } from "../store/useMatchStore";
import { Avatar, StatePanel } from "./UI";
const Sidebar = () => {
  const matches = useMatchStore((state) => state.matches);
  const loading = useMatchStore((state) => state.isLoadingMyMatches);
  const error = useMatchStore((state) => state.matchesError);
  const retry = useMatchStore((state) => state.getMyMatches);
  const { id } = useParams();
  return (
    <aside
      className="connections-aside"
      id="conexiones"
      aria-labelledby="connections-title"
    >
      <div className="section-rule">
        <h2 id="connections-title">Tus conexiones</h2>
        {!loading && !error && (
          <span
            className="count-pill"
            aria-label={`${matches.length} conexiones`}
          >
            {matches.length}
          </span>
        )}
      </div>
      {loading && !matches.length ? (
        <StatePanel
          loading
          title="Buscando tus conexiones"
          description="Un momento, ya estamos aquí."
        />
      ) : error ? (
        <StatePanel
          title="No pudimos cargarlas"
          description={error}
          onRetry={retry}
        />
      ) : !matches.length ? (
        <StatePanel
          title="Aquí empieza una conexión"
          description="Cuando el interés sea mutuo, encontrarás aquí a esa persona para conversar."
        />
      ) : (
        <div className="connections-list">
          {matches.map((match) => (
            <Link
              className={`connection-row ${id === match._id ? "active" : ""}`}
              key={match._id}
              to={`/chat/${match._id}`}
              aria-current={id === match._id ? "page" : undefined}
            >
              <Avatar src={match.image} name={match.name} size={46} />
              <div className="connection-row-copy">
                <h3>{match.name}</h3>
                <p>
                  <MessageCircle
                    size={10}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  Empiecen a conversar
                </p>
              </div>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      <div className="aside-note">
        <Heart size={19} color="#C72C52" strokeWidth={1.5} />
        <h3 style={{ marginTop: 12 }}>
          Una conversación
          <br />
          puede cambiar tu día.
        </h3>
        <p>Ve a tu ritmo, sé tú y dale espacio a una conexión de verdad.</p>
      </div>
    </aside>
  );
};
export default Sidebar;
