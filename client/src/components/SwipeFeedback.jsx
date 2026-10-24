import { useMatchStore } from "../store/useMatchStore";
const SwipeFeedback = () => {
  const feedback = useMatchStore((state) => state.swipeFeedback);
  return (
    <p className="swipe-feedback" aria-live="polite" role="status">
      {feedback === "liked"
        ? "Te gusta. Si coinciden, podrán conversar."
        : feedback === "passed"
          ? "Pasaste este perfil. Sigamos descubriendo."
          : feedback === "matched"
            ? "¡Una nueva conexión!"
            : ""}
    </p>
  );
};
export default SwipeFeedback;
