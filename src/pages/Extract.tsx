import { useState } from "react";
import { Button } from "../components/ui/button";
import { FileText, Scissors, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Extract() {
    const [file, setFile] = useState<string | null>(null);
    const [pages, setPages] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<boolean>(false);

    const loadPreview = async (filePath: string) => {
        setPreviewError(false);
        try {
            const result = await window.electronAPI.readPdf(filePath);
            if (result.status === 'success' && result.data) {
                // Revoke old URL to avoid memory leaks
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }
                const blob = new Blob([result.data as any], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
            } else {
                setPreviewError(true);
            }
        } catch {
            setPreviewError(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.name.toLowerCase().endsWith(".pdf")) {
            let path = (droppedFile as any).path;
            if (!path) {
                path = window.electronAPI.getPathForFile(droppedFile as any);
            }
            if (path) {
                setFile(path);
                setPreviewUrl(null);
                setPreviewError(false);
                loadPreview(path);
                setStatus(null);
            }
        }
    };

    const handleSelectFile = async () => {
        const selected = await window.electronAPI.openFile();
        if (selected && selected.length > 0) {
            setFile(selected[0]);
            setPreviewUrl(null);
            setPreviewError(false);
            loadPreview(selected[0]);
            setStatus(null);
        }
    };

    const handleExtract = async () => {
        if (!file || !pages) return;
        setIsProcessing(true);
        setStatus("Selecting output file...");

        try {
            const outputPath = await window.electronAPI.saveFile();
            if (!outputPath) {
                setStatus("Cancelled");
                setIsProcessing(false);
                return;
            }

            setStatus("Extracting...");
            const result = await window.electronAPI.extractPages(file, pages, outputPath);

            if (result.status === 'success') {
                setStatus(`Success! Saved to ${outputPath}`);
                setPages("");
                setFile(null);
            } else {
                setStatus(`Error: ${result.message}`);
            }
        } catch (error) {
            setStatus(`Error: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold">Extract Pages</h2>
                    <p className="text-muted-foreground mt-2">Extract specific pages or ranges from a PDF.</p>
                </div>
            </div>

            <div className="grid gap-8">
                <div
                    className={cn(
                        "border-2 border-dashed rounded-lg p-8 transition-colors min-h-[200px] flex flex-col items-center justify-center cursor-pointer",
                        isDragging ? "border-primary bg-primary/5" : "border-border",
                        file ? "bg-card" : "hover:bg-muted/10"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={!file ? handleSelectFile : undefined}
                >
                    {file ? (
                        <div className="flex items-center gap-4 bg-background border px-6 py-4 rounded-lg shadow-sm">
                            <div className="w-10 h-10 rounded bg-red-100/10 text-red-500 flex items-center justify-center shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium truncate max-w-[400px]">{file.split(/[\\/]/).pop()}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[400px]">{file}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <Scissors className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Drag and drop a PDF file here</p>
                            <p className="text-sm">or click to browse</p>
                        </div>
                    )}
                </div>

                <div className="bg-card border rounded-lg p-6 space-y-4">
                    <label className="block text-sm font-medium mb-1">Page Ranges</label>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={pages}
                            onChange={(e) => setPages(e.target.value)}
                            placeholder="e.g. 1, 3-5, 8"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                        />
                        <Button onClick={handleExtract} disabled={!file || !pages || isProcessing} className="w-32">
                            {isProcessing ? "Working..." : "Extract"}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Enter page numbers and/or ranges separated by commas. Example: '1, 3-5, 10' will extract pages 1, 3, 4, 5, and 10.
                    </p>
                </div>

                {file && (
                    <div className="border rounded-lg overflow-hidden bg-muted/20 h-[600px] flex items-center justify-center relative">
                        {previewUrl && !previewError ? (
                            <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
                        ) : (
                            <div className="text-center">
                                {previewError ? (
                                    <p className="text-destructive">Failed to load preview</p>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-muted-foreground">Loading preview...</p>
                                    </div>
                                )}
                            </div>
                        )}
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
