"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  analyzeTransactionImport,
  type TransactionImportField,
  type TransactionImportMapping,
} from "@/lib/transaction-import";

interface TransactionImportProps {
  onImported?: () => void;
}

interface ImportApiErrorRow {
  lineNumber: number;
  errors: string[];
}

const SAMPLE_CSV = `date,amount,type,category,notes
2026-03-01,45.50,expense,Food & Dining,Lunch
2026-03-02,1200.00,income,Salary,Monthly salary
2026-03-03,100.00,giving,Tithe,Sunday giving`;

const FIELD_OPTIONS: { value: TransactionImportField; label: string; required?: boolean }[] = [
  { value: "date", label: "Date", required: true },
  { value: "amount", label: "Amount", required: true },
  { value: "type", label: "Type", required: true },
  { value: "category", label: "Category", required: true },
  { value: "notes", label: "Notes" },
  { value: "tags", label: "Tags" },
];

const UNMAPPED_VALUE = "__unmapped__";

export function TransactionImport({ onImported }: TransactionImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<TransactionImportMapping>({});
  const [serverErrorRows, setServerErrorRows] = useState<ImportApiErrorRow[]>([]);
  const { toast } = useToast();

  const analysis = useMemo(() => {
    if (!fileText) return null;

    try {
      return analyzeTransactionImport(fileText, mapping);
    } catch {
      return null;
    }
  }, [fileText, mapping]);

  const handleImport = async () => {
    if (!selectedFile || !analysis) return;

    setUploading(true);
    setServerErrorRows([]);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      for (const field of FIELD_OPTIONS) {
        const value = mapping[field.value];
        if (value) {
          formData.append(`mapping:${field.value}`, value);
        }
      }

      const response = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (Array.isArray((body as { invalid_rows?: ImportApiErrorRow[] }).invalid_rows)) {
          setServerErrorRows((body as { invalid_rows: ImportApiErrorRow[] }).invalid_rows);
        }
        throw new Error((body as { error?: string }).error ?? "Failed to import CSV");
      }

      const imported = (body as { imported?: number }).imported ?? 0;
      const skipped = (body as { skipped?: number }).skipped ?? 0;

      toast({
        title: "Import complete",
        description: skipped > 0 ? `${imported} imported, ${skipped} skipped` : `${imported} transactions added`,
      });

      setOpen(false);
      setSelectedFile(null);
      setFileText("");
      setMapping({});
      onImported?.();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const initialAnalysis = analyzeTransactionImport(text);
      setSelectedFile(file);
      setFileText(text);
      setMapping(initialAnalysis.mappings);
      setServerErrorRows([]);
      setOpen(true);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unable to read CSV",
        variant: "destructive",
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateMapping = (field: TransactionImportField, value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === UNMAPPED_VALUE) {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const previewRows = analysis?.previewRows.slice(0, 6) ?? [];
  const invalidPreviewRows = previewRows.filter((row) => !row.valid);
  const missingRequiredMappings = analysis?.missingRequiredMappings ?? [];
  const canImport = !!analysis && missingRequiredMappings.length === 0 && analysis.validRowCount > 0 && !uploading;

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sika-transactions-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload className="mr-2 size-4" />
        Import CSV
      </Button>
      <Button type="button" variant="ghost" className="h-11" onClick={downloadSample}>
        <Download className="mr-2 size-4" />
        Sample CSV
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              Review CSV import
            </DialogTitle>
            <DialogDescription>
              Confirm the column mapping, then import only the valid rows.
            </DialogDescription>
          </DialogHeader>

          {analysis && (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rows found</p>
                  <p className="mt-1 text-2xl font-semibold">{analysis.totalRows}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ready to import</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{analysis.validRowCount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs attention</p>
                  <p className="mt-1 text-2xl font-semibold text-expense">{analysis.invalidRowCount}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {FIELD_OPTIONS.map((field) => (
                  <div key={field.value} className="space-y-2">
                    <Label>{field.label}{field.required ? " *" : ""}</Label>
                    <Select
                      value={mapping[field.value] ?? UNMAPPED_VALUE}
                      onValueChange={(value) => updateMapping(field.value, value)}
                    >
                      <SelectTrigger aria-label={`Column for ${field.label}`}>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED_VALUE}>Not mapped</SelectItem>
                        {analysis.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {missingRequiredMappings.length > 0 && (
                <p className="text-sm text-expense">
                  Map required fields before importing: {missingRequiredMappings.join(", ")}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Preview</h3>
                  <p className="text-xs text-muted-foreground">Showing first {previewRows.length} rows</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.lineNumber} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 font-medium">{row.lineNumber}</td>
                          <td className="px-3 py-2">{row.mapped.date || "-"}</td>
                          <td className="px-3 py-2">{row.mapped.amount ? formatCurrency(Number.parseFloat(row.mapped.amount) || 0) : "-"}</td>
                          <td className="px-3 py-2">{row.mapped.type || "-"}</td>
                          <td className="px-3 py-2">{row.mapped.category || "-"}</td>
                          <td className={`px-3 py-2 ${row.valid ? "text-foreground" : "text-expense"}`}>
                            {row.valid ? "Ready" : row.errors.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(invalidPreviewRows.length > 0 || serverErrorRows.length > 0) && (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
                  <p className="font-medium">Rows with issues</p>
                  {invalidPreviewRows.map((row) => (
                    <p key={row.lineNumber}>Row {row.lineNumber}: {row.errors.join(", ")}</p>
                  ))}
                  {serverErrorRows.map((row) => (
                    <p key={`server-${row.lineNumber}`}>Row {row.lineNumber}: {row.errors.join(", ")}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
            <Button type="button" onClick={() => void handleImport()} disabled={!canImport}>
              {uploading ? "Importing..." : `Import ${analysis?.validRowCount ?? 0} valid rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
