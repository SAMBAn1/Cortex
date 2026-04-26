import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useNotes } from "../store/notes";
import { useNavigate } from "react-router-dom";
import { Search, LocateFixed, ZoomIn, ZoomOut, Filter } from "lucide-react";
import { dayKey } from "../lib/parse/dates";

type Kind = "note" | "date" | "tag";
interface GNode {
  id: string;
  name: string;
  weight: number;
  kind: Kind;
  x?: number; y?: number; vx?: number; vy?: number;
}
interface GLink { source: string; target: string; kind: "link" | "date" | "tag"; }

export default function GraphPage() {
  const notes = useNotes(s => s.notes);
  const navigate = useNavigate();
  const ref = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showDates, setShowDates] = useState(true);
  const [showTags, setShowTags] = useState(true);

  const data = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of Object.values(notes)) titleToId.set(n.title.toLowerCase(), n.id);

    const links: GLink[] = [];
    const incoming = new Map<string, number>();
    const dateNodes = new Map<string, GNode>();
    const tagNodes = new Map<string, GNode>();

    for (const n of Object.values(notes)) {
      // wikilinks
      for (const l of n.links) {
        const target = titleToId.get(l.toLowerCase());
        if (target && target !== n.id) {
          links.push({ source: n.id, target, kind: "link" });
          incoming.set(target, (incoming.get(target) ?? 0) + 1);
        }
      }
      // date links
      if (showDates) {
        for (const d of n.dates) {
          const key = `date:${dayKey(d.iso)}`;
          if (!dateNodes.has(key)) {
            dateNodes.set(key, {
              id: key,
              name: new Date(d.iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
              weight: 1,
              kind: "date",
            });
          } else {
            dateNodes.get(key)!.weight++;
          }
          links.push({ source: n.id, target: key, kind: "date" });
        }
      }
      // tag links
      if (showTags) {
        for (const t of n.tags) {
          const key = `tag:${t}`;
          if (!tagNodes.has(key)) {
            tagNodes.set(key, { id: key, name: `#${t}`, weight: 1, kind: "tag" });
          } else {
            tagNodes.get(key)!.weight++;
          }
          links.push({ source: n.id, target: key, kind: "tag" });
        }
      }
    }

    const noteNodes: GNode[] = Object.values(notes).map(n => ({
      id: n.id,
      name: n.title || "Untitled",
      weight: 1 + (incoming.get(n.id) ?? 0) + n.links.length,
      kind: "note",
    }));

    return { nodes: [...noteNodes, ...dateNodes.values(), ...tagNodes.values()], links };
  }, [notes, showDates, showTags]);

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

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-160);
    g.d3Force("link")?.distance(48);
    setTimeout(() => g.zoomToFit(400, 60), 600);
  }, [data]);

  const accent = useMemo(() => getCss("--accent", "129 140 248"), []);
  const fg = useMemo(() => getCss("--fg", "235 235 240"), []);
  const fgSubtle = useMemo(() => getCss("--fg-subtle", "110 110 122"), []);
  const border = useMemo(() => getCss("--border", "38 38 46"), []);
  const success = useMemo(() => getCss("--success", "34 197 94"), []);
  const warn = useMemo(() => getCss("--warn", "234 179 8"), []);

  const matched = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return new Set(data.nodes.filter(n => n.name.toLowerCase().includes(needle)).map(n => n.id));
  }, [q, data.nodes]);

  const colorFor = useCallback((kind: Kind) => {
    if (kind === "date") return success;
    if (kind === "tag") return warn;
    return accent;
  }, [accent, success, warn]);

  const drawNode = useCallback((node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = node.kind === "note" ? 3 + Math.min(10, node.weight * 0.9) : 2.5 + Math.min(8, node.weight * 0.6);
    const isHovered = hover === node.id;
    const isNeighbor = hover && neighbors.get(hover)?.has(node.id);
    const dim = (hover && !isHovered && !isNeighbor) || (matched && !matched.has(node.id));
    const col = `rgb(${colorFor(node.kind)})`;
    ctx.globalAlpha = dim ? 0.18 : 1;
    if (node.kind === "date") {
      // draw as square
      ctx.fillStyle = col;
      ctx.fillRect(node.x! - r, node.y! - r, r * 2, r * 2);
      ctx.lineWidth = isHovered ? 2 / scale : 1 / scale;
      ctx.strokeStyle = isHovered ? `rgb(${fg})` : `rgb(${border})`;
      ctx.strokeRect(node.x! - r, node.y! - r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = isHovered ? 2 / scale : 1 / scale;
      ctx.strokeStyle = isHovered ? `rgb(${fg})` : `rgb(${border})`;
      ctx.stroke();
    }
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
  }, [colorFor, fg, fgSubtle, border, hover, neighbors, matched]);

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const s = link.source, t = link.target;
    const sId = typeof s === "object" ? s.id : s;
    const tId = typeof t === "object" ? t.id : t;
    const active = hover && (hover === sId || hover === tId);
    const colKey = link.kind === "date" ? success : link.kind === "tag" ? warn : accent;
    ctx.strokeStyle = active ? `rgb(${colKey})` : `rgb(${border})`;
    ctx.globalAlpha = hover ? (active ? 0.9 : 0.10) : (link.kind === "link" ? 0.6 : 0.35);
    ctx.lineWidth = active ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [accent, success, warn, border, hover]);

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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-bg-elev/80 backdrop-blur rounded-lg px-2 py-1 border border-border text-xs">
          <Filter size={12} className="text-fg-subtle" />
          <ToggleChip active={showDates} onClick={() => setShowDates(d => !d)} color={`rgb(${success})`}>dates</ToggleChip>
          <ToggleChip active={showTags} onClick={() => setShowTags(t => !t)} color={`rgb(${warn})`}>tags</ToggleChip>
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-bg-elev/80 backdrop-blur rounded-lg px-1 py-1 border border-border">
          <button onClick={() => ref.current?.zoom((ref.current?.zoom() ?? 1) * 1.3, 200)} className="icon-btn h-7 w-7"><ZoomIn size={13} /></button>
          <button onClick={() => ref.current?.zoom((ref.current?.zoom() ?? 1) / 1.3, 200)} className="icon-btn h-7 w-7"><ZoomOut size={13} /></button>
          <button onClick={() => ref.current?.zoomToFit(400, 60)} className="icon-btn h-7 w-7"><LocateFixed size={13} /></button>
        </div>
        {data.nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-fg-subtle text-sm">
            Create notes with <span className="text-accent mx-1">[[wikilinks]]</span>, dates, or #tags to grow your graph.
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
            onNodeClick={(n) => {
              const node = n as GNode;
              if (node.kind === "note") navigate(`/notes/${node.id}`);
              else if (node.kind === "date") navigate("/calendar");
            }}
            enableNodeDrag
          />
        )}
      </div>
    </div>
  );
}

function ToggleChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 ${active ? "bg-bg-panel" : "opacity-40 hover:opacity-70"}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {children}
    </button>
  );
}

function getCss(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}
