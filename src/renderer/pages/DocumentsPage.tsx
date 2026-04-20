import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Document } from '../../types/index';
import * as API from '../../api/api';

interface DocumentsPageProps {
  onSelectDocument: (id: string, title: string) => void;
}

const getStatusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-secondary text-secondary-foreground',
    review: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
    approved: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
    released: 'bg-primary text-primary-foreground',
  };
  return map[status] || 'bg-secondary text-secondary-foreground';
};

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="size-4" />
          New Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="py-12">
          <div className="text-center px-6">
            <p className="text-muted-foreground">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              Click &quot;New Document&quot; to get started
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-md"
              onClick={() => onSelectDocument(doc.id, doc.title)}
            >
              <div className="flex items-center gap-6 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">{doc.title}</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {doc.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">v{doc.version}</Badge>
                  <Badge className={getStatusBadgeClass(doc.status)}>
                    {doc.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-2">
                    {doc.owner}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 border-l pl-4 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialog(doc);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Edit Document' : 'New Document'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="doc-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="doc-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="doc-description">Description</Label>
              <Textarea
                id="doc-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="doc-owner">
                Owner <span className="text-destructive">*</span>
              </Label>
              <Input
                id="doc-owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveDocument}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsPage;
