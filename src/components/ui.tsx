import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}
export const Panel: React.FC<PanelProps> = ({ title, right, children, ...rest }) => (
  <div {...rest}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);

export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}
export const Row: React.FC<RowProps> = ({ children, ...rest }) => (
  <div {...rest} style={{ display: "flex", gap: 10, flexWrap: "wrap", ...(rest.style as any) }}>
    {children}
  </div>
);

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  text: string;
  children: React.ReactNode;
}
export const Label: React.FC<LabelProps> = ({ text, children, ...rest }) => (
  <label {...rest} style={{ display: "block", fontSize: 12, fontWeight: 600, ...(rest.style as any) }}>
    {text}
    {children}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", ...(props.style as any) }} />
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} {...props} style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", ...(props.style as any) }} />
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  style,
  ...props
}) => (
  <button
    {...props}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ccc",
      background: "white",
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.6 : 1,
      ...style,
    }}
  >
    {children}
  </button>
);

export const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  style,
  ...props
}) => (
  <button
    {...props}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #e3a5a5",
      background: "#fff5f5",
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.6 : 1,
      ...style,
    }}
  >
    {children}
  </button>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  style,
  ...props
}) => (
  <select
    {...props}
    style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", ...style }}
  />
);

Input.displayName = "Input";
TextArea.displayName = "TextArea";
