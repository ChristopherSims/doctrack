import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import * as API from '../../api/api';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle?: string;
  onImportComplete: () => void;
}

interface ParsedRow {
  level: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  changeRequestId: string;
  changeRequestLink: string;
  testPlan: string;
  testPlanLink: string;
  onedevIssueLink: string;
  onedevBuildLink: string;
  onedevCommitLink: string;
  verificationMethod: string;
  rationale: string;
  tags: string;
  _rowIndex: number;
  _valid: boolean;
  _error?: string;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  'level': 'level',
  'title': 'title',
  'description': 'description',
  'status': 'status',
  'priority': 'priority',
  'change request id': 'changeRequestId',
  'change request link': 'changeRequestLink',
  'test plan': 'testPlan',
  'test plan link': 'testPlanLink',
  'onedev issue link': 'onedevIssueLink',
  'onedev build link': 'onedevBuildLink',
  'onedev commit link': 'onedevCommitLink',
  'verification method': 'verificationMethod',
  'rationale': 'rationale',
  'tags': 'tags',
};

const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: Array<{ row: number; title?: string; error: string }> } | null>(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setParsedRows([]);
    setImporting(false);
    setResult(null);
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    onOpenChange(false);
    // Reset after dialog closes
    setTimeout(reset, 200);
  };

  const parseCSV = (text: string): ParsedRow[] => {
    // Simple CSV parser — handles quoted fields with commas and newlines
    const lines: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          current.push(field.trim());
          field = '';
        } else if (ch === '\r') {
          // skip
        } else if (ch === '\n') {
          current.push(field.trim());
          field = '';
          if (current.length > 1 || current[0] !== '') {
            lines.push(current);
          }
          current = [];
        } else {
          field += ch;
        }
      }
    }
    // Last field / line
    current.push(field.trim());
    if (current.length > 1 || current[0] !== '') {
      lines.push(current);
    }

    if (lines.length === 0) throw new Error('CSV file is empty');

    // Parse header row — map column names to field keys
    const headers = lines[0].map(h => h.toLowerCase().trim());
    const colMap: (keyof ParsedRow | null)[] = headers.map(h => COLUMN_MAP[h] || null);

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i];
      const row: any = {
        level: '1',
        title: '',
        description: '',
        status: 'draft',
        priority: 'medium',
        changeRequestId: '',
        changeRequestLink: '',
        testPlan: '',
        testPlanLink: '',
        onedevIssueLink: '',
        onedevBuildLink: '',
        onedevCommitLink: '',
        verificationMethod: '',
        rationale: '',
        tags: '',
        _rowIndex: i,
        _valid: true,
      };

      for (let j = 0; j < colMap.length && j < values.length; j++) {
        const key = colMap[j];
        if (key) {
          row[key] = values[j];
        }
      }

      // Validate
      if (!row.title.trim()) {
        row._valid = false;
        row._error = 'Missing title';
      }

      rows.push(row);
    }

    return rows;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // Strip BOM if present
        const cleanText = text.replace(/^\uFEFF/, '');
        const rows = parseCSV(cleanText);
        if (rows.length === 0) {
          setParseError('No data rows found in the CSV file.');
          return;
        }
        setParsedRows(rows);
        setStep('preview');
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await API.downloadCSVTemplate(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle}_import_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const validRows = parsedRows.filter(r => r._valid);
      const requirements = validRows.map(r => ({
        level: r.level,
        title: r.title,
        description: r.description,
        status: r.status || 'draft',
        priority: r.priority || 'medium',
        changeRequestId: r.changeRequestId,
        changeRequestLink: r.changeRequestLink,
        testPlan: r.testPlan,
        testPlanLink: r.testPlanLink,
        onedevIssueLink: r.onedevIssueLink,
        onedevBuildLink: r.onedevBuildLink,
        onedevCommitLink: r.onedevCommitLink,
        verificationMethod: r.verificationMethod,
        rationale: r.rationale,
        tags: r.tags,
      }));

      const res = await API.importCSVRequirements(documentId, requirements);
      if (res.success && res.data) {
        setResult(res.data);
        setStep('result');
        onImportComplete();
      } else {
        setParseError(res.error || 'Import failed');
      }
    } catch (err: any) {
      setParseError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r._valid).length;
  const invalidCount = parsedRows.filter(r => !r._valid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Requirements from CSV'}
            {step === 'preview' && `Preview — ${parsedRows.length} Rows`}
            {step === 'result' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && `Import requirements into "${documentTitle}" from a CSV file.`}
            {step === 'preview' && 'Review the parsed requirements before importing.'}
            {step === 'result' && 'Your requirements have been processed.'}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <span className="text-xs text-muted-foreground">
                Get the CSV template with the correct column headers
              </span>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .csv files with headers matching the template
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Required columns:</p>
              <p>Level, Title, Description, Status, Priority, Change Request ID, Change Request Link, Test Plan, Test Plan Link, Verification Method, Rationale, Tags</p>
              <p className="mt-2 font-medium">Notes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Title is the only required field</li>
                <li>Tags can be comma-separated (e.g., "safety, performance")</li>
                <li>Status values: draft, review, approved, implemented, verified</li>
                <li>Priority values: low, medium, high</li>
              </ul>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex gap-2">
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                {validCount} Valid
              </Badge>
              {invalidCount > 0 && (
                <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                  {invalidCount} Invalid
                </Badge>
              )}
              <Badge variant="outline">
                {parsedRows.length} Total
              </Badge>
            </div>

            <div className="overflow-auto flex-1 border rounded-md" style={{ maxHeight: '300px' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row._rowIndex} className={!row._valid ? 'bg-red-500/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{row._rowIndex}</TableCell>
                      <TableCell className="text-xs">{row.level}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {row.title || <span className="text-red-500 italic">missing</span>}
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                      <TableCell className="text-xs">{row.priority}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{row.tags}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {invalidCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {invalidCount} row(s) with missing titles will be skipped during import.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Result Step */}
        {step === 'result' && result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">
                {result.imported} requirement{result.imported !== 1 ? 's' : ''} imported successfully
              </span>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                </p>
                <div className="border rounded-md overflow-auto max-h-[150px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{err.row}</TableCell>
                          <TableCell className="text-xs">{err.title || '—'}</TableCell>
                          <TableCell className="text-xs text-destructive">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); reset(); }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Import {validCount} Requirement{validCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImportDialog;
