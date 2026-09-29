import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded border border-[#282a31] bg-[#18191d] p-3.5 ${props.className ?? ""}`} />;
}
