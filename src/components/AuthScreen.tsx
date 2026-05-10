import brandLogo from "../../cajaenllamas.png";
import type { FormEvent } from "react";
import type { AuthMode, SessionState } from "../hooks/useFirebaseSession";

interface AuthScreenProps {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  sessionState: SessionState;
  authError: string | null;
  isSubmitting: boolean;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function AuthScreen({
  mode,
  email,
  password,
  confirmPassword,
  sessionState,
  authError,
  isSubmitting,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit
}: AuthScreenProps) {
  const title =
    sessionState === "not-configured"
      ? "Tu panel esta casi listo"
      : mode === "register"
        ? "Crea tu cuenta y empieza hoy"
        : "Pon tus cuentas en orden";
  const subtitle =
    sessionState === "not-configured"
      ? "Estamos preparando el acceso para que puedas entrar a tu panel financiero sin vueltas."
      : mode === "register"
        ? "Crea tu acceso personal y empieza a registrar prestamos, servicios y gastos mensuales en un solo lugar."
        : "Entra a tu espacio y sigue cuotas, servicios y pagos del mes desde una sola vista.";

  const helperText =
    sessionState === "loading"
      ? "Estamos comprobando si ya tienes una sesion abierta."
      : sessionState === "error"
        ? "Hubo un problema al validar el acceso. Vuelve a intentarlo."
        : mode === "register"
          ? "Crea tu acceso personal para llevar tus cuentas, prestamos y servicios sin mezclarlos."
          : "Ingresa con tu email y continua donde dejaste tus cuentas.";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="auth-shell">
      <div className="page-backdrop" />

      <section className="auth-stage">
        <div className="auth-hero">
          <div className="auth-hero__brand">
            <img className="auth-hero__logo" src={brandLogo} alt="Caja en Llamas" />
          </div>
          <p className="eyebrow">Caja en Llamas</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="auth-highlights">
            <article className="quick-card">
              <strong>Todas tus cuentas en un solo lugar</strong>
              <span>Reune prestamos, servicios y gastos del mes en una vista clara y facil de seguir.</span>
            </article>
            <article className="quick-card">
              <strong>Menos vueltas, mas control</strong>
              <span>Mira que pagaste, que falta y cual es tu proximo foco sin perderte entre notas sueltas.</span>
            </article>
          </div>
        </div>

        <section className="auth-card">
          <p className="eyebrow">{mode === "register" ? "Registro" : "Ingreso"}</p>
          <h2>{mode === "register" ? "Crea tu acceso" : "Entra a tu panel"}</h2>
          <p className="auth-card__subtitle">{helperText}</p>

          <div className="auth-mode-toggle" role="tablist" aria-label="Modo de acceso">
            <button
              type="button"
              className={`auth-mode-toggle__button ${mode === "login" ? "is-active" : ""}`}
              aria-pressed={mode === "login"}
              onClick={() => onModeChange("login")}
            >
              Ingresar
            </button>
            <button
              type="button"
              className={`auth-mode-toggle__button ${mode === "register" ? "is-active" : ""}`}
              aria-pressed={mode === "register"}
              onClick={() => onModeChange("register")}
            >
              Crear cuenta
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                placeholder="luifer.gv@gmail.com"
                autoComplete="email"
                disabled={sessionState === "not-configured" || isSubmitting}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Contrasena</span>
              <input
                type="password"
                value={password}
                placeholder="Ingresa tu contrasena"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                disabled={sessionState === "not-configured" || isSubmitting}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </label>

            {mode === "register" ? (
              <label className="field">
                <span>Confirmar contrasena</span>
                <input
                  type="password"
                  value={confirmPassword}
                  placeholder="Repite la contrasena"
                  autoComplete="new-password"
                  disabled={sessionState === "not-configured" || isSubmitting}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                />
              </label>
            ) : null}

            {authError ? <p className="auth-form__error">{authError}</p> : null}

            <button
              type="submit"
              className="primary-button auth-form__submit"
              disabled={sessionState === "not-configured" || isSubmitting}
            >
              {isSubmitting
                ? mode === "register"
                  ? "Creando cuenta..."
                  : "Validando acceso..."
                : mode === "register"
                  ? "Crear cuenta"
                  : "Ingresar al sistema"}
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
