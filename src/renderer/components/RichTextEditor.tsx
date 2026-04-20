import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TableIcon,
  ImageIcon,
  Code,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1 rounded hover:bg-accent transition-colors ${
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const ToolbarSeparator: React.FC = () => (
  <div className="w-px h-5 bg-border mx-0.5" />
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'border-collapse border border-border',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-border',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-1 min-w-[60px]',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border p-1 min-w-[60px] bg-muted font-semibold',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full',
          style: 'max-width: 100%',
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[120px] max-h-[300px] overflow-auto',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes into the editor
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHTML = editor.getHTML();
      if (value !== currentHTML) {
        editor.commands.setContent(value || '');
      }
    }
  }, [value, editor]);

  if (!editor) return null;

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const insertImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 p-1.5 border-b bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          onClick={insertTable}
          title="Insert Table (3x3)"
        >
          <TableIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={insertImage}
          title="Insert Image"
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="size-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
      {!editor.getText() && placeholder && (
        <div className="pointer-events-none absolute mt-[46px] px-3 py-2 text-sm text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
