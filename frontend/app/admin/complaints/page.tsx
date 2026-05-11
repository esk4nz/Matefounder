import { PAGE_SHELL_CLASS } from "@/lib/utils";

export default function AdminComplaintsPage() {
  return (
    <section className={PAGE_SHELL_CLASS}>
      <h1 className="text-3xl font-black text-slate-900">Скарги</h1>
      <p className="mt-3 text-slate-600">Облік та розгляд звернень користувачів.</p>
    </section>
  );
}
