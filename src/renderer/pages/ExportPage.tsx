import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Download as ExportIcon,
  Table as CsvIcon,
  FileText as WordIcon,
  FileDown as PdfIcon,
  X as CloseIcon,
  Loader2,
} from 'lucide-react';
import * as API from '../../api/api';

interface ExportPageProps {
  documentId: string;
  documentTitle: string;
}

const ExportPage: React.FC<ExportPageProps> = ({ documentId, documentTitle }) => {
  const [format, setFormat] = useState<string>('csv');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeTraceability, setIncludeTraceability] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const blob = await API.exportDocument(documentId, format as 'csv' | 'word' | 'pdf', {
        includeHistory,
        includeTraceability,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extensions: Record<string, string> = { csv: '.csv', word: '.docx', pdf: '.pdf' };
      a.download = `${documentTitle}${extensions[format] || '.csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ text: `${format.toUpperCase()} export completed`, severity: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Export failed', severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const formats = [
    { value: 'csv', label: 'CSV Spreadsheet', icon: <CsvIcon className="h-5 w-5" />, description: 'Export requirements as a comma-separated values file for spreadsheet analysis' },
    { value: 'word', label: 'Word Document', icon: <WordIcon className="h-5 w-5" />, description: 'Export as a formatted .docx document with hierarchy and styling' },
    { value: 'pdf', label: 'PDF Report', icon: <PdfIcon className="h-5 w-5" />, description: 'Export as a professional PDF report with table of contents' },
  ];

  return (
    <div className="p-6 max-w-[800px]">
      <div className="flex items-center gap-2 mb-6">
        <ExportIcon className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">
          Export Document
        </h2>
      </div>

      {message && (
        <Alert
          variant={message.severity === 'error' ? 'destructive' : 'default'}
          className="mb-4"
        >
          <AlertDescription className="flex items-center justify-between w-full">
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-2 rounded-md p-0.5 hover:bg-accent"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-4 mb-4">
        <h3 className="text-base font-semibold mb-4">
          Export Format
        </h3>
        <div className="flex flex-col gap-4">
          {formats.map((fmt) => (
            <div
              key={fmt.value}
              onClick={() => setFormat(fmt.value)}
              className={`p-4 border-2 rounded cursor-pointer transition-colors ${
                format === fmt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {fmt.icon}
                <span className={`text-sm ${format === fmt.value ? 'font-semibold' : 'font-normal'}`}>
                  {fmt.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {fmt.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 mb-4">
        <h3 className="text-base font-semibold mb-4">
          Options
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeTraceability"
              checked={includeTraceability}
              onCheckedChange={(checked) => setIncludeTraceability(checked === true)}
            />
            <Label htmlFor="includeTraceability">Include traceability links</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeHistory"
              checked={includeHistory}
              onCheckedChange={(checked) => setIncludeHistory(checked === true)}
            />
            <Label htmlFor="includeHistory">Include version history (Word/PDF only)</Label>
          </div>
        </div>
      </div>

      <Button
        variant="default"
        size="lg"
        onClick={handleExport}
        disabled={exporting}
        className="w-full"
      >
        {exporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <ExportIcon className="h-4 w-4" />
            Export as {format.toUpperCase()}
          </>
        )}
      </Button>
    </div>
  );
};

export default ExportPage;
