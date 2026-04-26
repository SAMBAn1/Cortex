import { useEffect, useMemo, useRef } from "react";
import cytoscape from "cytoscape";
import { useNotes } from "../store/notes";
import { useNavigate } from "react-router-dom";

export default function GraphPage() {
  const notes = useNotes(s => s.notes);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const elements = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of Object.values(notes)) titleToId.set(n.title.toLowerCase(), n.id);
    const nodes = Object.values(notes).map(n => ({
      data: { id: n.id, label: n.title, weight: 1 + n.links.length },
    }));
    const edges: any[] = [];
    for (const n of Object.values(notes)) {
      for (const l of n.links) {
        const target = titleToId.get(l.toLowerCase());
        if (target && target !== n.id) edges.push({ data: { id: `${n.id}-${target}`, source: n.id, target } });
      }
    }
    return [...nodes, ...edges];
  }, [notes]);

  useEffect(() => {
    if (!ref.current) return;
    const cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        { selector: "node", style: {
          "background-color": "rgb(var(--accent))",
          "label": "data(label)",
          "color": "rgb(var(--fg))",
          "font-size": 11,
          "text-margin-y": -8,
          "width": "mapData(weight, 1, 10, 14, 40)",
          "height": "mapData(weight, 1, 10, 14, 40)",
          "border-width": 1,
          "border-color": "rgb(var(--bg-elev))",
        }},
        { selector: "edge", style: {
          "width": 1,
          "line-color": "rgb(var(--border))",
          "curve-style": "bezier",
          "target-arrow-shape": "none",
          "opacity": 0.7,
        }},
        { selector: "node:selected", style: { "background-color": "rgb(var(--accent))", "border-color": "rgb(var(--accent))", "border-width": 3 } },
      ],
      layout: { name: "cose", animate: false, idealEdgeLength: 80, nodeRepulsion: 8000 } as any,
      wheelSensitivity: 0.2,
    });
    cy.on("tap", "node", (e) => navigate(`/notes/${e.target.id()}`));
    return () => cy.destroy();
  }, [elements, navigate]);

  return (
    <div className="h-full p-4">
      <div ref={ref} className="panel w-full h-full" />
    </div>
  );
}
