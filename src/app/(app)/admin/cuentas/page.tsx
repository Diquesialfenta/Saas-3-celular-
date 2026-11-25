import Link from "next/link";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { Badge, Card, Input, StatusBadge, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Cuentas" };

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const workspaces = await db.workspace.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { memberships: { some: { user: { email: { contains: q, mode: "insensitive" } } } } }] } : {},
    include: { subscription: { include: { plan: true } }, _count: { select: { clients: true, projects: true, memberships: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Cuentas</h1>
      <Card>
        <form className="p-3 border-b border-line">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre o correo del propietario" className="max-w-sm" />
        </form>
        <Table>
          <thead>
            <tr>
              <Th>Cuenta</Th>
              <Th>Tipo</Th>
              <Th>Plan</Th>
              <Th>Estado</Th>
              <Th className="text-right">Clientes</Th>
              <Th className="text-right">Equipo</Th>
              <Th className="text-right">Alta</Th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id} className="hover:bg-surface/60">
                <Td>
                  <Link href={`/admin/cuentas/${w.id}`} className="font-medium">
                    {w.name}
                  </Link>
                  {w.isSuspended && <Badge tone="danger" className="ml-2">Suspendida</Badge>}
                </Td>
                <Td>{w.type === "COMPANY" ? "Empresa" : "Independiente"}</Td>
                <Td>{w.subscription?.plan.name ?? "—"}</Td>
                <Td>{w.subscription && <StatusBadge status={w.subscription.status} />}</Td>
                <Td className="text-right tabular-nums">{w._count.clients}</Td>
                <Td className="text-right tabular-nums">{w._count.memberships}</Td>
                <Td className="text-right text-muted">{date(w.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
