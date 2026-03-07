import { useState, useRef } from "react";
import { Button } from "../components/ui/button";
import { FileText, X, Plus, GripVertical, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

type FileEntry = {
    id: string;
    path: string;
    name: string;
    pageCount: number | null;
    pages: ThumbnailPage[] | null;
};

let nextId = 0;
function makeId() {
    return String(++nextId);
}

function getFileName(filePath: string) {
    return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function Merge() {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    // Drag-to-reorder state
    const dragIndexRef = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Serialize all Python IPC calls — concurrent requests corrupt the stdio response stream
    const loadQueueRef = useRef<Promise<void>>(Promise.resolve());

    function loadThumbnails(id: string, path: string) {
        loadQueueRef.current = loadQueueRef.current.then(async () => {
            const result = await window.electronAPI.getThumbnails(path);
            if (result.status === "success" && result.data) {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === id
                            ? { ...f, pages: result.data!.pages, pageCount: result.data!.page_count }
                            : f
                    )
                );
            }
        });
    }

    function addPaths(paths: string[]) {
        const newEntries: FileEntry[] = paths.map((p) => ({
            id: makeId(),
            path: p,
            name: getFileName(p),
            pageCount: null,
            pages: null,
        }));
        setFiles((prev) => [...prev, ...newEntries]);
        for (const entry of newEntries) {
            loadThumbnails(entry.id, entry.path);
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const paths: string[] = [];
        for (const file of Array.from(e.dataTransfer.files)) {
            if (file.name.toLowerCase().endsWith(".pdf")) {
                const p = (file as any).path || window.electronAPI.getPathForFile(file as any);
                if (p) paths.push(p);
            }
        }
        if (paths.length > 0) addPaths(paths);
    };

    const handleAddFiles = async () => {
        const selected = await window.electronAPI.openFile();
        if (selected && selected.length > 0) addPaths(selected);
    };

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setStatus(null);
    };

    const handleMerge = async () => {
        if (files.length < 2) return;
        setIsMerging(true);
        setStatus("Selecting output file...");

        try {
            const outputPath = await window.electronAPI.saveFile();
            if (!outputPath) {
                setStatus("Cancelled");
                setIsMerging(false);
                return;
            }

            setStatus("Merging...");
            const result = await window.electronAPI.mergePdfs(
                files.map((f) => f.path),
                outputPath
            );

            if (result.status === "success") {
                setStatus(`Success! Saved to ${outputPath}`);
                setFiles([]);
            } else {
                setStatus(`Error: ${result.message}`);
            }
        } catch (error) {
            setStatus(`Error: ${error}`);
        } finally {
            setIsMerging(false);
        }
    };

    // Drag-to-reorder handlers (file list rows)
    const handleRowDragStart = (e: React.DragEvent, index: number) => {
        dragIndexRef.current = index;
        e.dataTransfer.effectAllowed = "move";
        // Prevent the outer drop zone from receiving this as a file drop
        e.dataTransfer.setData("application/x-reorder", String(index));
    };

    const handleRowDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDragOverIndex(index);
    };

    const handleRowDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const dragIndex = dragIndexRef.current;
        if (dragIndex === null || dragIndex === dropIndex) {
            dragIndexRef.current = null;
            setDragOverIndex(null);
            return;
        }
        setFiles((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(dropIndex, 0, moved);
            return next;
        });
        dragIndexRef.current = null;
        setDragOverIndex(null);
    };

    const handleRowDragEnd = () => {
        dragIndexRef.current = null;
        setDragOverIndex(null);
    };

    const totalPages = files.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);
    const allThumbnails = files.flatMap((f) => f.pages ?? []);

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold">Merge PDFs</h2>
                    <p className="text-muted-foreground mt-2">
                        Combine multiple PDF files into a single document.
                    </p>
                </div>
                <div className="space-x-4">
                    <Button onClick={handleAddFiles} variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Files
                    </Button>
                    <Button
                        onClick={handleMerge}
                        disabled={files.length < 2 || isMerging}
                        className="gap-2"
                    >
                        Save Merged PDF
                    </Button>
                </div>
            </div>

            {/* Drop zone — only active when no files, or always visible as outer area */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-lg transition-colors",
                    isDragging ? "border-primary bg-primary/5" : "border-border",
                    files.length === 0 ? "p-8 flex justify-center items-center min-h-[200px]" : "p-4"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {files.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Drag and drop PDF files here</p>
                        <p className="text-sm">or click "Add Files" above</p>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        {files.map((file, index) => (
                            <div
                                key={file.id}
                                draggable
                                onDragStart={(e) => handleRowDragStart(e, index)}
                                onDragOver={(e) => handleRowDragOver(e, index)}
                                onDrop={(e) => handleRowDrop(e, index)}
                                onDragEnd={handleRowDragEnd}
                                className={cn(
                                    "flex items-center justify-between bg-card border px-3 py-2.5 rounded-md group cursor-grab active:cursor-grabbing transition-colors",
                                    dragOverIndex === index && dragIndexRef.current !== index
                                        ? "border-t-2 border-t-primary"
                                        : ""
                                )}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="w-7 h-7 rounded bg-red-100/10 text-red-500 flex items-center justify-center shrink-0">
                                        <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-sm font-medium truncate" title={file.path}>
                                        {file.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {file.pageCount === null ? (
                                            <Loader2 className="w-3 h-3 animate-spin inline" />
                                        ) : (
                                            `${file.pageCount} ${file.pageCount === 1 ? "pg" : "pgs"}`
                                        )}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Thumbnail preview grid */}
            {files.length > 0 && (
                <div className="mt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                        Preview —{" "}
                        {files.some((f) => f.pageCount === null) ? (
                            <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> loading…
                            </span>
                        ) : (
                            `${totalPages} ${totalPages === 1 ? "page" : "pages"}`
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {allThumbnails.map((thumb, i) => (
                            <div
                                key={i}
                                className="border rounded overflow-hidden bg-white shadow-sm"
                                style={{ width: 80, height: Math.round(80 * (thumb.height / thumb.width)) }}
                            >
                                <img
                                    src={`data:image/png;base64,${thumb.image}`}
                                    alt={`Page ${i + 1}`}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {status && (
                <div
                    className={cn(
                        "mt-4 p-4 rounded-md text-sm",
                        status.startsWith("Error")
                            ? "bg-destructive/10 text-destructive"
                            : "bg-green-500/10 text-green-500"
                    )}
                >
                    {status}
                </div>
            )}
        </div>
    );
}
