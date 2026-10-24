import { useEffect, useRef, useState } from "react";
import {
  Heart,
  X,
  LoaderCircle,
  GraduationCap,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMatchStore } from "../store/useMatchStore";
import { objectProp, functionProp, boolProp } from "./propValidation";
import "./swipe-motion.css";
import { RELATIONSHIP_GOALS } from "../../../shared/profile-options";

function PersonCard({ user, interactive }) {
  const photos = [
    ...new Set(
      [...(user.photos || []), user.image].filter(
        (value) => typeof value === "string" && value,
      ),
    ),
  ];
  const [photo, setPhoto] = useState(0);
  const [failed, setFailed] = useState({});
  const source = photos[photo];
  return (
    <article
      className="person-card"
      aria-label={`${user.name}, ${user.age} años`}
    >
      {source && !failed[source] ? (
        <img
          className="person-photo"
          src={source}
          alt={`Foto de ${user.name}`}
          onError={() => setFailed((old) => ({ ...old, [source]: true }))}
          draggable={false}
        />
      ) : (
        <div className="person-photo-fallback" aria-hidden="true">
          {user.name?.slice(0, 1).toUpperCase()}
        </div>
      )}
      {photos.length > 1 && (
        <>
          <div className="person-photo-progress" aria-hidden="true">
            {photos.map((url, index) => (
              <span key={url} className={index === photo ? "active" : ""} />
            ))}
          </div>
          <div className="person-gallery-controls">
            <button
              type="button"
              aria-label="Foto anterior"
              disabled={!interactive || photo === 0}
              onClick={() => setPhoto((index) => index - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <span
              className="sr-label"
              aria-live={interactive ? "polite" : "off"}
            >
              Foto {photo + 1} de {photos.length}
            </span>
            <button
              type="button"
              aria-label="Foto siguiente"
              disabled={!interactive || photo === photos.length - 1}
              onClick={() => setPhoto((index) => index + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
      <div className="person-info">
        <div className="person-tag">
          <GraduationCap size={13} />
          {user.university || "Por descubrir"}
        </div>
        <h2>
          {user.name}
          <span>, {user.age}</span>
        </h2>
        {user.city && (
          <p className="person-location">
            <MapPin size={13} />
            {user.city}
          </p>
        )}
        {user.bio && <p className="person-bio">{user.bio}</p>}
        {(user.relationshipGoal || user.interests?.length > 0) && (
          <div className="person-interests">
            {[
              RELATIONSHIP_GOALS.find(
                (goal) => goal.value === user.relationshipGoal,
              )?.label,
              ...(user.interests || []),
            ]
              .filter(Boolean)
              .slice(0, 4)
              .map((interest, index) => (
                <span key={`${interest}-${index}`}>{interest}</span>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}
PersonCard.propTypes = { user: objectProp, interactive: boolProp };
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pose = (x, y = 0) =>
  `translate3d(${x}px, ${y}px, 0) rotate(${Math.max(-18, Math.min(18, x / 24))}deg)`;

const SwipeArea = ({ onBusyChange }) => {
  const profiles = useMatchStore((state) => state.userProfiles);
  const swipeRight = useMatchStore((state) => state.swipeRight);
  const swipeLeft = useMatchStore((state) => state.swipeLeft);
  const swipingId = useMatchStore((state) => state.swipingId);
  const [outgoing, setOutgoing] = useState(null);
  const [phase, setPhase] = useState("idle");
  const pending = useRef(false);
  const nodes = useRef(new Map());
  const gesture = useRef(null);
  const frame = useRef(0);
  const mounted = useRef(true);
  const animations = useRef(new Set());
  const current = outgoing || profiles[0];
  const deck = (
    outgoing
      ? [outgoing, ...profiles.filter((user) => user._id !== outgoing._id)]
      : profiles
  ).slice(0, 3);
  const busy = phase !== "idle" || Boolean(swipingId);
  useEffect(() => {
    mounted.current = true;
    const activeAnimations = animations.current;
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame.current);
      activeAnimations.forEach((animation) => animation.cancel());
    };
  }, []);

  function paint(node, x, y = 0) {
    node.style.transform = pose(x, y);
    node.style.setProperty("--like-opacity", Math.min(1, Math.max(0, x / 110)));
    node.style.setProperty(
      "--pass-opacity",
      Math.min(1, Math.max(0, -x / 110)),
    );
  }
  async function animate(node, transform, duration, easing) {
    const animation = node.animate(
      [{ transform: getComputedStyle(node).transform }, { transform }],
      { duration: reducedMotion() ? 1 : duration, easing, fill: "forwards" },
    );
    animations.current.add(animation);
    let completed = false;
    try {
      await animation.finished;
      completed = true;
    } catch {
      /* A new drag or navigation can interrupt motion. */
    }
    if (completed && mounted.current) node.style.transform = transform;
    animation.cancel();
    animations.current.delete(animation);
    return completed;
  }
  async function settle(node) {
    const completed = await animate(
      node,
      pose(0),
      300,
      "cubic-bezier(.2,.9,.25,1)",
    );
    if (!completed || !mounted.current) return;
    paint(node, 0);
  }
  async function swipe(direction) {
    if (pending.current || swipingId || !current) return;
    const node = nodes.current.get(current._id);
    if (!node) return;
    const interruptedTransform = getComputedStyle(node).transform;
    for (const animation of node.getAnimations())
      if (animations.current.has(animation)) animation.cancel();
    node.style.transform = interruptedTransform;
    cancelAnimationFrame(frame.current);
    gesture.current = null;
    pending.current = true;
    const focus = document.activeElement;
    setOutgoing(current);
    setPhase("leaving");
    onBusyChange?.(true);
    const sign = direction === "right" ? 1 : -1;
    node.style.setProperty(sign > 0 ? "--like-opacity" : "--pass-opacity", 1);
    const flight = animate(
      node,
      pose(sign * node.offsetWidth * 1.8, 60),
      430,
      "cubic-bezier(.32,.02,.68,.65)",
    );
    const request = Promise.resolve()
      .then(() =>
        direction === "right" ? swipeRight(current) : swipeLeft(current),
      )
      .catch(() => false);
    const [, success] = await Promise.all([flight, request]);
    if (!mounted.current) return;
    if (!success) {
      setPhase("returning");
      await animate(node, pose(0), 340, "cubic-bezier(.16,1,.3,1)");
      if (!mounted.current) return;
      paint(node, 0);
    }
    setOutgoing(null);
    setPhase("idle");
    pending.current = false;
    onBusyChange?.(false);
    // Disabled controls can lose focus in Chromium; restore only if the user
    // has not deliberately moved elsewhere while the request was pending.
    if (focus?.classList.contains("swipe-button"))
      requestAnimationFrame(() => {
        if (
          mounted.current &&
          focus.isConnected &&
          (document.activeElement === document.body ||
            document.activeElement === focus)
        )
          focus.focus({ preventScroll: true });
      });
  }
  function pointerDown(event) {
    if (
      busy ||
      pending.current ||
      event.button !== 0 ||
      event.target.closest("button")
    )
      return;
    const node = event.currentTarget;
    const position = new DOMMatrix(getComputedStyle(node).transform);
    for (const animation of node.getAnimations())
      if (animations.current.has(animation)) animation.cancel();
    paint(node, position.m41, position.m42);
    gesture.current = {
      id: event.pointerId,
      x: event.clientX - position.m41,
      y: event.clientY,
      dx: position.m41,
      dy: 0,
      horizontal: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    if (
      !drag.horizontal &&
      Math.abs(drag.dy) > Math.abs(drag.dx) &&
      Math.abs(drag.dy) > 8
    ) {
      gesture.current = null;
      return;
    }
    if (Math.abs(drag.dx) > 8) drag.horizontal = true;
    if (!drag.horizontal) return;
    const node = event.currentTarget;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      paint(node, drag.dx, drag.dy * 0.22),
    );
  }
  function pointerEnd(event, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    if (!drag.horizontal) return;
    paint(event.currentTarget, drag.dx, drag.dy * 0.22);
    if (
      !cancelled &&
      Math.abs(drag.dx) >= Math.min(100, event.currentTarget.offsetWidth * 0.28)
    )
      void swipe(drag.dx > 0 ? "right" : "left");
    else void settle(event.currentTarget);
  }
  return (
    <>
      <div
        className="swipe-stack motion-deck"
        aria-busy={busy}
        data-phase={phase}
      >
        {deck
          .map((user, index) => ({ user, index }))
          .reverse()
          .map(({ user, index }) => (
            <div
              key={user._id}
              ref={(node) => {
                if (node) nodes.current.set(user._id, node);
                else nodes.current.delete(user._id);
              }}
              className={`swipe-card-wrapper ${index === 0 ? "is-front" : "is-behind"}`}
              style={{
                zIndex: 3 - index,
                "--depth": Math.max(0, index - (phase === "leaving" ? 1 : 0)),
                pointerEvents: index === 0 && !busy ? "auto" : "none",
              }}
              aria-hidden={index !== 0}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={(event) => pointerEnd(event, true)}
              onLostPointerCapture={(event) => pointerEnd(event, true)}
            >
              <PersonCard user={user} interactive={index === 0 && !busy} />
              <span className="swipe-stamp like-stamp" aria-hidden="true">
                LIKE
              </span>
              <span className="swipe-stamp pass-stamp" aria-hidden="true">
                PASS
              </span>
            </div>
          ))}
      </div>
      <div className="swipe-actions" aria-label="Decidir sobre este perfil">
        <button
          className="swipe-button"
          disabled={busy || !current}
          onClick={() => swipe("left")}
          aria-label={`Pasar a ${current?.name || "este perfil"}`}
          title="Pasar"
        >
          <X size={27} strokeWidth={1.8} />
        </button>
        <span className="swipe-action-caption" aria-hidden="true">
          ¿Hay química?
        </span>
        <button
          className="swipe-button like"
          disabled={busy || !current}
          onClick={() => swipe("right")}
          aria-label={`Me gusta ${current?.name || "este perfil"}`}
          title="Me gusta"
        >
          {busy ? (
            <LoaderCircle size={26} className="spinner" />
          ) : (
            <Heart size={29} fill="currentColor" strokeWidth={1.5} />
          )}
        </button>
      </div>
      <p className="swipe-hint">Desliza o usa los botones. Tú eliges.</p>
    </>
  );
};
SwipeArea.propTypes = { onBusyChange: functionProp };
export default SwipeArea;
