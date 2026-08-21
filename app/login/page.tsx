"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mesma validação do vanilla (js/login.js): formato de e-mail e senha com 6+
// caracteres. Continua sendo sessão simulada — o backend não autentica nada,
// get_current_user() devolve sempre "test_user_123".
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERRO: React.CSSProperties = {
  color: "var(--error)",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  marginLeft: 4,
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<{ email: boolean; senha: boolean }>({
    email: false,
    senha: false,
  });

  function entrar(evento: React.FormEvent) {
    evento.preventDefault();

    const falhas = {
      email: !PADRAO_EMAIL.test(email.trim()),
      senha: senha.length < 6,
    };
    setErros(falhas);
    if (falhas.email || falhas.senha) return;

    localStorage.setItem("jovi_session", "active");
    localStorage.setItem("jovi_user_email", email.trim());
    router.push("/");
  }

  return (
    // .login-screen era classe do <body> no vanilla; aqui o <body> pertence ao
    // layout raiz, então a tela inteira vira este wrapper.
    <div className="login-screen" style={{ minHeight: "100vh" }}>
      <main className="login-card">
        <div className="text-center">
          <div className="flex items-center justify-center" style={{ marginBottom: 24 }}>
            <div
              className="shutter-glow"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(255, 255, 255, 0.08)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                document_scanner
              </span>
            </div>
          </div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: -2,
              textTransform: "uppercase",
            }}
          >
            JOVI
          </h1>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "var(--on-surface-variant)",
              opacity: 0.6,
              marginTop: 8,
            }}
          >
            Insight Capture System
          </p>
        </div>

        <form
          onSubmit={entrar}
          noValidate
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 24 }}
        >
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <div className="form-input-container">
              <span className="material-symbols-outlined">mail</span>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="nome@exemplo.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={erros.email || undefined}
                aria-describedby={erros.email ? "email-error" : undefined}
              />
            </div>
            {erros.email && (
              <p id="email-error" style={ERRO} role="alert">
                Email inválido
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Access Key
            </label>
            <div className="form-input-container">
              <span className="material-symbols-outlined">lock</span>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={erros.senha || undefined}
                aria-describedby={erros.senha ? "password-error" : undefined}
              />
            </div>
            {erros.senha && (
              <p id="password-error" style={ERRO} role="alert">
                Mínimo 6 caracteres
              </p>
            )}
          </div>

          <button type="submit" className="primary-btn">
            Authorize Access
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              login
            </span>
          </button>
        </form>
      </main>
    </div>
  );
}
