export function Alert({ title, children, tone = "info" }: { title: string; children: string; tone?: "info" | "warning" }) {
  const bar = tone === "warning" ? "border-l-amber-500/70" : "border-l-sky-500/70";
  return (
    <div role="status" className={`rounded border border-y border-r border-[#24262d] border-l-2 ${bar} bg-[#191a1e] p-2.5 text-xs`}>
      <p className="font-medium text-white">{title}</p>
      <p className="text-[#969aa3]">{children}</p>
    </div>
  );
}
