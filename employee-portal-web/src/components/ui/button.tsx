import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" }) {
  const styles = {
    default: "border border-[#4b5160] bg-[#2b2b30] text-gray-100 hover:bg-[#3a3a42]",
    outline: "border border-[#363941] bg-[#1a1c20] text-[#c0c4cc] hover:bg-[#23262c] hover:text-white",
    ghost: "text-[#9aa2b1] hover:text-white",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center rounded px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 ${styles[variant]} ${props.className ?? ""}`}
    />
  );
}
