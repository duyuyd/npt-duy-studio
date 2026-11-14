"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, Box, GripVertical, Image as ImageIcon, MousePointer2, Plus, Redo2, Trash2, Type, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { addNode, findNode, moveNode, moveSibling, newNode, parseUiTree, removeNode, safeUrl, updateNode, type BuilderNode, type NodeKind, type NodeProps, type UiTree } from "@/lib/builder/tree";
import { savePageTree } from "@/app/projects/[projectId]/actions";
import { BuildPanel, type Job } from "@/components/BuildPanel";

const palette: { type: NodeKind; label: string; icon: typeof Type }[] = [
  { type: "text", label: "Văn bản", icon: Type }, { type: "button", label: "Nút bấm", icon: MousePointer2 },
  { type: "image", label: "Hình ảnh", icon: ImageIcon }, { type: "container", label: "Khung chứa", icon: Box }
];
type History = { past: UiTree[]; present: UiTree; future: UiTree[]; serial: number };
type Status = "saved" | "waiting" | "saving" | "error" | "conflict";
const labels: Record<NodeKind, string> = { text: "Văn bản", button: "Nút bấm", image: "Hình ảnh", container: "Khung chứa" };
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits.sort((a, b) => {
    const first = args.droppableRects.get(a.id), second = args.droppableRects.get(b.id);
    return (first ? first.width * first.height : Infinity) - (second ? second.width * second.height : Infinity);
  }) : closestCenter(args);
};

function PaletteItem({ item, onAdd }: { item: typeof palette[number]; onAdd: (type: NodeKind) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${item.type}` });
  const Icon = item.icon;
  return <div className="palette-item"><button ref={setNodeRef} type="button" className="drag-handle" aria-label={`Kéo ${item.label}`} {...attributes} {...listeners}><GripVertical size={16} /></button><button type="button" className="palette-add" onClick={() => onAdd(item.type)}><Icon size={17} /><span>{item.label}</span><Plus size={15} /></button>{isDragging && <span className="sr-only">Đang kéo {item.label}</span>}</div>;
}

function CanvasNode({ node, selected, onSelect, onMove, onRemove }: { node: BuilderNode; selected: string | null; onSelect: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onRemove: (id: string) => void }) {
  const drag = useDraggable({ id: `node:${node.id}` });
  const drop = useDroppable({ id: `drop:${node.id}`, disabled: node.type !== "container" });
  const style: CSSProperties = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, zIndex: 4 } : {};
  const contentStyle: CSSProperties = { color: node.props.color, backgroundColor: node.props.background, fontSize: node.props.fontSize, padding: node.props.padding };
  return <div ref={drag.setNodeRef} style={style} className={`canvas-node ${selected === node.id ? "is-selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}>
    <div className="node-toolbar"><button ref={drag.setActivatorNodeRef} type="button" className="drag-handle" aria-label={`Kéo ${labels[node.type]}`} {...drag.attributes} {...drag.listeners}><GripVertical size={15} /></button><span>{labels[node.type]}</span><div className="node-actions"><button type="button" title="Đưa lên" aria-label={`Đưa ${labels[node.type]} lên`} onClick={(event) => { event.stopPropagation(); onMove(node.id, -1); }}><ArrowUp size={14} /></button><button type="button" title="Đưa xuống" aria-label={`Đưa ${labels[node.type]} xuống`} onClick={(event) => { event.stopPropagation(); onMove(node.id, 1); }}><ArrowDown size={14} /></button><button type="button" title="Xóa" aria-label={`Xóa ${labels[node.type]}`} onClick={(event) => { event.stopPropagation(); onRemove(node.id); }}><Trash2 size={14} /></button></div></div>
    {node.type === "container" ? <div ref={drop.setNodeRef} className={`node-container ${drop.isOver ? "is-over" : ""}`} style={contentStyle}>{node.children.length ? node.children.map(child => <CanvasNode key={child.id} node={child} selected={selected} onSelect={onSelect} onMove={onMove} onRemove={onRemove} />) : <span className="drop-hint">Kéo khối vào đây hoặc chọn khung rồi bấm Thêm.</span>}</div> : node.type === "text" ? <div className="canvas-text" style={contentStyle}>{node.props.text || "Nhập nội dung"}</div> : node.type === "button" ? <div style={{ padding: node.props.padding }}><span className="canvas-button" style={{ color: node.props.color, background: node.props.background, fontSize: node.props.fontSize }}>{node.props.text || "Nút bấm"}</span></div> : <div style={contentStyle}>{node.props.url ? <img className="canvas-image" src={safeUrl(node.props.url, true)} alt={node.props.text} /> : <div className="image-placeholder"><ImageIcon size={22} /><span>Thêm đường dẫn ảnh</span></div>}</div>}
  </div>;
}

function UrlField({ label, value, image, onSave }: { label: string; value: string; image?: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  function finish() {
    const next = draft.trim();
    if (next && !safeUrl(next, image)) { setError("Hãy nhập đường dẫn hợp lệ bắt đầu bằng https://, http:// hoặc /."); return; }
    setError(""); onSave(next);
  }
  return <label className="field-label">{label}<input className="field-input" type="text" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onBlur={finish} aria-invalid={Boolean(error)} />{error && <span className="form-error" role="alert">{error}</span>}</label>;
}

export function BuilderWorkspace({ project, pageId, initialTree, initialRevision, jobs, buildConfigured, buildLoadError }: { project: { id: string; name: string; type: string }; pageId: string; initialTree: UiTree; initialRevision: number; jobs: Job[]; buildConfigured: boolean; buildLoadError: boolean }) {
  const [history, setHistory] = useState<History>({ past: [], present: initialTree, future: [], serial: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState<Status>("saved");
  const [message, setMessage] = useState("");
  const [saveCycle, setSaveCycle] = useState(0);
  const latest = useRef(initialTree);
  const serial = useRef(0);
  const savedSerial = useRef(0);
  const revision = useRef(initialRevision);
  const saving = useRef(false);
  const blocked = useRef(false);
  const root = useDroppable({ id: "drop:root" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const activeNode = selected ? findNode(history.present.nodes, selected) : undefined;

  function commit(change: (tree: UiTree) => UiTree) {
    setHistory(current => {
      const next = change(current.present);
      if (next === current.present || JSON.stringify(next) === JSON.stringify(current.present)) return current;
      if (!parseUiTree(next)) return current;
      return { past: [...current.past.slice(-49), current.present], present: next, future: [], serial: current.serial + 1 };
    });
  }
  function undo() { setHistory(current => current.past.length ? { past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future], serial: current.serial + 1 } : current); }
  function redo() { setHistory(current => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1), serial: current.serial + 1 } : current); }
  function changeProp<K extends keyof NodeProps>(key: K, value: NodeProps[K]) {
    if (!selected) return;
    commit(tree => ({ nodes: updateNode(tree.nodes, selected, node => ({ ...node, props: { ...node.props, [key]: value } })) }));
  }
  function add(type: NodeKind, parent = activeNode?.type === "container" ? activeNode.id : "root") {
    const node = newNode(type);
    const next = addNode(history.present, parent, node);
    if (!parseUiTree(next)) { setMessage("Trang đã đạt giới hạn 200 khối hoặc 8 tầng lồng nhau."); return; }
    commit(tree => addNode(tree, parent, node)); setSelected(node.id);
  }
  function endDrag(event: DragEndEvent) {
    const target = String(event.over?.id ?? "");
    if (!target.startsWith("drop:")) return;
    const parent = target.slice(5);
    const source = String(event.active.id);
    if (source.startsWith("palette:")) add(source.slice(8) as NodeKind, parent);
    else if (source.startsWith("node:")) { const id = source.slice(5); commit(tree => moveNode(tree, id, parent)); setSelected(id); }
  }

  const save = useCallback(async () => {
    if (saving.current || blocked.current || serial.current === savedSerial.current) return;
    saving.current = true; setStatus("saving"); setMessage("");
    const captured = serial.current;
    const result = await savePageTree(pageId, revision.current, latest.current);
    saving.current = false;
    if (!result.ok) { blocked.current = result.conflict; setStatus(result.conflict ? "conflict" : "error"); setMessage(result.error); return; }
    revision.current = result.revision; savedSerial.current = captured;
    if (serial.current === captured) setStatus("saved");
    else { setStatus("waiting"); setSaveCycle(value => value + 1); }
  }, [pageId]);

  useEffect(() => {
    latest.current = history.present; serial.current = history.serial;
    if (history.serial === savedSerial.current || blocked.current) return;
    setStatus("waiting");
    const timer = window.setTimeout(() => void save(), 2000);
    return () => window.clearTimeout(timer);
  }, [history.present, history.serial, save, saveCycle]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (serial.current !== savedSerial.current) { event.preventDefault(); event.returnValue = ""; } };
    const beforeNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || serial.current === savedSerial.current) return;
      const destination = new URL(target.getAttribute("href") ?? "", window.location.href);
      if (destination.origin === window.location.origin && destination.pathname.includes("/export")) {
        event.preventDefault(); event.stopPropagation(); setMessage("Hãy lưu các thay đổi trước khi xuất mã."); return;
      }
      if (!window.confirm("Trang còn thay đổi chưa lưu. Bạn có muốn rời khỏi trang?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigation, true); };
  }, []);

  return <main className="builder-wrap"><div className="builder-heading"><div><Link href="/dashboard" className="builder-back">← Dự án của tôi</Link><h1>{project.name}</h1></div><div className="builder-heading-actions"><span role="status" className={`save-status ${status}`}>{status === "saved" ? "Đã lưu" : status === "saving" ? "Đang lưu…" : status === "waiting" ? "Chưa lưu" : status === "conflict" ? "Cần tải lại" : "Lưu chưa thành công"}</span><button type="button" className="secondary-button" onClick={() => void save()} disabled={status === "saved" || status === "saving" || status === "conflict"}>Lưu ngay</button><a className="secondary-button" href={`/api/projects/${project.id}/export?target=web`}>Xuất Web</a><a className="secondary-button" href={`/api/projects/${project.id}/export?target=app`}>Xuất App</a></div></div>
    {message && <div className="banner" role="alert">{message} {status === "error" && <button type="button" className="text-action" onClick={() => { blocked.current = false; void save(); }}>Thử lưu lại</button>}</div>}
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={endDrag}><div className="builder-grid"><aside className="builder-panel palette-panel"><h2>Thêm khối</h2><p className="muted">Kéo hoặc bấm để thêm vào khung đang chọn.</p><div className="palette-list">{palette.map(item => <PaletteItem key={item.type} item={item} onAdd={add} />)}</div></aside>
      <section className="canvas-column"><div className="canvas-controls"><div><button className="icon-button" type="button" onClick={undo} disabled={!history.past.length} aria-label="Hoàn tác"><Undo2 size={17} /></button><button className="icon-button" type="button" onClick={redo} disabled={!history.future.length} aria-label="Làm lại"><Redo2 size={17} /></button></div><label>Thu phóng <select value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option><option value={125}>125%</option><option value={150}>150%</option></select></label></div><div className="canvas-scroll"><div ref={root.setNodeRef} className={`canvas-root ${root.isOver ? "is-over" : ""}`} style={{ zoom: zoom / 100 }} onClick={() => setSelected(null)}>{history.present.nodes.length ? history.present.nodes.map(node => <CanvasNode key={node.id} node={node} selected={selected} onSelect={setSelected} onMove={(id, direction) => commit(tree => ({ nodes: moveSibling(tree.nodes, id, direction) }))} onRemove={id => { commit(tree => ({ nodes: removeNode(tree.nodes, id) })); setSelected(null); }} />) : <div className="canvas-empty">Kéo một khối vào đây hoặc chọn khối ở bên trái.</div>}</div></div></section>
      <aside className="builder-panel properties-panel"><h2>Thuộc tính</h2>{activeNode ? <div className="property-fields"><p className="muted">Đang chọn: {labels[activeNode.type]}</p>{activeNode.type !== "container" && <label className="field-label">{activeNode.type === "image" ? "Mô tả ảnh" : "Nội dung"}<textarea className="field-input" rows={3} maxLength={1000} value={activeNode.props.text} onChange={event => changeProp("text", event.target.value)} /></label>}{activeNode.type === "image" && <UrlField key={`${activeNode.id}-url`} label="Đường dẫn ảnh" value={activeNode.props.url} image onSave={value => changeProp("url", value)} />}{activeNode.type === "button" && <UrlField key={`${activeNode.id}-href`} label="Liên kết nút" value={activeNode.props.href} onSave={value => changeProp("href", value)} />}<label className="field-label">Màu chữ<input type="color" value={activeNode.props.color} onChange={event => changeProp("color", event.target.value)} /></label><label className="field-label">Màu nền<input type="color" value={activeNode.props.background} onChange={event => changeProp("background", event.target.value)} /></label><label className="field-label">Cỡ chữ: {activeNode.props.fontSize}px<input type="range" min={10} max={72} value={activeNode.props.fontSize} onChange={event => changeProp("fontSize", Number(event.target.value))} /></label><label className="field-label">Khoảng đệm: {activeNode.props.padding}px<input type="range" min={0} max={96} value={activeNode.props.padding} onChange={event => changeProp("padding", Number(event.target.value))} /></label></div> : <p className="muted">Chọn một khối trên trang để sửa nội dung và màu sắc.</p>}</aside></div></DndContext>
    <BuildPanel projectId={project.id} jobs={jobs} configured={buildConfigured} isDirty={status !== "saved"} loadError={buildLoadError} />
  </main>;
}
