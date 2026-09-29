import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const field = "w-full rounded border border-[#3f4450] bg-[#1e1e20] px-3.5 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-500";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${field} min-h-24 ${props.className ?? ""}`} />;
}
