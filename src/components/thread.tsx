import { Avatar, cx } from "./ui";
import { relative } from "@/lib/format";

export type ThreadMessage = { id: string; body: string; authorName: string; authorType: string; createdAt: Date };

/** Conversación. `mine` = el tipo de autor que se pinta a la derecha. */
export function Thread({ messages, mine }: { messages: ThreadMessage[]; mine: "TEAM" | "CLIENT" }) {
  if (messages.length === 0) return <p className="text-sm text-muted text-center py-10">Todavía no hay mensajes. Escribe el primero.</p>;
  return (
    <ol className="grid gap-3">
      {messages.map((m) => {
        if (m.authorType === "SYSTEM")
          return (
            <li key={m.id} className="text-center text-[12px] text-muted px-6">
              {m.body} · {relative(m.createdAt)}
            </li>
          );
        const own = m.authorType === mine;
        return (
          <li key={m.id} className={cx("flex gap-2.5 max-w-[85%]", own && "ml-auto flex-row-reverse")}>
            <Avatar name={m.authorName} size={28} />
            <div className={cx("rounded-[14px] px-3.5 py-2.5", own ? "bg-ink text-white" : "bg-white border border-line")}>
              <p className={cx("text-[12px]", own ? "text-white/60" : "text-muted")}>
                {m.authorName} · {relative(m.createdAt)}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
