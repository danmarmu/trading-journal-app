import React from "react";

export const Panel: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  right,
  children,
}) => (
  <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {right}
    </div>
    {children}
  </div>
);

export const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>{children}</div>
);

export const Label: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <div style={{ fontSize: 12, opacity: 0.8 }}>{text}</div>
    {children}
  </label>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
);

export const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", minHeight: 110 }} />
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button
    {...props}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ccc",
      background: "white",
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.6 : 1,
    }}
  >
    {children}
  </button>
);

export const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button
    {...props}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #e3a5a5",
      background: "#fff5f5",
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.6 : 1,
    }}
  >
    {children}
  </button>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
);
