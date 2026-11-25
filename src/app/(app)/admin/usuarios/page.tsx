import { db } from "@/lib/db";
import { relative } from "@/lib/format";
import { requireSuperadmin } from "@/lib/auth";
import { ActionButton, LinkResultForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Input, Table, Td, Th } from "@/components/ui";
import { resetLinkAction, setUserFlagsAction } from "../actions";

export const metadata = { title: "Usuarios" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireSuperadmin();
  const { q } = await searchParams;
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {},
    include: { memberships: { include: { workspace: { select: { name: true } } } }, _count: { select: { portalAccess: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Usuarios</h1>
      <Card>
        <form className="p-3 border-b border-line">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className="max-w-sm" />
        </form>
        <Table>
          <thead>
            <tr>
              <Th>Usuario</Th>
              <Th>Cuentas</Th>
              <Th>Portales</Th>
              <Th>Último acceso</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td>
                  <span className="font-medium">{u.name}</span>
                  {u.isSuperadmin && <Badge tone="accent" className="ml-2">Superadmin</Badge>}
                  {u.isSuspended && <Badge tone="danger" className="ml-2">Suspendido</Badge>}
                  <span className="block text-[12px] text-muted">{u.email}</span>
                </Td>
                <Td className="text-muted text-[13px]">{u.memberships.map((m) => m.workspace.name).join(", ") || "—"}</Td>
                <Td className="tabular-nums">{u._count.portalAccess}</Td>
                <Td className="text-muted text-[13px]">{u.lastLoginAt ? relative(u.lastLoginAt) : "Nunca"}</Td>
                <Td>
                  {u.id !== me.id && (
                    <div className="flex flex-wrap justify-end gap-1">
                      <ActionButton action={setUserFlagsAction} fields={{ id: u.id, field: "isSuspended", value: u.isSuspended ? "0" : "1" }} variant="ghost" confirm={u.isSuspended ? undefined : `¿Suspender a ${u.email}?`}>
                        {u.isSuspended ? "Reactivar" : "Suspender"}
                      </ActionButton>
                      <ActionButton action={setUserFlagsAction} fields={{ id: u.id, field: "isSuperadmin", value: u.isSuperadmin ? "0" : "1" }} variant="ghost" confirm={u.isSuperadmin ? "¿Quitar permisos de superadministrador?" : "¿Dar acceso total a la plataforma?"}>
                        {u.isSuperadmin ? "Quitar admin" : "Hacer admin"}
                      </ActionButton>
                      <LinkResultForm action={resetLinkAction} note="Enlace para restablecer la contraseña:">
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitButton variant="ghost" size="sm">
                          Enlace de acceso
                        </SubmitButton>
                      </LinkResultForm>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
