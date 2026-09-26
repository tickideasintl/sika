"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface ReceiptData {
  amount: number;
  date: string;
  vendor: string;
  category: string;
  items?: string[];
  receiptUrl: string;
  storageId: string;
  fileName: string;
}

interface ReceiptScannerProps {
  onScanComplete: (data: ReceiptData) => void;
  onCancel?: () => void;
}

export function ReceiptScanner({ onScanComplete, onCancel }: ReceiptScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await apiFetch<ReceiptData>("/api/receipts/scan", {
        method: "POST",
        body: formData,
      });

      toast({ title: "Receipt scanned", description: "Details extracted successfully" });
      onScanComplete(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to scan receipt";
      toast({ title: "Scan failed", description: message, variant: "destructive" });
      setPreview(null);
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-xl border p-2">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
            <Image src={preview} alt="Receipt preview" fill className="object-contain" />

            {scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-2 text-sm font-medium">Scanning receipt...</p>
              </div>
            )}

            {!scanning && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Remove receipt image"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={() => {
                  setPreview(null);
                  onCancel?.();
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Camera className="size-6 text-primary" />
          </div>

          <p className="font-medium">Upload receipt</p>
          <p className="mt-1 text-sm text-muted-foreground">Drop an image here or choose a file.</p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" />
                Choose image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>
        </div>
      )}
    </div>
  );
}
