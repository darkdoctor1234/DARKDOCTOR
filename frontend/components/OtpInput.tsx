"use client";

import { useEffect, useRef, useState } from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Bump this to make the boxes shake (e.g. on a wrong-code error). */
  shakeToken?: number;
}

export function OtpInput({ length = 6, value, onChange, autoFocus, disabled, shakeToken }: OtpInputProps) {
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [poppedIndex,  setPoppedIndex]  = useState<number | null>(null);
  const [shaking,      setShaking]      = useState(false);
  const [celebrating,  setCelebrating]  = useState(false);
  const prevShakeToken = useRef(shakeToken);

  useEffect(() => {
    if (shakeToken !== undefined && shakeToken !== prevShakeToken.current) {
      prevShakeToken.current = shakeToken;
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 420);
      return () => clearTimeout(t);
    }
  }, [shakeToken]);

  useEffect(() => {
    if (value.length === length) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 600);
      return () => clearTimeout(t);
    }
  }, [value, length]);

  function setDigitAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    if (!char) {
      setDigitAt(index, "");
      return;
    }
    setDigitAt(index, char);
    setPoppedIndex(index);
    if (index < length - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigitAt(index - 1, "");
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, length - 1);
    inputRefs.current[nextFocus]?.focus();
  }

  return (
    <div
      style={{
        display: "flex", gap: "9px", justifyContent: "center",
        animation: shaking ? "otpShake 0.42s ease" : "none",
      }}
    >
      {digits.map((digit, i) => {
        const isFocused = focusedIndex === i;
        const isFilled  = digit !== "";
        return (
          <div key={i} style={{ position: "relative", width: "44px", height: "52px" }}>
            {poppedIndex === i && (
              <span
                onAnimationEnd={() => setPoppedIndex((cur) => (cur === i ? null : cur))}
                style={{
                  position: "absolute", inset: 0, borderRadius: "12px",
                  background: "radial-gradient(circle, rgba(13,148,136,0.35) 0%, transparent 70%)",
                  animation: "otpPop 0.35s ease-out", pointerEvents: "none",
                }}
              />
            )}
            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
              value={digit}
              disabled={disabled}
              autoFocus={autoFocus && i === 0}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
              style={{
                width: "100%", height: "100%", borderRadius: "12px",
                textAlign: "center", fontSize: "1.3rem", fontWeight: 700,
                color: "var(--dd-text1)", background: isFilled ? "rgba(13,148,136,0.08)" : "var(--dd-input-bg)",
                border: `1.5px solid ${isFocused ? "#0d9488" : isFilled ? "rgba(13,148,136,0.45)" : "var(--dd-border2)"}`,
                outline: "none", boxSizing: "border-box",
                boxShadow: isFocused ? "0 0 0 4px rgba(13,148,136,0.14)" : "none",
                transform: celebrating ? "translateY(-3px)" : "translateY(0)",
                transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.3s",
                transitionDelay: celebrating ? `${i * 0.04}s` : "0s",
              }}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes otpPop {
          0%   { opacity: 1; transform: scale(0.4); }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes otpShake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
