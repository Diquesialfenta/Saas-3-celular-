import Link from "next/link";
import { Users, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bindings } from "@/lib/bindings";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Avatar, Card, EmptyState, Input, PageHeader, StatusBadge, Table, Tabs, Td, Th, Badge } from "@/components/ui";
import { createClientAction } from "./actions";
import { ClientFields } from "./client-form";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const ctx = await requireWorkspace("clients.view");
  const { q, estado } = await searchParams;
  const where: Prisma.ClientWhereInput = {
    workspaceId: ctx.workspaceId,
    status: estado ? estado as Prisma.EnumClientStatusFilter["equals"] : { not: "ARCHIVED" },
  };
  const list = (filters: Prisma.ClientWhereInput) => db.client.findMany({
    where: { ...where, ...filters },
    include: {
      contacts: { where: { isPrimary: true }, take: 1 },
      _count: { select: { projects: true, portalAccess: true } },
      invoices: { where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const [clients, counts, tagMatches] = await Promise.all([
    list(q ? { OR: [
      { name: { contains: q } },
      { email: { contains: q } },
      { contacts: { some: { name: { contains: q } } } },
    ] } : {}),
    db.client.groupBy({ by: ["status"], where: { workspaceId: ctx.workspaceId }, _count: true }),
    q ? bindings().DB.prepare(`
      SELECT "id" FROM "Client" WHERE "workspaceId" = ?
        AND CASE WHEN ? IS NULL THEN "status" != 'ARCHIVED' ELSE "status" = ? END
        AND EXISTS (SELECT 1 FROM json_each("tags") WHERE value = ?)
      ORDER BY "updatedAt" DESC LIMIT 200
    `).bind(ctx.workspaceId, estado ?? null, estado ?? null, q).all<{ id: string }>() : null,
  ]);
  if (tagMatches?.results.length) {
    const ids = tagMatches.results.map((row) => row.id);
    const batches = [];
    for (let start = 0; start < ids.length; start += 50) {
      batches.push(list({ id: { in: ids.slice(start, start + 50) } }));
    }
    const byId = new Map([...clients, ...(await Promise.all(batches)).flat()].map((client) => [client.id, client]));
    clients.splice(0, clients.length, ...[...byId.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 200));
  }
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const base = (s?: string) => `/app/clientes${s ? `?estado=${s}` : ""}`;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Toda la relación con cada cliente: contactos, oportunidades, documentos, cobros y su portal."
        actions={
          ctx.can("clients.manage") && (
            <Modal trigger="Añadir cliente" title="Nuevo cliente" wide>
              <ActionForm action={createClientAction} className="grid gap-5">
                <ClientFields />
                <div className="flex justify-end">
                  <SubmitButton>Crear cliente</SubmitButton>
                </div>
              </ActionForm>
            </Modal>
          )
        }
      />
      <Tabs
        current={base(estado)}
        items={[
          { href: base(), label: "Todos", count: count("LEAD") + count("ACTIVE") + count("INACTIVE") },
          { href: base("LEAD"), label: "Prospectos", count: count("LEAD") },
          { href: base("ACTIVE"), label: "Activos", count: count("ACTIVE") },
          { href: base("INACTIVE"), label: "Inactivos", count: count("INACTIVE") },
          { href: base("ARCHIVED"), label: "Archivados", count: count("ARCHIVED") },
        ]}
      />
      <Card>
        <form className="flex items-center gap-2 p-3 border-b border-line">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <label htmlFor="q" className="sr-only">
              Buscar clientes
            </label>
            <Input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre, correo, contacto o etiqueta" className="pl-9" />
          </div>
        </form>
        {clients.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q ? "Ningún cliente coincide con la búsqueda" : "Aún no tienes clientes"}
            description={q ? "Prueba con otro nombre o correo." : "Añade tu primer cliente para enviarle propuestas, contratos y abrirle su portal."}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th className="hidden md:table-cell">Contacto principal</Th>
                <Th className="hidden lg:table-cell">Proyectos</Th>
                <Th className="hidden lg:table-cell">Portal</Th>
                <Th className="hidden sm:table-cell text-right">Actualizado</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const overdue = c.invoices.some((i) => i.status === "OVERDUE");
                return (
                  <tr key={c.id} className="hover:bg-surface/60 transition-colors">
                    <Td>
                      <Link href={`/app/clientes/${c.id}`} className="flex items-center gap-3 min-w-0">
                        <Avatar name={c.name} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          <span className="block truncate text-[12px] text-muted">{c.industry || c.email || "—"}</span>
                        </span>
                        {overdue && <Badge tone="danger">Impago</Badge>}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="hidden md:table-cell text-muted">{c.contacts[0]?.name ?? "—"}</Td>
                    <Td className="hidden lg:table-cell tabular-nums">{c._count.projects}</Td>
                    <Td className="hidden lg:table-cell">{c._count.portalAccess > 0 ? <Badge tone="accent">Activo</Badge> : <span className="text-faint">—</span>}</Td>
                    <Td className="hidden sm:table-cell text-right text-muted text-[13px]">{relative(c.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
