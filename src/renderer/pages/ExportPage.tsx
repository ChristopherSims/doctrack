import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  TableChart as CsvIcon,
  Description as WordIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
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
    { value: 'csv', label: 'CSV Spreadsheet', icon: <CsvIcon />, description: 'Export requirements as a comma-separated values file for spreadsheet analysis' },
    { value: 'word', label: 'Word Document', icon: <WordIcon />, description: 'Export as a formatted .docx document with hierarchy and styling' },
    { value: 'pdf', label: 'PDF Report', icon: <PdfIcon />, description: 'Export as a professional PDF report with table of contents' },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <ExportIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Export Document
        </Typography>
      </Box>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Export Format
        </Typography>
        <Stack spacing={2}>
          {formats.map((fmt) => (
            <Box
              key={fmt.value}
              onClick={() => setFormat(fmt.value)}
              sx={{
                p: 2,
                border: '2px solid',
                borderColor: format === fmt.value ? '#1976d2' : '#e0e0e0',
                borderRadius: 1,
                cursor: 'pointer',
                backgroundColor: format === fmt.value ? '#e3f2fd' : 'transparent',
                '&:hover': { borderColor: '#1976d2' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {fmt.icon}
                <Typography variant="body1" sx={{ fontWeight: format === fmt.value ? 600 : 400 }}>
                  {fmt.label}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                {fmt.description}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Options
        </Typography>
        <Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeTraceability}
                onChange={(e) => setIncludeTraceability(e.target.checked)}
              />
            }
            label="Include traceability links"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
              />
            }
            label="Include version history (Word/PDF only)"
          />
        </Stack>
      </Paper>

      <Button
        variant="contained"
        size="large"
        startIcon={<ExportIcon />}
        onClick={handleExport}
        disabled={exporting}
        fullWidth
      >
        {exporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
      </Button>
    </Box>
  );
};

export default ExportPage;
