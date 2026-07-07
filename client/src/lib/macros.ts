import { Beef, Wheat, Droplet } from "lucide-react";

export const MACROS = [
  { key: "protein", label: "Protein", colorClass: "text-protein", Icon: Beef },
  { key: "carbs", label: "Carbs", colorClass: "text-carbs", Icon: Wheat },
  { key: "fat", label: "Fat", colorClass: "text-fat", Icon: Droplet },
] as const;

export type MacroKey = (typeof MACROS)[number]["key"];
