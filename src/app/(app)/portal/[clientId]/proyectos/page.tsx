import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { date } from "@/lib/format";
import { Card, EmptyState, Progress, StatusBadge } from "@/components/ui";

export const metadata = { title: "Proyectos" };

export default async function PortalProjects({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const projects = await db.project.findMany({
    where: { workspaceId: ctx.workspaceId, clientId, visibleToClient: true },
    include: { tasks: { where: { parentId: null }, select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Proyectos</h1>
      {projects.length === 0 ? (
        <Card>
          <EmptyState title="Aún no hay proyectos" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const done = p.tasks.filter((t) => t.status === "DONE").length;
            const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
            return (
              <Link key={p.id} href={`/portal/${clientId}/proyectos/${p.id}`} className="lift block rounded-[14px] border border-line bg-white p-5">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{p.name}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4">
                  <Progress value={pct} />
                </div>
                <p className="mt-2 text-[13px] text-muted">
                  {pct} % completado{p.dueDate ? ` · entrega prevista ${date(p.dueDate)}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
