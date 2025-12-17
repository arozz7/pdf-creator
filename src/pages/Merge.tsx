import { useState } from "react";
import { Button } from "../components/ui/button";
import { FileText, X, Plus } from "lucide-react";
import { cn } from "../lib/utils";

// I will use native drag and drop to avoid another dependency for now, or just install react-dropzone.
// Let's use simple file input + drag drop.

export function Merge() {
    const [files, setFiles] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

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

        const newFiles: string[] = [];
        const droppedFiles = Array.from(e.dataTransfer.files);

        for (const file of droppedFiles) {
            if (file.name.toLowerCase().endsWith(".pdf")) {
                try {
                    // Try getting path (Electron puts it on File object usually but sometimes hidden)
                    let path = (file as any).path;
                    if (!path) {
                        path = window.electronAPI.getPathForFile(file as any);
                    }
                    if (path) {
                        newFiles.push(path);
                    }
                } catch (err) {
                    console.error("Error getting file path:", err);
                }
            }
        }

        if (newFiles.length > 0) {
            setFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const handleAddFiles = async () => {
        const selected = await window.electronAPI.openFile();
        if (selected && selected.length > 0) {
            setFiles((prev) => [...prev, ...selected]);
        }
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
            const result = await window.electronAPI.mergePdfs(files, outputPath);

            if (result.status === 'success') {
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

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold">Merge PDFs</h2>
                    <p className="text-muted-foreground mt-2">Combine multiple PDF files into a single document.</p>
                </div>
                <div className="space-x-4">
                    <Button onClick={handleAddFiles} variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Files
                    </Button>
                    <Button onClick={handleMerge} disabled={files.length < 2 || isMerging} className="gap-2">
                        Merge Files
                    </Button>
                </div>
            </div>

            <div
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 transition-colors min-h-[300px] flex flex-col",
                    isDragging ? "border-primary bg-primary/5" : "border-border",
                    files.length === 0 ? "justify-center items-center" : ""
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
                    <div className="grid gap-3">
                        {files.map((file, index) => (
                            <div key={`${file}-${index}`} className="flex items-center justify-between bg-card border px-4 py-3 rounded-md group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded bg-red-100/10 text-red-500 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm truncate font-medium" title={file}>
                                        {file.split(/[\\/]/).pop()}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                        {file}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {status && (
                <div className={cn("mt-4 p-4 rounded-md", status.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500")}>
                    {status}
                </div>
            )}
        </div>
    );
}
