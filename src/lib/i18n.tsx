import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

const DICT = {
  en: {
    "nav.orders": "Orders",
    "nav.pending": "Pending",
    "nav.engineering": "Engineering",
    "nav.production": "Production",
    "nav.calendar": "Calendar",
    "nav.config": "Config",
    "nav.users": "Users",
    "nav.delegations": "Delegations",
    "nav.settings": "Settings",
    "nav.signout": "Sign out",
    "track.all": "All",
    "track.coe": "COE",
    "track.third_party": "Third-Party",
    "track.internal": "Internal",
    "orders.title": "Purchase Orders",
    "orders.subtitle":
      "One row per PO line. Lines stay visible across the full lifecycle (engineering → production → export → shipped). Edit in-line; changes are highlighted.",
    "pending.title": "Pending review",
    "pending.subtitle":
      "PO lines waiting on engineering review or flagged for re-review.",
    "pending.total": "Total pending",
    "pending.oldest": "Oldest waiting",
    "export.button": "Export",
    "export.title": "Export current view",
    "export.csv": "Download CSV",
    "export.email": "Email…",
    "export.recipient": "Recipient email",
    "export.open_mail": "Open in mail app",
    "export.rows": "rows in current view",
  },
  es: {
    "nav.orders": "Pedidos",
    "nav.pending": "Pendientes",
    "nav.engineering": "Ingeniería",
    "nav.production": "Producción",
    "nav.calendar": "Calendario",
    "nav.config": "Configuración",
    "nav.users": "Usuarios",
    "nav.delegations": "Delegaciones",
    "nav.settings": "Ajustes",
    "nav.signout": "Cerrar sesión",
    "track.all": "Todos",
    "track.coe": "COE",
    "track.third_party": "Terceros",
    "track.internal": "Internos",
    "orders.title": "Órdenes de compra",
    "orders.subtitle":
      "Una fila por línea de PO. Las líneas permanecen visibles en todo el ciclo (ingeniería → producción → exportación → enviado). Editar en línea; los cambios se resaltan.",
    "pending.title": "Pendientes de revisión",
    "pending.subtitle":
      "Líneas de PO esperando revisión de ingeniería o marcadas para re-revisión.",
    "pending.total": "Total pendientes",
    "pending.oldest": "Más antiguo",
    "export.button": "Exportar",
    "export.title": "Exportar vista actual",
    "export.csv": "Descargar CSV",
    "export.email": "Enviar por correo…",
    "export.recipient": "Correo del destinatario",
    "export.open_mail": "Abrir en correo",
    "export.rows": "filas en la vista actual",
  },
} as const;

export type TKey = keyof (typeof DICT)["en"];

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
}

const I18nCtx = createContext<I18nValue | null>(null);
const STORAGE_KEY = "mego.lang";

function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectInitial());
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (k: TKey) => DICT[lang][k] ?? DICT.en[k] ?? k;

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nCtx);
  if (!v) {
    // Safe fallback so non-wrapped pages (e.g. /auth) still render.
    return { lang: "en", setLang: () => {}, t: (k) => DICT.en[k] ?? k };
  }
  return v;
}