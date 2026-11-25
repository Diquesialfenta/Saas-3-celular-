import { Field, Input, Select, Textarea } from "@/components/ui";
import { CLIENT_SOURCES } from "@/lib/constants";

type C = {
  id?: string;
  name?: string;
  kind?: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  taxId?: string | null;
  address?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string[];
  status?: string;
};

export function ClientFields({ c = {}, full = false }: { c?: C; full?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <Field label="Nombre o razón social" htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={c.name} required />
      </Field>
      <Field label="Tipo" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue={c.kind ?? "COMPANY"}>
          <option value="COMPANY">Empresa</option>
          <option value="PERSON">Persona</option>
        </Select>
      </Field>
      <Field label="Estado" htmlFor="status">
        <Select id="status" name="status" defaultValue={c.status ?? "LEAD"}>
          <option value="LEAD">Prospecto</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
          {full && <option value="ARCHIVED">Archivado</option>}
        </Select>
      </Field>
      {!full && (
        <>
          <Field label="Persona de contacto" htmlFor="contactName">
            <Input id="contactName" name="contactName" autoComplete="name" />
          </Field>
          <Field label="Cargo" htmlFor="position">
            <Input id="position" name="position" />
          </Field>
        </>
      )}
      <Field label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={c.email ?? ""} />
      </Field>
      <Field label="Teléfono o WhatsApp" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={c.phone ?? ""} />
      </Field>
      <Field label="Sector" htmlFor="industry">
        <Input id="industry" name="industry" defaultValue={c.industry ?? ""} />
      </Field>
      <Field label="Origen" htmlFor="source">
        <Select id="source" name="source" defaultValue={c.source ?? ""}>
          <option value="">Sin indicar</option>
          {CLIENT_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label="Web" htmlFor="website">
        <Input id="website" name="website" defaultValue={c.website ?? ""} />
      </Field>
      <Field label="Etiquetas" htmlFor="tags" hint="Separadas por comas">
        <Input id="tags" name="tags" defaultValue={c.tags?.join(", ")} />
      </Field>
      {full && (
        <>
          <Field label="Documento fiscal" htmlFor="taxId">
            <Input id="taxId" name="taxId" defaultValue={c.taxId ?? ""} />
          </Field>
          <Field label="Dirección" htmlFor="address">
            <Input id="address" name="address" defaultValue={c.address ?? ""} />
          </Field>
          <Field label="Notas internas" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={c.notes ?? ""} />
          </Field>
        </>
      )}
    </div>
  );
}
