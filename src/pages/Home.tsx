export function Home() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h2 className="text-4xl font-bold mb-4">Welcome to PDF Creator</h2>
            <p className="text-muted-foreground text-lg max-w-md">
                Select a tool from the sidebar to get started. You can merge files, extract pages, or compress your PDFs.
            </p>
        </div>
    );
}
