import { useEffect, useRef } from "react";
import { Heart, MessageCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useMatchStore } from "../store/useMatchStore";
import { useAuthStore } from "../store/useAuthStore";
import { Avatar } from "./UI";
import "./match-celebration.css";

export default function MatchCelebration() {
  const person = useMatchStore((state) => state.matchQueue[0]);
  const busy = useMatchStore((state) => state.swipeAnimating);
  const dismiss = useMatchStore((state) => state.dismissMatch);
  const own = useAuthStore((state) => state.authUser);
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (!person || !own || busy || !node) return;
    node.showModal();
    return () => node.close();
  }, [person, own, busy]);
  if (!person || !own) return null;
  return (
    <dialog
      ref={dialog}
      className="match-dialog"
      aria-labelledby="match-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section className="match-scene" key={person._id}>
        <button
          className="match-close icon-button"
          onClick={dismiss}
          aria-label="Cerrar celebración"
        >
          <X size={20} />
        </button>
        <div className="match-orbit" aria-hidden="true" />
        <p className="match-eyebrow">Dos personas. La misma chispa.</p>
        <div className="match-portraits" aria-hidden="true">
          <div className="match-portrait match-portrait-own">
            <Avatar src={own.image} name={own.name} size={150} />
          </div>
          <div className="match-portrait match-portrait-peer">
            <Avatar src={person.image} name={person.name} size={150} />
          </div>
          <span className="match-heart">
            <Heart fill="currentColor" size={30} />
          </span>
          <span className="match-sparks">
            {[-3, -2, -1, 1, 2, 3].map((i) => (
              <Heart
                key={i}
                style={{
                  "--spark-x": `${i * 42}px`,
                  "--spark-y": `${-70 - Math.abs(i) * 19}px`,
                  "--spark-turn": `${i * 23}deg`,
                }}
                size={14}
                fill="currentColor"
              />
            ))}
          </span>
        </div>
        <h2 id="match-title">
          Es <span>mutuo.</span>
        </h2>
        <p className="match-copy">
          Tú y <strong>{person.name}</strong> se gustan.
          <br />
          Lo que sigue empieza con un hola.
        </p>
        <Link
          to={`/chat/${person._id}`}
          className="button button-primary match-chat"
          onClick={dismiss}
        >
          <MessageCircle size={19} />
          Empezar a conversar
        </Link>
        <button className="match-continue" onClick={dismiss}>
          Seguir descubriendo
        </button>
      </section>
    </dialog>
  );
}
