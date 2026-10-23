import { describe, expect, it } from "vitest";
import { budgetSummary, useEditor } from "./project";
import { diffVariants } from "./variants";

describe("Varianten", () => {
  it("sichert, lädt und vergleicht Stände; Varianten überleben einen Konzeptwechsel", () => {
    const st = useEditor.getState();
    st.loadConcept("concept1");
    st.saveVariant("K1 Original");
    const v = useEditor.getState().project.variants!.at(-1)!;
    const sofa = useEditor.getState().project.items.find((i) => !i.existing && i.catalogId.includes("sofa"))!;
    useEditor.getState().removeItems([sofa.id]);
    useEditor.getState().updateItems([useEditor.getState().project.items.find((i) => !i.existing && !i.locked)!.id], (i) => void (i.x += 0.5));
    const p = useEditor.getState().project;
    const d = diffVariants(p, v, p);
    expect(d.removed.map((i) => i.id)).toContain(sofa.id);
    expect(d.moved.length).toBeGreaterThanOrEqual(1);
    expect(d.totalB).toBeLessThan(d.totalA);
    useEditor.getState().loadConcept("concept2");
    expect(useEditor.getState().project.variants?.some((x) => x.id === v.id)).toBe(true);
    useEditor.getState().loadVariant(v.id);
    expect(useEditor.getState().project.items.some((i) => i.id === sofa.id)).toBe(true);
    expect(budgetSummary(useEditor.getState().project).total).toBeCloseTo(d.totalA, 2);
  });
  it("Kaufstatus je Position", () => {
    const st = useEditor.getState();
    st.loadConcept("concept1");
    const it0 = useEditor.getState().project.items.find((i) => !i.existing && (i.parts?.length ?? 0) > 0)!;
    useEditor.getState().setStatus([it0.id], [], "bestellt");
    const b = budgetSummary(useEditor.getState().project);
    const line = b.lines.find((l) => l.itemIds.includes(it0.id))!;
    expect(line.status).toBe("bestellt");
    expect(b.byStatus.bestellt).toBeGreaterThan(0);
    expect(b.byStatus.geplant + b.byStatus.bestellt).toBeCloseTo(b.total, 2);
    useEditor.getState().setStatus([it0.id], [], "geplant");
    expect(useEditor.getState().project.items.find((i) => i.id === it0.id)!.status).toBeUndefined();
  });
});
