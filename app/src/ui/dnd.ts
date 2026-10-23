/** MIME-Typ für Drag & Drop aus dem Katalog in 2D-Plan und 3D-Ansicht. */
export const DND_TYPE = "application/x-we13-catalog";

export interface CatalogDrop {
  catalogId: string;
  variant: number;
}
