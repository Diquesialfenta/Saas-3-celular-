import type { Coupon } from "@prisma/client";
import { db } from "@/lib/db";
import { date, inputDate, money } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, Checkbox, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { saveCouponAction } from "../actions";

export const metadata = { title: "Promociones" };

export default async function AdminCoupons() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[30px] tracking-[-0.03em]">Promociones</h1>
          <p className="text-muted">Cupones de descuento que las cuentas aplican al elegir plan.</p>
        </div>
        <Modal trigger="Crear cupón" title="Nuevo cupón">
          <CouponForm />
        </Modal>
      </div>
      <Card>
        {coupons.length === 0 ? (
          <EmptyState title="Sin cupones" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Descuento</Th>
                <Th>Para</Th>
                <Th>Usos</Th>
                <Th>Válido hasta</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <span className="font-mono font-medium">{c.code}</span> {!c.isActive && <Badge tone="danger">Inactivo</Badge>}
                    {c.description && <span className="block text-[12px] text-muted">{c.description}</span>}
                  </Td>
                  <Td>
                    {c.percentOff ? `${c.percentOff} %` : money(c.amountOff ?? 0, "USD")}
                    {c.durationMonths ? ` · ${c.durationMonths} meses` : " · una vez"}
                  </Td>
                  <Td>{c.accountType === "COMPANY" ? "Empresas" : c.accountType === "FREELANCER" ? "Independientes" : "Todos"}</Td>
                  <Td className="tabular-nums">
                    {c.redemptions}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </Td>
                  <Td className="text-muted">{c.validUntil ? date(c.validUntil) : "Sin fecha"}</Td>
                  <Td className="text-right">
                    <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title={c.code}>
                      <CouponForm c={c} />
                    </Modal>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function CouponForm({ c }: { c?: Coupon }) {
  return (
    <ActionForm action={saveCouponAction} className="grid gap-4 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Código" htmlFor="code">
        <Input id="code" name="code" defaultValue={c?.code} required />
      </Field>
      <Field label="Para" htmlFor="accountType">
        <Select id="accountType" name="accountType" defaultValue={c?.accountType ?? ""}>
          <option value="">Todas las cuentas</option>
          <option value="FREELANCER">Independientes</option>
          <option value="COMPANY">Empresas</option>
        </Select>
      </Field>
      <Field label="Descuento %" htmlFor="percentOff">
        <Input id="percentOff" name="percentOff" type="number" min={1} max={100} defaultValue={c?.percentOff ?? ""} />
      </Field>
      <Field label="o importe fijo" htmlFor="amountOff">
        <Input id="amountOff" name="amountOff" inputMode="decimal" defaultValue={c?.amountOff ? (c.amountOff / 100).toFixed(2) : ""} />
      </Field>
      <Field label="Meses de duración" htmlFor="durationMonths" hint="Vacío = solo el primer pago">
        <Input id="durationMonths" name="durationMonths" type="number" min={1} defaultValue={c?.durationMonths ?? ""} />
      </Field>
      <Field label="Usos máximos" htmlFor="maxRedemptions">
        <Input id="maxRedemptions" name="maxRedemptions" type="number" min={1} defaultValue={c?.maxRedemptions ?? ""} />
      </Field>
      <Field label="Válido hasta" htmlFor="validUntil">
        <Input id="validUntil" name="validUntil" type="date" defaultValue={inputDate(c?.validUntil)} />
      </Field>
      <Field label="Descripción" htmlFor="description">
        <Input id="description" name="description" defaultValue={c?.description ?? ""} />
      </Field>
      <Checkbox name="isActive" defaultChecked={c?.isActive ?? true} label="Activo" />
      <SubmitButton className="sm:col-span-2 justify-self-start">Guardar</SubmitButton>
    </ActionForm>
  );
}
