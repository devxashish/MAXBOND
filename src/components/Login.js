import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import ADMIN_EMAILS from "../constants/adminEmails";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // 🚀 Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userEmail = user.email;
        if (ADMIN_EMAILS.includes(userEmail)) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Load saved credentials if Remember Me was checked
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedPassword = localStorage.getItem("rememberedPassword");

    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCredential.user.email;

      // Save or remove credentials
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberedPassword", password);
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
      }

      // Navigate after login
      if (ADMIN_EMAILS.includes(userEmail)) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg("❌ Invalid credentials. Please try again.");
    }

    setIsLoading(false);
  };

  return (
    <div className="ios-login-container">
      <div className="ios-login-card">
        <div className="ios-header">
          <h2 className="ios-title">Maxbond Login</h2>
        </div>

        <form onSubmit={handleLogin} className="ios-form">
          <div className="ios-input-group">
            <label htmlFor="email" className="ios-label">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ios-input"
            />
          </div>

          <div className="ios-input-group">
            <label htmlFor="password" className="ios-label">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="ios-input"
            />
          </div>

          <div className="ios-remember-container">
            <div className="ios-remember-group">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="ios-checkbox"
              />
              <label htmlFor="rememberMe" className="ios-remember-label">
                Remember me
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="ios-error">
              <p>{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            className={`ios-button ${isLoading ? "loading" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? <span className="ios-spinner"></span> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
