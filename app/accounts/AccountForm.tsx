"use client";

export type AccountFormValues = {
  slug: string;
  ig_user_id: string | null;
  ig_username: string | null;
  whatsapp_number: string;
  persona_tone: string;
  active: boolean;
  token_expires_at: string | null;
};

type AccountFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  initial?: AccountFormValues;
  submitLabel: string;
  hasToken?: boolean;
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const labelClass = "block text-sm font-medium mb-1";
const sectionClass = "space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

export default function AccountForm({ action, initial, submitLabel, hasToken }: AccountFormProps) {
  return (
    <form action={action} className="space-y-6">
      <div className={sectionClass}>
        <div>
          <label className={labelClass} htmlFor="slug">
            Identificador (slug)
          </label>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={initial?.slug}
            className={inputClass}
            placeholder="ex.: marca-exemplo"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
          Conta ativa (recebe e processa comentários)
        </label>
      </div>

      <div className={sectionClass}>
        <h3 className="font-semibold">Conexão com o Instagram</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ig_user_id">
              ig_user_id
            </label>
            <input
              id="ig_user_id"
              name="ig_user_id"
              defaultValue={initial?.ig_user_id ?? ""}
              className={inputClass}
              placeholder="17841400000000000"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ig_username">
              @usuário
            </label>
            <input
              id="ig_username"
              name="ig_username"
              defaultValue={initial?.ig_username ?? ""}
              className={inputClass}
              placeholder="marca.exemplo"
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="access_token">
            Access token (longa duração)
          </label>
          <input
            id="access_token"
            name="access_token"
            type="password"
            autoComplete="off"
            className={inputClass}
            placeholder={hasToken ? "•••••••• (deixe em branco para manter o atual)" : "IGQ..."}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Veja no README (&ldquo;Adicionar uma conta&rdquo;) como obter o token via OAuth manual da Meta.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="token_expires_at">
            Token expira em
          </label>
          <input
            id="token_expires_at"
            name="token_expires_at"
            type="date"
            defaultValue={initial?.token_expires_at?.slice(0, 10) ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-semibold">WhatsApp e persona</h3>
        <div>
          <label className={labelClass} htmlFor="whatsapp_number">
            Número do WhatsApp (para onde a DM gerada direciona)
          </label>
          <input
            id="whatsapp_number"
            name="whatsapp_number"
            required
            defaultValue={initial?.whatsapp_number}
            className={inputClass}
            placeholder="5511999999999"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="persona_tone">
            Persona / tom de voz
          </label>
          <textarea
            id="persona_tone"
            name="persona_tone"
            rows={3}
            required
            defaultValue={initial?.persona_tone}
            className={inputClass}
            placeholder="descontraído e direto, como uma amiga que entende do assunto"
          />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
