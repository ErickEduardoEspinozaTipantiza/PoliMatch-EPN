import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import {
  INTERESTS,
  MAX_INTERESTS,
  RELATIONSHIP_GOALS,
} from "../../../shared/profile-options";
import "../dating-onboarding.css";
import { objectProp, functionProp, boolProp } from "./propValidation";

export function ProfileChoices({ form, setForm, disabled = false }) {
  return (
    <>
      <fieldset className="choice-group" disabled={disabled}>
        <legend>¿Qué te gustaría encontrar?</legend>
        <div className="intent-options">
          {RELATIONSHIP_GOALS.map(({ value, label }) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name="relationshipGoal"
                value={value}
                checked={form.relationshipGoal === value}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    relationshipGoal: value,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-group" disabled={disabled}>
        <legend>
          Tus intereses · {form.interests.length}/{MAX_INTERESTS}
        </legend>
        <p className="field-help">
          Elige hasta cinco. Una buena conversación puede empezar aquí.
        </p>
        <div className="interest-options">
          {INTERESTS.map((interest) => {
            const selected = form.interests.includes(interest);
            return (
              <button
                className="interest-chip"
                type="button"
                key={interest}
                aria-pressed={selected}
                disabled={
                  disabled ||
                  (!selected && form.interests.length >= MAX_INTERESTS)
                }
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    interests: selected
                      ? current.interests.filter((item) => item !== interest)
                      : [...current.interests, interest],
                  }))
                }
              >
                {interest}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
ProfileChoices.propTypes = {
  form: objectProp,
  setForm: functionProp,
  disabled: boolProp,
};
const headings = [
  "Empecemos por ti.",
  "Tu manera de conectar.",
  "Una conexión a tu medida.",
  "Dale voz a tu perfil.",
];
const SignUpForm = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    genderPreference: "",
    relationshipGoal: "",
    interests: [],
    bio: "",
    city: "",
    university: "",
  });
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const title = useRef(null);
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);
  const loading = useAuthStore((state) => state.loading);
  const update = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  const go = (next) => {
    setStep(next);
    setError("");
    requestAnimationFrame(() => title.current?.focus());
  };
  const submit = async (event) => {
    event.preventDefault();
    if (step === 0 && !form.name.trim()) {
      setError("Escribe tu nombre para continuar.");
      return;
    }
    if (step === 0 && new TextEncoder().encode(form.password).length > 72) {
      setError("La contraseña es demasiado larga. Usa menos caracteres.");
      return;
    }
    if (step < 3) {
      go(step + 1);
      return;
    }
    setError("");
    navigate("/auth", { replace: true, state: { onboarding: true } });
    if (
      !(await signup({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        age: Number(form.age),
      }))
    )
      setError(
        "No pudimos crear tu cuenta. Tus datos siguen aquí; vuelve a intentarlo.",
      );
  };
  return (
    <form className="auth-form signup-wizard" onSubmit={submit}>
      <div className="onboarding-progress">
        <span>Paso {step + 1} de 5</span>
        <span>
          {["Tu cuenta", "Preferencias", "Conexiones", "Sobre ti"][step]}
        </span>
        <div className="progress-segments" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <i key={index} className={index <= step ? "is-complete" : ""} />
          ))}
        </div>
      </div>
      <fieldset key={step} className="wizard-step" disabled={loading}>
        <h2 ref={title} tabIndex={-1}>
          {headings[step]}
        </h2>
        {step === 0 && (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Tu nombre</label>
                <input
                  id="name"
                  className="input"
                  name="name"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={update}
                  placeholder="Cómo te llamas"
                />
              </div>
              <div className="field">
                <label htmlFor="age">Edad</label>
                <input
                  id="age"
                  className="input"
                  name="age"
                  type="number"
                  min={18}
                  max={120}
                  required
                  value={form.age}
                  onChange={update}
                  placeholder="18+"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update}
                placeholder="tu@correo.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <div className="password-wrap">
                <input
                  id="password"
                  className="input"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  required
                  value={form.password}
                  onChange={update}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="field-help">
                Al menos 6 caracteres. Solo para mayores de 18 años.
              </p>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            {[
              [
                "gender",
                "Tu género",
                [
                  ["male", "Hombre"],
                  ["female", "Mujer"],
                ],
              ],
              [
                "genderPreference",
                "Me gustaría conocer",
                [
                  ["male", "Hombres"],
                  ["female", "Mujeres"],
                  ["both", "Ambos"],
                ],
              ],
            ].map(([name, label, options]) => (
              <fieldset className="choice-group" key={name}>
                <legend>{label}</legend>
                <div className="choices">
                  {options.map(([value, text]) => (
                    <label className="choice" key={value}>
                      <input
                        type="radio"
                        name={name}
                        required
                        value={value}
                        checked={form[name] === value}
                        onChange={update}
                      />
                      {text}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="field-help">
              Podrás cambiar tus preferencias en tu perfil.
            </p>
          </>
        )}
        {step === 2 && <ProfileChoices form={form} setForm={setForm} />}
        {step === 3 && (
          <>
            <p className="field-help">
              Comparte lo que quieras. Puedes completar estos datos más tarde.
            </p>
            <div className="form-grid">
              {[
                ["city", "Ciudad", 80],
                ["university", "Universidad", 120],
              ].map(([name, label, max]) => (
                <div className="field" key={name}>
                  <label htmlFor={name}>{label}</label>
                  <input
                    id={name}
                    className="input"
                    name={name}
                    maxLength={max}
                    value={form[name]}
                    onChange={update}
                  />
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor="signup-bio">Biografía</label>
              <textarea
                className="input"
                id="signup-bio"
                name="bio"
                maxLength={500}
                rows={4}
                value={form.bio}
                onChange={update}
                placeholder="Mi plan perfecto después de clases es…"
              />
              <span className="character-count">{form.bio.length}/500</span>
            </div>
            <p className="field-help">
              Después de crear tu cuenta, añade tus fotos.
            </p>
          </>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="wizard-actions">
        {step > 0 && (
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={() => go(step - 1)}
          >
            <ArrowLeft size={16} />
            Atrás
          </button>
        )}
        <button
          className="button button-primary"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <>
              <LoaderCircle size={16} className="spinner" />
              Creando tu cuenta…
            </>
          ) : (
            <>
              {step === 3 ? "Crear mi cuenta" : "Continuar"}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
export default SignUpForm;
