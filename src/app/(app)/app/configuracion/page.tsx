import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { money } from "@/lib/format";
import { CURRENCIES } from "@/lib/constants";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, Card, CardHeader, Checkbox, Field, Input, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { changePasswordAction, deleteServiceAction, saveBillingSettingsAction, saveBrandAction, saveGeneralAction, saveServiceAction, updateProfileAction } from "./actions";

export const metadata = { title: "Configuración" };

const TIMEZONES = ["America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago", "America/Argentina/Buenos_Aires", "America/Caracas", "America/Guayaquil", "America/La_Paz", "America/Montevideo", "America/Asuncion", "America/New_York", "Europe/Madrid", "UTC"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace("settings.manage");
  const { vista = "general" } = await searchParams;
  const w = ctx.workspace;
  const base = "/app/configuracion";
  const tabs = [
    { href: base, label: "General" },
    { href: `${base}?vista=marca`, label: "Marca y portal" },
    { href: `${base}?vista=facturacion`, label: "Facturación y servicios" },
    { href: `${base}/plan`, label: "Plan y suscripción" },
    { href: `${base}?vista=perfil`, label: "Mi perfil" },
  ];
  const current = vista === "general" ? base : `${base}?vista=${vista}`;
  const services = vista === "facturacion" ? await db.service.findMany({ where: { workspaceId: w.id }, orderBy: { name: "asc" } }) : [];

  return (
    <>
      <PageHeader title="Configuración" description={`${w.name} · ${w.type === "COMPANY" ? "Cuenta de empresa" : "Cuenta de independiente"}`} />
      <Tabs items={tabs} current={current} />
      {vista === "general" && (
        <Card className="p-6 max-w-3xl">
          <ActionForm action={saveGeneralAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" htmlFor="name">
              <Input id="name" name="name" defaultValue={w.name} required />
            </Field>
            <Field label="Razón social" htmlFor="legalName">
              <Input id="legalName" name="legalName" defaultValue={w.legalName ?? ""} />
            </Field>
            <Field label="Documento fiscal (RUC, NIF…)" htmlFor="taxId">
              <Input id="taxId" name="taxId" defaultValue={w.taxId ?? ""} />
            </Field>
            <Field label="Correo de contacto" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={w.email ?? ""} />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" defaultValue={w.phone ?? ""} />
            </Field>
            <Field label="Web" htmlFor="website">
              <Input id="website" name="website" defaultValue={w.website ?? ""} />
            </Field>
            <Field label="Dirección fiscal" htmlFor="address" className="sm:col-span-2">
              <Input id="address" name="address" defaultValue={w.address ?? ""} />
            </Field>
            <Field label="Zona horaria" htmlFor="timezone">
              <Select id="timezone" name="timezone" defaultValue={w.timezone}>
                {TIMEZONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm font-medium">Tus datos son tuyos</p>
            <p className="text-[13px] text-muted mt-1">Descarga una copia completa de clientes, proyectos, documentos y facturas en JSON.</p>
            <a href="/api/export" className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-surface press">
              Descargar mis datos
            </a>
          </div>
        </Card>
      )}

      {vista === "marca" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start max-w-5xl">
          <Card className="p-6">
            <ActionForm action={saveBrandAction} className="grid gap-4" encType="multipart/form-data">
              <Field label="Logotipo" htmlFor="logo" hint="PNG, JPG, SVG o WebP de menos de 1 MB. Aparece en el portal, las propuestas, las facturas y los correos.">
                <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="h-auto py-2" />
              </Field>
              {w.logoUrl && <Checkbox name="removeLogo" label="Quitar el logotipo actual" />}
              <Field label="Color de marca" htmlFor="brandColor" hint="Se usa en los botones de tu portal y tus documentos.">
                <div className="flex gap-2">
                  <input id="brandColor" name="brandColor" type="color" defaultValue={w.brandColor} className="h-10 w-14 rounded-[10px] border border-line-strong bg-white p-1" />
                </div>
              </Field>
              <Field label="Título del portal" htmlFor="portalTitle">
                <Input id="portalTitle" name="portalTitle" defaultValue={w.portalTitle ?? ""} />
              </Field>
              <Field label="Mensaje de bienvenida del portal" htmlFor="portalWelcome">
                <Textarea id="portalWelcome" name="portalWelcome" defaultValue={w.portalWelcome ?? ""} placeholder="Aquí tienes todo lo que estamos haciendo para ti." />
              </Field>
              <SubmitButton className="justify-self-start">Guardar marca</SubmitButton>
            </ActionForm>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 h-14 flex items-center gap-2.5">
              {w.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.logoUrl} alt={w.name} className="h-7 w-auto" />
              ) : (
                <>
                  <span className="grid size-7 place-items-center rounded-[8px] text-white text-sm" style={{ background: w.brandColor }}>
                    {w.name[0]}
                  </span>
                  <span className="font-display">{w.name}</span>
                </>
              )}
            </div>
            <div className="p-5 bg-surface">
              <p className="text-[12px] text-muted">{w.portalTitle ?? `Portal de ${w.name}`}</p>
              <p className="font-display text-2xl mt-1">Hola, Laura</p>
              <p className="text-sm text-muted mt-1">{w.portalWelcome ?? "Aquí tienes todo lo que estamos haciendo para ti."}</p>
              <span className="mt-4 inline-flex h-9 items-center rounded-full px-4 text-sm text-white" style={{ background: w.brandColor }}>
                Aprobar la entrega
              </span>
            </div>
            <p className="px-5 py-3 text-[12px] text-muted">Vista previa del portal de tus clientes</p>
          </Card>
        </div>
      )}

      {vista === "facturacion" && (
        <div className="grid gap-4 lg:grid-cols-2 items-start max-w-5xl">
          <Card className="p-6">
            <ActionForm action={saveBillingSettingsAction} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Moneda" htmlFor="currency">
                  <Select id="currency" name="currency" defaultValue={w.currency}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Impuesto por defecto %" htmlFor="taxRate">
                  <Input id="taxRate" name="taxRate" type="number" min={0} max={100} step={0.01} defaultValue={w.taxRate} />
                </Field>
              </div>
              <Field label="Pie de factura" htmlFor="invoiceFooter" hint="Datos bancarios para transferencia, condiciones de pago…">
                <Textarea id="invoiceFooter" name="invoiceFooter" defaultValue={w.invoiceFooter ?? ""} />
              </Field>
              <SubmitButton className="justify-self-start">Guardar</SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader
              title="Catálogo de servicios"
              description="Lo que tus clientes pueden contratar desde su portal"
              action={
                <Modal trigger="Añadir" triggerVariant="secondary" triggerSize="sm" title="Nuevo servicio">
                  <ServiceForm currency={w.currency} />
                </Modal>
              }
            />
            <ul className="pb-3">
              {services.length === 0 && <li className="px-5 pb-3 text-sm text-muted">Sin servicios en el catálogo.</li>}
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-line first:border-0">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{s.name}</span>
                    <span className="block text-[12px] text-muted">
                      {money(s.price, s.currency)}
                      {s.recurring === "MONTHLY" ? " / mes" : s.recurring === "YEARLY" ? " / año" : ""} {s.visibleInPortal ? "" : "· oculto en el portal"}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title={s.name}>
                      <ServiceForm s={s} currency={w.currency} />
                    </Modal>
                    <ActionButton action={deleteServiceAction} fields={{ id: s.id }} variant="ghost" confirm="¿Eliminar el servicio?">
                      Eliminar
                    </ActionButton>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {vista === "perfil" && (
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <Avatar name={ctx.user.name} size={44} />
              <div>
                <p className="font-medium">{ctx.user.name}</p>
                <p className="text-sm text-muted">{ctx.user.email}</p>
              </div>
            </div>
            <ActionForm action={updateProfileAction} className="grid gap-4">
              <Field label="Nombre" htmlFor="pname">
                <Input id="pname" name="name" defaultValue={ctx.user.name} required />
              </Field>
              <SubmitButton variant="secondary" className="justify-self-start">
                Guardar
              </SubmitButton>
            </ActionForm>
          </Card>
          <Card className="p-6">
            <p className="font-medium mb-4">Cambiar contraseña</p>
            <ActionForm action={changePasswordAction} reset className="grid gap-4">
              <Field label="Contraseña actual" htmlFor="current">
                <Input id="current" name="current" type="password" autoComplete="current-password" required />
              </Field>
              <Field label="Nueva contraseña" htmlFor="next">
                <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <SubmitButton variant="secondary" className="justify-self-start">
                Cambiar contraseña
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}
      {vista === "general" && ctx.workspace.type === "FREELANCER" && (
        <Card className="p-6 mt-4 max-w-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium">¿Creces y sumas equipo?</p>
            <p className="text-sm text-muted">Pasa a cuenta de empresa sin perder clientes, proyectos ni configuraciones.</p>
          </div>
          <ButtonLink href="/app/configuracion/plan">Ver planes de empresa</ButtonLink>
        </Card>
      )}
      <p className="mt-6 text-[12px] text-faint">
        ID de la cuenta <code className="font-mono">{w.id}</code> · <Link href="/app/integraciones" className="underline underline-offset-2">Integraciones</Link> · <Badge>{w.slug}</Badge>
      </p>
    </>
  );
}

function ServiceForm({ s, currency }: { s?: { id: string; name: string; description: string | null; price: number; recurring: string; visibleInPortal: boolean }; currency: string }) {
  return (
    <ActionForm action={saveServiceAction} className="grid gap-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Nombre" htmlFor="sv-name">
        <Input id="sv-name" name="name" defaultValue={s?.name} required />
      </Field>
      <Field label="Descripción" htmlFor="sv-desc">
        <Textarea id="sv-desc" name="description" defaultValue={s?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Precio (${currency})`} htmlFor="sv-price">
          <Input id="sv-price" name="price" inputMode="decimal" defaultValue={s ? (s.price / 100).toFixed(2) : ""} required />
        </Field>
        <Field label="Facturación" htmlFor="sv-rec">
          <Select id="sv-rec" name="recurring" defaultValue={s?.recurring ?? "NONE"}>
            <option value="NONE">Pago único</option>
            <option value="MONTHLY">Mensual</option>
            <option value="YEARLY">Anual</option>
          </Select>
        </Field>
      </div>
      <Checkbox name="visibleInPortal" defaultChecked={s?.visibleInPortal ?? true} label="Mostrar en el portal de clientes" />
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}
