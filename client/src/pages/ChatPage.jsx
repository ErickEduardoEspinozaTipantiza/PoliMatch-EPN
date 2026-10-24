import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Heart, LoaderCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import Sidebar from "../components/Sidebar";
import MessageInput from "../components/MessageInput";
import { Avatar, BackHome, StatePanel } from "../components/UI";
import { useAuthStore } from "../store/useAuthStore";
import { useMatchStore } from "../store/useMatchStore";
import { useMessageStore } from "../store/useMessageStore";
const formatTime = (value) =>
  new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const ChatPage = () => {
  const { id } = useParams();
  const user = useAuthStore((state) => state.authUser);
  const matches = useMatchStore((state) => state.matches);
  const getMatches = useMatchStore((state) => state.getMyMatches);
  const matchesLoading = useMatchStore((state) => state.isLoadingMyMatches);
  const matchesError = useMatchStore((state) => state.matchesError);
  const messages = useMessageStore((state) => state.messages);
  const activeConversation = useMessageStore(
    (state) => state.activeConversation,
  );
  const loading = useMessageStore((state) => state.loading);
  const error = useMessageStore((state) => state.error);
  const hasMore = useMessageStore((state) => state.hasMore);
  const loadingOlder = useMessageStore((state) => state.loadingOlder);
  const getMessages = useMessageStore((state) => state.getMessages);
  const loadOlderMessages = useMessageStore((state) => state.loadOlderMessages);
  const subscribe = useMessageStore((state) => state.subscribeToMessages);
  const clear = useMessageStore((state) => state.clearConversation);
  const [started, setStarted] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const viewport = useRef(null);
  const nearBottom = useRef(true);
  const initialScroll = useRef(false);
  const previousCount = useRef(0);
  const restoreScroll = useRef(null);
  const match = matches.find((person) => person._id === id);
  useEffect(() => {
    setStarted(true);
    getMatches();
  }, [getMatches]);
  useEffect(() => {
    nearBottom.current = true;
    initialScroll.current = false;
    previousCount.current = 0;
    restoreScroll.current = null;
    setShowJump(false);
    getMessages(id);
    const cleanup = subscribe();
    return () => {
      cleanup?.();
      clear();
    };
  }, [id, getMessages, subscribe, clear]);
  useLayoutEffect(() => {
    const container = viewport.current;
    if (!container || activeConversation !== id || loading) return;
    if (restoreScroll.current && !loadingOlder) {
      container.scrollTop =
        restoreScroll.current.top +
        container.scrollHeight -
        restoreScroll.current.height;
      restoreScroll.current = null;
    } else if (!initialScroll.current || nearBottom.current) {
      container.scrollTop = container.scrollHeight;
      initialScroll.current = true;
      setShowJump(false);
    } else if (messages.length > previousCount.current && !loadingOlder)
      setShowJump(true);
    previousCount.current = messages.length;
  }, [messages, loading, loadingOlder, activeConversation, id, match]);
  const older = () => {
    if (viewport.current)
      restoreScroll.current = {
        top: viewport.current.scrollTop,
        height: viewport.current.scrollHeight,
      };
    loadOlderMessages();
  };
  const jump = () => {
    if (viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
    nearBottom.current = true;
    setShowJump(false);
  };
  const waiting = !started || matchesLoading || activeConversation !== id;
  return (
    <div className="app-shell chat-shell">
      <div className="chat-page">
        <Header />
        <main id="main-content" className="chat-layout">
          <Sidebar />
          {!match ? (
            <section className="conversation">
              <StatePanel
                loading={waiting}
                title={
                  waiting
                    ? "Abriendo tu conversación"
                    : matchesError
                      ? "No pudimos cargar la conexión"
                      : "No encontramos esta conexión"
                }
                description={
                  waiting
                    ? "Un momento, estamos preparando el chat."
                    : matchesError ||
                      "Solo puedes conversar con personas con las que hayas conectado."
                }
                onRetry={!waiting && matchesError ? getMatches : undefined}
              >
                {!waiting && !matchesError && <BackHome />}
              </StatePanel>
            </section>
          ) : (
            <section
              className="conversation"
              aria-label={`Conversación con ${match.name}`}
            >
              <header className="conversation-header">
                <Link
                  className="conversation-back"
                  to="/#conexiones"
                  aria-label="Volver a conexiones"
                >
                  <ArrowLeft size={19} />
                </Link>
                <Avatar src={match.image} name={match.name} size={44} />
                <div>
                  <h1>{match.name}</h1>
                  <p>Una conexión, muchas posibilidades.</p>
                </div>
                <span className="match-status">
                  <Heart size={12} />
                  Interés mutuo
                </span>
              </header>
              <div
                ref={viewport}
                className="conversation-messages"
                aria-label="Historial de mensajes"
                tabIndex={0}
                onScroll={() => {
                  const container = viewport.current;
                  nearBottom.current =
                    container.scrollHeight -
                      container.scrollTop -
                      container.clientHeight <
                    90;
                  if (nearBottom.current) setShowJump(false);
                }}
              >
                {loading || activeConversation !== id ? (
                  <StatePanel
                    loading
                    title="Cargando mensajes"
                    description="Estamos recuperando su conversación."
                  />
                ) : error ? (
                  <StatePanel
                    title="No pudimos cargar los mensajes"
                    description={error}
                    onRetry={() => getMessages(id)}
                  />
                ) : !messages.length ? (
                  <StatePanel
                    title={`Saluda a ${match.name}`}
                    description="Ya tienen algo en común: las ganas de conocerse. Un hola puede ser un buen comienzo."
                  />
                ) : (
                  <>
                    {hasMore && (
                      <button
                        className="button button-secondary load-older"
                        disabled={loadingOlder}
                        onClick={older}
                      >
                        {loadingOlder && (
                          <LoaderCircle size={14} className="spinner" />
                        )}
                        {loadingOlder ? "Cargando…" : "Ver mensajes anteriores"}
                      </button>
                    )}
                    <p className="conversation-start">
                      Todo empieza con una buena conversación.
                    </p>
                    {messages.map((message) => {
                      const dateValid =
                        message.createdAt &&
                        !Number.isNaN(new Date(message.createdAt).getTime());
                      const own = message.sender === user._id;
                      return (
                        <div
                          key={message._id}
                          className={`message-row ${own ? "mine" : ""}`}
                        >
                          <p className="message-bubble">
                            <span className="sr-label">
                              {own ? "Tú" : match.name}:{" "}
                            </span>
                            {message.content}
                          </p>
                          {dateValid && (
                            <time
                              className="message-time"
                              dateTime={message.createdAt}
                              title={new Date(message.createdAt).toLocaleString(
                                "es-EC",
                              )}
                            >
                              {formatTime(message.createdAt)}
                            </time>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {showJump && (
                <div className="conversation-scroll">
                  <button className="button button-secondary" onClick={jump}>
                    <ArrowDown size={14} />
                    Bajar al último mensaje
                  </button>
                </div>
              )}
              <div className="conversation-footer">
                <MessageInput key={id} match={match} />
              </div>
              <p className="sr-label" role="status" aria-live="polite">
                {showJump
                  ? "Hay mensajes más recientes. Usa Bajar al último mensaje para verlos."
                  : ""}
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
export default ChatPage;
