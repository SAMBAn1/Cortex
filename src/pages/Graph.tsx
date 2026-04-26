import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useNotes } from "../store/notes";
import { useNavigate } from "react-router-dom";
import { Search, LocateFixed, ZoomIn, ZoomOut } from "lucide-react";

interface GNode {
  id: string;
  name: string;
  weight: number;
  tagsKey: string;
  x?: number; y?: number; vx?: number; vy?: number;
}
interface GLink { source: string; target: string; }

export default function GraphPage() {
  const notes = useNotes(s => s.notes);
  const navigate = useNavigate();
  const ref = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const data = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of Object.values(notes)) titleToId.set(n.title.toLowerCase(), n.id);
    const links: GLink[] = [];
    const incoming = new Map<string, number>();
    for (const n of Object.values(notes)) {
      for (const l of n.links) {
        const target = titleToId.get(l.toLowerCase());
        if (target && target !== n.id) {
          links.push({ source: n.id, target });
          incoming.set(target, (incoming.get(target) ?? 0) + 1);
        }
      }
    }
    const nodes: GNode[] = Object.values(notes).map(n => ({
      id: n.id,
      name: n.title || "Untitled",
      weight: 1 + (incoming.get(n.id) ?? 0) + n.links.length,
      tagsKey: n.tags[0] ?? "",
    }));
    return { nodes, links };
  }, [notes]);

  // Build neighbor index for hover highlighting
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as any).id;
      const t = typeof l.target === "string" ? l.target : (l.target as any).id;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [data.links]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Stabilize physics + cool down
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-180);
    g.d3Force("link")?.distance(50);
    setTimeout(() => g.zoomToFit(400, 60), 600);
  }, [data]);

  const accent = useMemo(() => getCss("--accent", "129 140 248"), []);
  const fg = useMemo(() => getCss("--fg", "235 235 240"), []);
  const fgSubtle = useMemo(() => getCss("--fg-subtle", "110 110 122"), []);
  const border = useMemo(() => getCss("--border", "38 38 46"), []);

  const matched = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return new Set(data.nodes.filter(n => n.name.toLowerCase().includes(needle)).map(n => n.id));
  }, [q, data.nodes]);

  const drawNode = useCallback((node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = 3 + Math.min(10, node.weight * 0.9);
    const isHovered = hover === node.id;
    const isNeighbor = hover && neighbors.get(hover)?.has(node.id);
    const dim = (hover && !isHovered && !isNeighbor) || (matched && !matched.has(node.id));
    const col = `rgb(${accent})`;
    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = isHovered ? 2 / scale : 1 / scale;
    ctx.strokeStyle = isHovered ? `rgb(${fg})` : `rgb(${border})`;
    ctx.stroke();
    // Label
    if (scale > 0.7 || isHovered || (matched && matched.has(node.id))) {
      ctx.font = `${Math.max(8, 11 / Math.max(1, scale * 0.9))}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHovered ? `rgb(${fg})` : `rgb(${fgSubtle})`;
      const maxLen = Math.max(12, Math.floor(scale * 24));
      const label = node.name.length > maxLen ? node.name.slice(0, maxLen - 1) + "…" : node.name;
      ctx.fillText(label, node.x!, node.y! + r + 2);
    }
    ctx.globalAlpha = 1;
  }, [accent, fg, fgSubtle, border, hover, neighbors, matched]);

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const s = link.source, t = link.target;
    const sId = typeof s === "object" ? s.id : s;
    const tId = typeof t === "object" ? t.id : t;
    const active = hover && (hover === sId || hover === tId);
    ctx.strokeStyle = active ? `rgb(${accent})` : `rgb(${border})`;
    ctx.globalAlpha = hover ? (active ? 0.9 : 0.12) : 0.55;
    ctx.lineWidth = active ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [accent, border, hover]);

  return (
    <div className="h-full p-4">
      <div className="panel w-full h-full relative overflow-hidden" ref={wrapRef}>
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-bg-elev/80 backdrop-blur rounded-lg px-2 py-1.5 border border-border">
          <Search size={13} className="text-fg-subtle" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter nodes…"
            className="bg-transparent text-sm outline-none w-44 placeholder:text-fg-subtle"
          />
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-bg-elev/80 backdrop-blur rounded-lg px-1 py-1 border border-border">
          <button onClick={() => ref.current?.zoom((ref.current?.zoom() ?? 1) * 1.3, 200)} className="icon-btn h-7 w-7"><ZoomIn size={13} /></button>
          <button onClick={() => ref.current?.zoom((ref.current?.zoom() ?? 1) / 1.3, 200)} className="icon-btn h-7 w-7"><ZoomOut size={13} /></button>
          <button onClick={() => ref.current?.zoomToFit(400, 60)} className="icon-btn h-7 w-7"><LocateFixed size={13} /></button>
        </div>
        {data.nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-fg-subtle text-sm">
            Create notes with <span className="text-accent mx-1">[[wikilinks]]</span> to grow your graph.
          </div>
        ) : (
          <ForceGraph2D
            ref={ref as any}
            graphData={data as any}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={drawNode as any}
            linkCanvasObject={drawLink}
            linkCanvasObjectMode={() => "replace"}
            nodeCanvasObjectMode={() => "replace"}
            nodeRelSize={4}
            cooldownTicks={120}
            d3VelocityDecay={0.3}
            onNodeHover={(n) => setHover(n ? (n as GNode).id : null)}
            onNodeClick={(n) => navigate(`/notes/${(n as GNode).id}`)}
            enableNodeDrag
          />
        )}
      </div>
    </div>
  );
}

function getCss(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}
