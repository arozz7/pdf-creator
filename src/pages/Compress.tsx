import { useState } from "react";
import { Button } from "../components/ui/button";
import { FileText, Shrink, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Compress() {
    const [file, setFile] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

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
                setStatus(null);
            }
        }
    };

    const handleSelectFile = async () => {
        const selected = await window.electronAPI.openFile();
        if (selected && selected.length > 0) {
            setFile(selected[0]);
            setStatus(null);
        }
    };

    const handleCompress = async () => {
        if (!file) return;
        setIsProcessing(true);
        setStatus("Selecting output file...");

        try {
            const outputPath = await window.electronAPI.saveFile();
            if (!outputPath) {
                setStatus("Cancelled");
                setIsProcessing(false);
                return;
            }

            setStatus("Compressing (this may take a while)...");
            const result = await window.electronAPI.compressPdf(file, outputPath);

            if (result.status === 'success') {
                setStatus(`Success! Saved to ${outputPath}`);
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
                    <h2 className="text-3xl font-bold">Compress PDF</h2>
                    <p className="text-muted-foreground mt-2">Optimize file size of your PDF documents.</p>
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
                            <div className="w-10 h-10 rounded bg-blue-100/10 text-blue-500 flex items-center justify-center shrink-0">
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
                            <Shrink className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Drag and drop a PDF file here</p>
                            <p className="text-sm">or click to browse</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleCompress} disabled={!file || isProcessing} size="lg" className="w-full sm:w-auto">
                        {isProcessing ? "Working..." : "Compress PDF"}
                    </Button>
                </div>
            </div>

            {status && (
                <div className={cn("mt-4 p-4 rounded-md", status.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500")}>
                    {status}
                </div>
            )}
        </div>
    );
}
