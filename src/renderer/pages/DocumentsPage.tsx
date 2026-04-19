import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  TextField,
  Stack,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Document } from '../../types/index';
import * as API from '../../api/api';

interface DocumentsPageProps {
  onSelectDocument: (id: string) => void;
}

const DocumentsPage: React.FC<DocumentsPageProps> = ({ onSelectDocument }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', owner: '' });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const result = await API.getDocuments();
      if (result.success) {
        setDocuments(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (doc?: Document) => {
    if (doc) {
      setEditingDoc(doc);
      setFormData({ title: doc.title, description: doc.description, owner: doc.owner });
    } else {
      setEditingDoc(null);
      setFormData({ title: '', description: '', owner: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDoc(null);
    setFormData({ title: '', description: '', owner: '' });
  };

  const handleSaveDocument = async () => {
    try {
      if (editingDoc) {
        const result = await API.updateDocument(editingDoc.id, formData);
        if (result.success) {
          await loadDocuments();
        }
      } else {
        const result = await API.createDocument(formData);
        if (result.success) {
          await loadDocuments();
        }
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save document:', error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        const result = await API.deleteDocument(id);
        if (result.success) {
          await loadDocuments();
        }
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
      draft: 'default',
      review: 'warning',
      approved: 'success',
      released: 'primary',
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Documents</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Document
        </Button>
      </Box>

      {documents.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="textSecondary" gutterBottom>
              No documents yet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Click "New Document" to get started
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {documents.map((doc) => (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'translateY(-4px)',
                  },
                  transition: 'all 0.3s ease',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={() => onSelectDocument(doc.id)}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {doc.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, minHeight: '40px' }}>
                    {doc.description}
                  </Typography>
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`v${doc.version}`} size="small" />
                    <Chip label={doc.status} size="small" color={getStatusColor(doc.status)} />
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Owner: {doc.owner}
                  </Typography>
                </CardContent>
                <Box sx={{ p: 2, borderTop: '1px solid #eee', display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialog(doc);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id);
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            {editingDoc ? 'Edit Document' : 'New Document'}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
            />
            <TextField
              label="Owner"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              fullWidth
              required
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveDocument}>
                Save
              </Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>
    </Container>
  );
};

export default DocumentsPage;
