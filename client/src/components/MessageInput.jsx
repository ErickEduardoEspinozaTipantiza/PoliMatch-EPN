import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Smile, X } from "lucide-react";
import { useMessageStore } from "../store/useMessageStore";
import { objectProp } from "./propValidation";
const EmojiPicker = lazy(() => import("emoji-picker-react"));
const MessageInput = ({ match }) => {
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  const pickerRef = useRef(null);
  const pickerButton = useRef(null);
  const inputRef = useRef(null);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const sending = useMessageStore((state) => state.sending);
  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (event) => {
      if (
        !pickerRef.current?.contains(event.target) &&
        !pickerButton.current?.contains(event.target)
      )
        setPickerOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setPickerOpen(false);
        pickerButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [pickerOpen]);
  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    const outgoing = message;
    setSendError("");
    setPickerOpen(false);
    if (await sendMessage(match._id, outgoing)) {
      setMessage((current) => (current === outgoing ? "" : current));
      inputRef.current?.focus();
    } else
      setSendError(
        "No se envió tu mensaje. Lo conservamos aquí: vuelve a intentar enviarlo.",
      );
  };
  return (
    <div>
      {sendError && (
        <p className="form-error chat-error" role="alert">
          {sendError}
        </p>
      )}
      <form className="message-composer" onSubmit={submit}>
        <button
          className="composer-emoji"
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          ref={pickerButton}
          aria-label={pickerOpen ? "Cerrar emojis" : "Elegir un emoji"}
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? "emoji-picker" : undefined}
        >
          {pickerOpen ? <X size={20} /> : <Smile size={21} />}
        </button>
        <label className="sr-label" htmlFor="message-text">
          Escribe un mensaje
        </label>
        <textarea
          id="message-text"
          ref={inputRef}
          rows={1}
          className="message-textarea"
          placeholder="Escribe un mensaje…"
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit(event);
            }
          }}
          aria-describedby="message-help"
        />
        <button
          className="composer-send"
          type="submit"
          aria-label={sending ? "Enviando mensaje" : "Enviar mensaje"}
          disabled={sending || !message.trim()}
        >
          {sending ? (
            <LoaderCircle className="spinner" size={19} />
          ) : (
            <Send size={19} />
          )}
        </button>
        {pickerOpen && (
          <div
            className="emoji-popover"
            id="emoji-picker"
            ref={pickerRef}
            style={{ width: 340 }}
            role="region"
            aria-label="Selector de emojis"
          >
            <Suspense
              fallback={
                <p className="form-error" role="status">
                  Cargando emojis…
                </p>
              }
            >
              <EmojiPicker
                width="100%"
                height={360}
                searchPlaceHolder="Buscar emoji"
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji) => {
                  setMessage((current) =>
                    (current + emoji.emoji).slice(0, 2000),
                  );
                  inputRef.current?.focus();
                }}
              />
            </Suspense>
          </div>
        )}
      </form>
      <p className="composer-note" id="message-help">
        Enter para enviar · Mayús + Enter para otra línea · Máximo 2000
        caracteres
      </p>
    </div>
  );
};
MessageInput.propTypes = { match: objectProp };
export default MessageInput;
