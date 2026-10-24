import { useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Save } from "lucide-react";
import { Header } from "../components/Header";
import { Avatar } from "../components/UI";
import { useAuthStore } from "../store/useAuthStore";
import { useUserStore } from "../store/useUserStore";
import { Link } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { sessionGeneration } from "../lib/session";
import { ProfileChoices } from "../components/SignUpForm";
import "../dating-onboarding.css";
import { boolProp } from "../components/propValidation";
const valuesFromUser = (user) => ({
  name: user.name || "",
  bio: user.bio || "",
  age: user.age || "",
  gender: user.gender || "",
  genderPreference: Array.isArray(user.genderPreference)
    ? user.genderPreference.length > 1
      ? "both"
      : user.genderPreference[0] || ""
    : user.genderPreference || "",
  image: user.image || "",
  relationshipGoal: user.relationshipGoal || "",
  interests: user.interests || [],
  city: user.city || "",
  university: user.university || "",
});
const ProfilePage = ({ onboarding = false }) => {
  const user = useAuthStore((state) => state.authUser);
  const loading = useUserStore((state) => state.loading);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const [form, setForm] = useState(() => valuesFromUser(user));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const galleryInput = useRef(null);
  const photos = user.photos?.length
    ? user.photos
    : user.image
      ? [user.image]
      : [];
  const busy = loading || uploading || reading;
  const savePhotos = async (next) => {
    setError("");
    if (await updateProfile({ photos: next }))
      setForm((current) => ({ ...current, image: next[0] || "" }));
    else setError("No pudimos actualizar tus fotos. Vuelve a intentarlo.");
  };
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Elige una imagen JPEG, PNG o WebP de hasta 2 MB.");
      return;
    }
    const generation = sessionGeneration();
    setUploading(true);
    setError("");
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No pudimos leer la imagen."));
        reader.readAsDataURL(file);
      });
      if (generation !== sessionGeneration()) return;
      const response = await axiosInstance.post("/users/photos", { image });
      if (generation !== sessionGeneration()) return;
      useAuthStore.getState().setAuthUser(response.data.user);
      setForm((current) => ({
        ...current,
        image: response.data.user.image || "",
      }));
    } catch (err) {
      if (generation === sessionGeneration()) setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  const fileInput = useRef(null);
  const fileRequest = useRef(0);
  const readerRef = useRef(null);
  const update = (event) => {
    setSaved(false);
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };
  const changeImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSaved(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elige una imagen JPEG, PNG o WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen debe pesar como máximo 2 MB.");
      return;
    }
    readerRef.current?.abort();
    const request = ++fileRequest.current;
    const reader = new FileReader();
    readerRef.current = reader;
    setReading(true);
    reader.onload = () => {
      if (request === fileRequest.current) {
        setForm((current) => ({ ...current, image: reader.result }));
        setReading(false);
      }
    };
    reader.onerror = () => {
      if (request === fileRequest.current) {
        setError("No pudimos leer esa imagen. Prueba con otra.");
        setReading(false);
      }
    };
    reader.readAsDataURL(file);
  };
  const cancel = () => {
    fileRequest.current++;
    readerRef.current?.abort();
    setReading(false);
    setForm(valuesFromUser(user));
    setSaved(false);
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (!form.name.trim()) {
      setError("Escribe un nombre para tu perfil.");
      return;
    }
    const success = await updateProfile({
      ...form,
      name: form.name.trim(),
      age: Number(form.age),
    });
    if (success) {
      setForm(valuesFromUser(useAuthStore.getState().authUser));
      setSaved(true);
    } else
      setError(
        "No pudimos guardar los cambios. Tu información sigue aquí para volver a intentarlo.",
      );
  };
  return (
    <div className="app-shell">
      <Header />
      <main id="main-content" className="page-wrap">
        <div className="profile-intro">
          <p className="eyebrow">
            {onboarding ? "Paso 5 de 5 · Tus fotos" : "Un poco más de ti"}
          </p>
          <h1 className="display-title">
            Tu perfil, <span className="serif">tu esencia.</span>
          </h1>
          <p className="muted">
            Muestra quién eres. Una buena conexión empieza por ahí.
          </p>
        </div>
        <section className="profile-gallery" aria-label="Tus fotos">
          <div className="gallery-heading">
            <div>
              <h2>{onboarding ? "Ponle cara a tu historia." : "Tus fotos"}</h2>
              <p className="muted">
                Hasta 6 fotos. La primera será tu portada. Se guardan al
                añadirlas.
              </p>
            </div>
            <span>{photos.length}/6</span>
          </div>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div className="photo-slot" key={photo}>
                <img src={photo} alt={`Foto ${index + 1} de tu perfil`} />
                {index === 0 && <span className="photo-cover">Portada</span>}
                <div className="photo-controls">
                  {index > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        savePhotos([
                          photo,
                          ...photos.filter((item) => item !== photo),
                        ])
                      }
                      aria-label={`Hacer portada la foto ${index + 1}`}
                    >
                      Portada
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      savePhotos(photos.filter((item) => item !== photo))
                    }
                    aria-label={`Eliminar foto ${index + 1}`}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                type="button"
                className="photo-add"
                disabled={busy}
                onClick={() => galleryInput.current?.click()}
              >
                <Camera size={26} />
                <span>{uploading ? "Subiendo foto…" : "Añadir foto"}</span>
              </button>
            )}
          </div>
          <input
            hidden
            ref={galleryInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Añadir foto a la galería"
            disabled={busy}
            onChange={uploadPhoto}
          />
          <p className="field-help">JPEG, PNG o WebP · Máximo 2 MB por foto</p>
          {onboarding && (
            <Link
              className={`button button-primary onboarding-finish${busy ? " is-disabled" : ""}`}
              aria-disabled={busy}
              tabIndex={busy ? -1 : undefined}
              to="/"
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              {photos.length ? "Empezar a descubrir" : "Añadir fotos más tarde"}
            </Link>
          )}
        </section>
        {error && (
          <p role="alert" className="form-error gallery-error">
            {error}
          </p>
        )}
        {!onboarding && (
          <div className="profile-layout">
            <section
              className="profile-photo-panel"
              aria-label="Foto de perfil"
            >
              <Avatar src={form.image} name={form.name} size={164} />
              <h2>{form.name || "Tu nombre"}</h2>
              <p>
                Una foto en la que seas tú.
                <br />
                Sin complicaciones.
              </p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                <Camera size={16} />
                {reading ? "Leyendo imagen…" : "Cambiar foto"}
              </button>
              <input
                ref={fileInput}
                type="file"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={changeImage}
                aria-label="Seleccionar foto de perfil"
              />
              <p style={{ marginTop: 12, fontSize: 11 }}>
                JPEG, PNG o WebP · Máximo 2 MB
              </p>
            </section>
            <form className="profile-form" onSubmit={submit}>
              <fieldset className="profile-fields" disabled={uploading}>
                <div className="profile-form-header">
                  <h2>Así te conocerán</h2>
                  <p>Estos datos aparecerán en tu perfil.</p>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="profile-name">Nombre</label>
                    <input
                      id="profile-name"
                      disabled={loading}
                      className="input"
                      name="name"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                      value={form.name}
                      onChange={update}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-age">Edad</label>
                    <input
                      id="profile-age"
                      disabled={loading}
                      className="input"
                      name="age"
                      type="number"
                      inputMode="numeric"
                      min={18}
                      max={120}
                      required
                      value={form.age}
                      onChange={update}
                    />
                  </div>
                </div>
                <fieldset className="choice-group" disabled={loading}>
                  <legend>Tu género</legend>
                  <div className="choices">
                    {[
                      ["male", "Hombre"],
                      ["female", "Mujer"],
                    ].map(([value, label]) => (
                      <label className="choice" key={value}>
                        <input
                          type="radio"
                          name="gender"
                          required
                          value={value}
                          checked={form.gender === value}
                          onChange={update}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="choice-group" disabled={loading}>
                  <legend>Me gustaría conocer</legend>
                  <div className="choices">
                    {[
                      ["male", "Hombres"],
                      ["female", "Mujeres"],
                      ["both", "Ambos"],
                    ].map(([value, label]) => (
                      <label className="choice" key={value}>
                        <input
                          type="radio"
                          name="genderPreference"
                          required
                          value={value}
                          checked={form.genderPreference === value}
                          onChange={update}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor="profile-bio">Biografía</label>
                  <textarea
                    className="input"
                    id="profile-bio"
                    disabled={loading}
                    name="bio"
                    rows={4}
                    maxLength={500}
                    value={form.bio}
                    onChange={update}
                    placeholder="¿Qué te mueve? Un plan favorito, una curiosidad, algo muy tuyo…"
                    aria-describedby="bio-help"
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <p className="field-help" id="bio-help">
                      Un pequeño vistazo a tu mundo.
                    </p>
                    <span className="character-count">
                      {form.bio.length}/500
                    </span>
                  </div>
                </div>
                <div className="form-grid">
                  {[
                    ["city", "Ciudad", 80],
                    ["university", "Universidad", 120],
                  ].map(([name, label, max]) => (
                    <div className="field" key={name}>
                      <label htmlFor={`profile-${name}`}>{label}</label>
                      <input
                        className="input"
                        id={`profile-${name}`}
                        name={name}
                        maxLength={max}
                        value={form[name]}
                        onChange={update}
                        disabled={loading}
                      />
                    </div>
                  ))}
                </div>
                <ProfileChoices
                  form={form}
                  disabled={loading}
                  setForm={(next) => {
                    setSaved(false);
                    setForm(next);
                  }}
                />
                <div className="profile-save">
                  <p className="profile-status" role="status">
                    {saved && (
                      <>
                        <Check
                          size={15}
                          style={{ display: "inline", marginRight: 5 }}
                        />
                        Cambios guardados
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={cancel}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={loading || reading}
                  >
                    {loading ? (
                      <LoaderCircle className="spinner" size={17} />
                    ) : (
                      <Save size={16} />
                    )}
                    {loading ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
ProfilePage.propTypes = { onboarding: boolProp };
export default ProfilePage;
