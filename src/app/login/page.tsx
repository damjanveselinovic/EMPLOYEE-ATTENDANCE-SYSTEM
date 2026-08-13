"use client";

import { useState } from "react";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { isEmail } from "@/lib/date/validation";
import Link from "next/link";

//React komponenta
export default function LoginPage() {
  //2 hooka
  const router = useRouter();
  const { refresh } = useAuth();

  //state forme
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  //ui feedback state
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined
  );
  const [statusMsg, setStatusMsg] = useState<string>("");

  function validate() {
    let ok = true;

    if (!email.trim()) {
      setEmailError("Email je obavezan.");
      ok = false;
    } else if (!isEmail(email.trim())) {
      setEmailError("Email format nije ispravan.");
      ok = false;
    } else {
      setEmailError(undefined);
    }

    if (!password) {
      setPasswordError("Lozinka je obavezna.");
      ok = false;
    } else if (password.length < 4) {
      setPasswordError("Lozinka mora imati bar 4 karaktera.");
      ok = false;
    } else {
      setPasswordError(undefined);
    }

    return ok;
  }

  async function handleLogin() {
    setStatusMsg("");
    if (!validate()) return;

    setStatusMsg("Logujem...");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setStatusMsg(data?.error ?? "Login nije uspeo.");
      return;
    }

    // backend vraca user: { id, email, role }
    await refresh();

    setStatusMsg("Ulogovan. Prebacujem...");
    router.push("/attendance");
  }

  //sta se vidi na ekranu:
  return (
    <main className="authLayout">
      <h1 className="h1" style={{ fontSize: 28, marginBottom: 8 }}>
        Login
      </h1>
      <p className="h2" style={{ marginBottom: 24, fontSize: 16 }}>
        Unesi email i lozinku da pristupiš kalendaru.
      </p>

      <div
        className="card authCard"
        style={{
          maxWidth: 420,
          padding: "32px 36px",
          borderTop: "4px solid #4f46e5",
          boxShadow: "0 8px 32px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div className="authFormGroup" style={{ gap: 20 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="npr. marko@mail.com"
            error={emailError}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <div style={{ position: "relative" }}>
            <TextField
              label="Lozinka"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="••••"
              error={passwordError}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />

            <img
              src={
                showPassword
                  ? "/icons/password-eye/eye-off.svg"
                  : "/icons/password-eye/eye-on.svg"
              }
              alt="Toggle password visibility"
              onClick={() => setShowPassword((s) => !s)}
              style={{
                position: "absolute",
                right: 12,
                top: 42,
                width: 20,
                height: 20,
                cursor: "pointer",
                opacity: 0.7,
              }}
            />
          </div>

          <p className="muted authFooter">
            Nemaš nalog?{" "}
            <Link href="/register" style={{ textDecoration: "underline" }}>
              Registruj se ovde
            </Link>
          </p>

          <div className="row" style={{ marginTop: 8 }}>
            <Button variant="primary" onClick={handleLogin}>
              Login
            </Button>
            {statusMsg ? <span className="muted">{statusMsg}</span> : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "8px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span className="muted" style={{ fontSize: 13 }}>
              ili
            </span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <a
            href="/api/auth/google"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              textDecoration: "none",
              color: "#1f2937",
              fontSize: 14,
              fontWeight: 500,
              background: "#fff",
              transition: "background 0.15s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.61z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 009 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
              />
            </svg>
            Nastavi sa Google nalogom
          </a>
        </div>
      </div>
      <img
        src="/slides/stickmans-line.png"
        alt="Login ilustracija"
        style={{
          marginTop: 24,
          maxWidth: 1200,
          width: "100%",
          opacity: 0.9,
          borderRadius: 12,
        }}
      />
    </main>
  );
}
