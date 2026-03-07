import { useState, useRef, useEffect } from "react";
import { Button } from "../components/ui/button";
import { FileText, X, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "../lib/utils";

type BlockFormat = {
    fontSize: number;
    bold: boolean;
    italic: boolean;
    color: string;
    align: number;
};

const DEFAULT_FORMAT: BlockFormat = {
    fontSize: 12, bold: false, italic: false, color: "#000000", align: 0,
};

type EditEntry = {
    page: number;
    bbox: [number, number, number, number];
    new_text: string;
    font_size: number;
    bold: boolean;
    italic: boolean;
    color: string;
    align: number;
};

export function Edit() {
    const [file, setFile] = useState<string | null>(null);
    const [pages, setPages] = useState<PageData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [edits, setEdits] = useState<Map<string, EditEntry>>(new Map());
    const [activeBlock, setActiveBlock] = useState<string | null>(null);
    const [activeText, setActiveText] = useState("");
    const [activeFormat, setActiveFormat] = useState<BlockFormat>(DEFAULT_FORMAT);
    const [isSaving, setIsSaving] = useState(false);
    const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
    const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    // Native mousedown listener on the panel DOM node — fires during bubble phase
    // on the actual element, BEFORE the browser processes the default focus-transfer
    // action. React synthetic onMouseDown fires too late (delegated to #root).
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const prevent = (e: MouseEvent) => e.preventDefault();
        panel.addEventListener('mousedown', prevent);
        return () => panel.removeEventListener('mousedown', prevent);
    }, [panelPos]); // re-runs each time the panel mounts/unmounts

    // Refs hold the always-current values of active edit state so that
    // handleSave and commitEdit never read stale closure values.
    const activeTextRef = useRef("");
    const activeFormatRef = useRef<BlockFormat>(DEFAULT_FORMAT);
    const activeInfoRef = useRef<{ key: string; pageNo: number; block: TextBlock } | null>(null);

    // Keeps both the render state and the ref in sync on every format change.
    const updateFormat = (fn: (f: BlockFormat) => BlockFormat) => {
        const next = fn(activeFormatRef.current);
        activeFormatRef.current = next;
        setActiveFormat(next);
    };
    const [status, setStatus] = useState<string | null>(null);

    const loadFile = async (path: string) => {
        setFile(path);
        setPages([]);
        setEdits(new Map());
        setActiveBlock(null);
        setStatus(null);
        setIsLoading(true);
        try {
            const result = await window.electronAPI.getPages(path);
            if (result.status === "success" && result.data) {
                setPages(result.data);
            } else {
                setStatus(`Error: ${result.message}`);
            }
        } catch (err) {
            setStatus(`Error: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped?.name.toLowerCase().endsWith(".pdf")) {
            const path = (dropped as any).path || window.electronAPI.getPathForFile(dropped as any);
            if (path) loadFile(path);
        }
    };

    const handleSelectFile = async () => {
        const selected = await window.electronAPI.openFile();
        if (selected?.length > 0) loadFile(selected[0]);
    };

    const blockKey = (pageNo: number, blockNo: number) => `${pageNo}-${blockNo}`;

    const activateBlock = (key: string, currentText: string, block: TextBlock, pageNo: number) => {
        const existing = edits.get(key);
        const fmt = existing ? {
            fontSize: existing.font_size,
            bold: existing.bold,
            italic: existing.italic,
            color: existing.color,
            align: existing.align,
        } : { ...DEFAULT_FORMAT, fontSize: block.font_size };
        activeFormatRef.current = fmt;
        activeTextRef.current = currentText;
        activeInfoRef.current = { key, pageNo, block };
        setActiveFormat(fmt);
        setActiveBlock(key);
        setActiveText(currentText);
    };

    const commitEdit = (key: string, page: number, block: TextBlock, text: string) => {
        const fmt = activeFormatRef.current;
        const newEdits = new Map(edits);
        const formatChanged =
            fmt.bold || fmt.italic ||
            fmt.color !== DEFAULT_FORMAT.color ||
            fmt.align !== DEFAULT_FORMAT.align ||
            fmt.fontSize !== block.font_size;

        if (text !== block.text || formatChanged) {
            newEdits.set(key, {
                page,
                bbox: [block.x0, block.y0, block.x1, block.y1],
                new_text: text,
                font_size: fmt.fontSize,
                bold: fmt.bold,
                italic: fmt.italic,
                color: fmt.color,
                align: fmt.align,
            });
        } else {
            newEdits.delete(key);
        }
        activeInfoRef.current = null;
        setPanelPos(null);
        setEdits(newEdits);
        setActiveBlock(null);
        setActiveText("");
    };

    const cancelEdit = () => {
        activeInfoRef.current = null;
        setPanelPos(null);
        setActiveBlock(null);
        setActiveText("");
    };

    const handleSave = async () => {
        if (!file) return;

        // Flush any in-progress edit synchronously from refs before reading state.
        const pendingEdits = new Map(edits);
        const info = activeInfoRef.current;
        if (info) {
            const { key, pageNo, block } = info;
            const text = activeTextRef.current;
            const fmt = activeFormatRef.current;
            const formatChanged =
                fmt.bold || fmt.italic ||
                fmt.color !== DEFAULT_FORMAT.color ||
                fmt.align !== DEFAULT_FORMAT.align ||
                fmt.fontSize !== block.font_size;
            if (text !== block.text || formatChanged) {
                pendingEdits.set(key, {
                    page: pageNo,
                    bbox: [block.x0, block.y0, block.x1, block.y1],
                    new_text: text,
                    font_size: fmt.fontSize,
                    bold: fmt.bold,
                    italic: fmt.italic,
                    color: fmt.color,
                    align: fmt.align,
                });
            }
        }

        if (pendingEdits.size === 0) return;

        setIsSaving(true);
        setStatus("Selecting output file...");
        try {
            const outputPath = await window.electronAPI.saveFile();
            if (!outputPath) {
                setStatus("Cancelled");
                return;
            }
            setStatus("Saving edits...");
            const result = await window.electronAPI.editPdf(file, outputPath, Array.from(pendingEdits.values()));
            if (result.status === "success") {
                setStatus(`Success! Saved to ${outputPath}`);
                setEdits(new Map());
                activeInfoRef.current = null;
                setPanelPos(null);
                setActiveBlock(null);
                setActiveText("");
            } else {
                setStatus(`Error: ${result.message}`);
            }
        } catch (err) {
            setStatus(`Error: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPages([]);
        setEdits(new Map());
        setPanelPos(null);
        setActiveBlock(null);
        setStatus(null);
    };

    // ── File selection / loading screen ──────────────────────────────────────
    if (!file || isLoading || pages.length === 0) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold">Edit PDF</h2>
                    <p className="text-muted-foreground mt-2">
                        Click a text block to edit it. Right-click to set formatting (bold, size, color, alignment).
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center gap-3 py-24">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-muted-foreground">Loading PDF pages...</p>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 transition-colors min-h-[200px] flex flex-col items-center justify-center cursor-pointer",
                            isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/10"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleSelectFile}
                    >
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium text-muted-foreground">Drag and drop a PDF file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                )}

                {status && (
                    <div className={cn("mt-4 p-4 rounded-md", status.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500")}>
                        {status}
                    </div>
                )}
            </div>
        );
    }

    // ── Editor screen ─────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Header bar */}
            <div className="flex items-center justify-between px-8 py-4 border-b bg-card shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="font-medium truncate">{file.split(/[\\/]/).pop()}</span>
                    {edits.size > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                            {edits.size} unsaved edit{edits.size > 1 ? "s" : ""}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Button variant="outline" onClick={handleClose}>
                        <X className="w-4 h-4 mr-2" />
                        Close
                    </Button>
                    <Button onClick={handleSave} disabled={edits.size === 0 || isSaving}>
                        {isSaving ? "Saving..." : "Save PDF"}
                    </Button>
                </div>
            </div>

            {/* Page viewer */}
            <div className="flex-1 overflow-auto bg-muted/30 p-8">
                <div className="flex flex-col items-center gap-10 max-w-4xl mx-auto">
                    {pages.map((page) => (
                        <div key={page.page_no} className="w-full">
                            <p className="text-xs text-muted-foreground text-center mb-2">
                                Page {page.page_no + 1} of {pages.length}
                            </p>

                            {/* Page container — percentage-based overlay positioning */}
                            <div
                                className="relative w-full shadow-lg select-none"
                                style={{ aspectRatio: `${page.width} / ${page.height}` }}
                            >
                                <img
                                    src={`data:image/png;base64,${page.image}`}
                                    className="absolute inset-0 w-full h-full"
                                    draggable={false}
                                />

                                {page.blocks.map((block) => {
                                    const key = blockKey(page.page_no, block.block_no);
                                    const isActive = activeBlock === key;
                                    const editEntry = edits.get(key);
                                    const isEdited = edits.has(key);
                                    const displayText = isActive
                                        ? activeText
                                        : (editEntry?.new_text ?? block.text);

                                    const style: React.CSSProperties = {
                                        left: `${(block.x0 / page.width) * 100}%`,
                                        top: `${(block.y0 / page.height) * 100}%`,
                                        width: `${((block.x1 - block.x0) / page.width) * 100}%`,
                                        height: `${((block.y1 - block.y0) / page.height) * 100}%`,
                                    };

                                    return (
                                        <div
                                            key={key}
                                            className={cn(
                                                "absolute overflow-hidden cursor-text",
                                                !isActive && !isEdited && "hover:bg-primary/10 hover:ring-1 hover:ring-primary/50 ring-inset",
                                                isEdited && !isActive && "ring-1 ring-amber-400/70 ring-inset"
                                            )}
                                            style={style}
                                            onClick={() => !isActive && activateBlock(key, displayText, block, page.page_no)}
                                            onContextMenu={(e) => e.preventDefault()}
                                        >
                                            {/* Edited-but-not-active: show replacement text as white overlay */}
                                            {!isActive && isEdited && (
                                                <div className="w-full h-full bg-white p-0.5 text-xs text-foreground overflow-hidden whitespace-pre-wrap leading-snug">
                                                    {editEntry!.new_text}
                                                </div>
                                            )}

                                            {/* Active: inline textarea */}
                                            {isActive && (
                                                <textarea
                                                    autoFocus
                                                    ref={(el) => { activeTextareaRef.current = el; }}
                                                    className="w-full h-full resize-none bg-white/95 border border-primary p-0.5 text-xs text-foreground leading-snug focus:outline-none focus:ring-2 focus:ring-primary"
                                                    value={activeText}
                                                    onChange={(e) => {
                                        activeTextRef.current = e.target.value;
                                        setActiveText(e.target.value);
                                    }}
                                                    onBlur={() => commitEdit(key, page.page_no, block, activeTextRef.current)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Escape") cancelEdit();
                                                    }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating format panel — right-click on any text block to open.
                onMouseDown e.preventDefault() on the container ensures NO control
                inside ever steals focus from the active textarea. */}
            {panelPos && activeBlock && (
                <div
                    ref={panelRef}
                    className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5 w-[252px]"
                    style={{ left: panelPos.x, top: panelPos.y }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {/* Row 1: Bold / Italic + Alignment */}
                    <div className="flex items-center gap-1">
                        {([
                            { label: <Bold className="w-3.5 h-3.5" />, key: "bold" as const },
                            { label: <Italic className="w-3.5 h-3.5" />, key: "italic" as const },
                        ] as const).map(({ label, key }) => (
                            <button
                                key={key}
                                className={cn(
                                    "w-7 h-7 flex items-center justify-center rounded text-sm",
                                    activeFormat[key] ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                                onMouseDown={(e) => { e.preventDefault(); updateFormat(f => ({ ...f, [key]: !f[key] })); }}
                            >
                                {label}
                            </button>
                        ))}
                        <div className="w-px h-5 bg-border mx-1" />
                        {([
                            { icon: AlignLeft, value: 0 },
                            { icon: AlignCenter, value: 1 },
                            { icon: AlignRight, value: 2 },
                        ] as const).map(({ icon: Icon, value }) => (
                            <button
                                key={value}
                                className={cn(
                                    "w-7 h-7 flex items-center justify-center rounded",
                                    activeFormat.align === value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                                onMouseDown={(e) => { e.preventDefault(); updateFormat(f => ({ ...f, align: value })); }}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>

                    {/* Row 2: Font size */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-8">Size</span>
                        <button
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted font-medium select-none"
                            onMouseDown={(e) => { e.preventDefault(); updateFormat(f => ({ ...f, fontSize: Math.max(6, f.fontSize - 1) })); }}
                        >−</button>
                        <span className="w-8 text-center text-sm tabular-nums select-none">{activeFormat.fontSize}</span>
                        <button
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted font-medium select-none"
                            onMouseDown={(e) => { e.preventDefault(); updateFormat(f => ({ ...f, fontSize: Math.min(144, f.fontSize + 1) })); }}
                        >+</button>
                    </div>

                    {/* Row 3: Color swatches */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-8">Color</span>
                        <div className="flex gap-1 flex-wrap">
                            {["#000000", "#6b7280", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#8b5cf6", "#ffffff"].map(hex => (
                                <button
                                    key={hex}
                                    title={hex}
                                    className={cn(
                                        "w-5 h-5 rounded-sm border",
                                        activeFormat.color === hex
                                            ? "ring-2 ring-primary ring-offset-1"
                                            : hex === "#ffffff" ? "border-border" : "border-transparent"
                                    )}
                                    style={{ backgroundColor: hex }}
                                    onMouseDown={(e) => { e.preventDefault(); updateFormat(f => ({ ...f, color: hex })); }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Status bar */}
            {status && (
                <div className={cn(
                    "px-8 py-3 text-sm border-t shrink-0",
                    status.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500"
                )}>
                    {status}
                </div>
            )}
        </div>
    );
}
