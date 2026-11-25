import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative, money } from "@/lib/format";
import { Card, EmptyState, PageHeader, PriorityDot, StatusBadge, Table, Tabs, Td, Th, Stat } from "@/components/ui";

export const metadata = { title: "Soporte" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace("support.manage");
  const { vista } = await searchParams;
  const ws = ctx.workspaceId;
  const [open, pending, resolvedWeek] = await Promise.all([
    db.ticket.count({ where: { workspaceId: ws, status: "OPEN" } }),
    db.ticket.count({ where: { workspaceId: ws, status: "PENDING" } }),
    db.ticket.count({ where: { workspaceId: ws, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
  ]);
  const tabs = [
    { href: "/app/soporte", label: "Tickets abiertos" },
    { href: "/app/soporte?vista=cerrados", label: "Resueltos" },
    { href: "/app/soporte?vista=solicitudes", label: "Solicitudes de clientes" },
  ];
  const current = vista ? `/app/soporte?vista=${vista}` : "/app/soporte";
  return (
    <>
      <PageHeader title="Soporte" description="Tickets de posventa y solicitudes de servicios, modificaciones y ampliaciones que llegan desde los portales." />
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl">
        <Stat label="Abiertos" value={open} tone={open ? "danger" : undefined} />
        <Stat label="Esperando al cliente" value={pending} />
        <Stat label="Resueltos esta semana" value={resolvedWeek} />
      </div>
      <Tabs items={tabs} current={current} />
      {vista === "solicitudes" ? <Requests workspaceId={ws} currency={ctx.workspace.currency} /> : <Tickets workspaceId={ws} closed={vista === "cerrados"} />}
    </>
  );
}

async function Tickets({ workspaceId, closed }: { workspaceId: string; closed: boolean }) {
  const tickets = await db.ticket.findMany({
    where: { workspaceId, status: closed ? { in: ["RESOLVED", "CLOSED"] } : { in: ["OPEN", "PENDING"] } },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  const clients = await db.client.findMany({ where: { id: { in: tickets.map((t) => t.clientId) } }, select: { id: true, name: true } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return (
    <Card>
      {tickets.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-5" />} title={closed ? "Sin tickets resueltos" : "No hay tickets abiertos"} description="Los clientes abren tickets desde su portal." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Cliente</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              <Th className="text-right">Actualizado</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-surface/60">
                <Td>
                  <Link href={`/app/soporte/${t.id}`} className="font-medium">
                    #{t.number} {t.subject}
                  </Link>
                </Td>
                <Td className="text-muted">{names.get(t.clientId)}</Td>
                <Td>
                  <PriorityDot priority={t.priority} />
                </Td>
                <Td>
                  <StatusBadge status={t.status} />
                </Td>
                <Td className="text-right text-muted text-[13px]">{relative(t.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function Requests({ workspaceId, currency }: { workspaceId: string; currency: string }) {
  const reqs = await db.changeRequest.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 });
  const clients = await db.client.findMany({ where: { id: { in: reqs.map((r) => r.clientId) } }, select: { id: true, name: true } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return (
    <Card>
      {reqs.length === 0 ? (
        <EmptyState title="Sin solicitudes" description="Las peticiones de servicios adicionales, modificaciones y ampliaciones aparecen aquí." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Solicitud</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th className="text-right">Importe</Th>
              <Th className="text-right">Fecha</Th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={r.projectId ? `/app/proyectos/${r.projectId}?vista=cambios` : `/app/clientes/${r.clientId}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                  <span className="block text-[12px] text-muted">{{ MODIFICATION: "Modificación", SCOPE_EXTENSION: "Ampliación", NEW_SERVICE: "Nuevo servicio" }[r.type]}</span>
                </Td>
                <Td className="text-muted">{names.get(r.clientId)}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="text-right tabular-nums">{r.estimateAmount ? money(r.estimateAmount, currency) : "—"}</Td>
                <Td className="text-right text-muted text-[13px]">{relative(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
