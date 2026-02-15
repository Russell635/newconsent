import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { SurgeonProcedure, ConsentSection, SectionType } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Plus, Save, GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: 'description', label: 'Procedure Description' },
  { value: 'risks', label: 'Risks & Complications' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'alternatives', label: 'Alternatives' },
  { value: 'before_during_after', label: 'Before, During & After' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'custom', label: 'Custom Section' },
];

function SectionEditor({ section, onSave, onDelete }: {
  section: ConsentSection;
  onSave: (id: string, html: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(section.title);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ],
    content: section.content_html,
    editorProps: {
      attributes: {
        class: 'tiptap border border-gray-200 rounded-lg min-h-[150px]',
      },
    },
  });

  const handleSave = () => {
    if (editor) {
      onSave(section.id, editor.getHTML(), title);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-300" />
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            <Badge>{SECTION_TYPES.find((t) => t.value === section.section_type)?.label}</Badge>
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm font-medium text-gray-700 border-none focus:outline-none focus:ring-0 bg-transparent"
            placeholder="Section title..."
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleSave}><Save className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(section.id)}><Trash2 className="w-4 h-4 text-danger-500" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3">
          {editor && (
            <>
              <div className="flex items-center gap-1 mb-2 border-b border-gray-100 pb-2">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><b>B</b></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 text-xs rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><i>I</i></button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>List</button>
                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 text-xs rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>1. List</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-2 py-1 text-xs rounded ${editor.isActive('heading') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>H3</button>
              </div>
              <EditorContent editor={editor} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export function ContentBuilderPage() {
  const { procedureId } = useParams();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState<SurgeonProcedure | null>(null);
  const [sections, setSections] = useState<ConsentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!procedureId) return;
    const [procRes, secRes] = await Promise.all([
      supabase.from('surgeon_procedures').select('*').eq('id', procedureId).single(),
      supabase.from('consent_sections').select('*').eq('surgeon_procedure_id', procedureId).order('sort_order'),
    ]);
    setProcedure(procRes.data);
    setSections(secRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [procedureId]);

  const addSection = async (sectionType: SectionType) => {
    if (!procedureId) return;
    const label = SECTION_TYPES.find((t) => t.value === sectionType)?.label || 'New Section';
    const { data } = await supabase.from('consent_sections').insert({
      surgeon_procedure_id: procedureId,
      section_type: sectionType,
      title: label,
      content_html: '',
      sort_order: sections.length,
    }).select().single();
    if (data) setSections([...sections, data]);
  };

  const saveSection = async (id: string, html: string, title: string) => {
    setSaving(true);
    await supabase.from('consent_sections').update({ content_html: html, title }).eq('id', id);
    setSaving(false);
  };

  const deleteSection = async (id: string) => {
    if (!confirm('Delete this section?')) return;
    await supabase.from('consent_sections').delete().eq('id', id);
    setSections(sections.filter((s) => s.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!procedure) return <div className="p-8 text-center text-gray-400">Procedure not found</div>;

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/surgeon/procedures')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to My Procedures
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consent Content</h1>
          <p className="text-gray-500 mt-1">{procedure.name}</p>
        </div>
        {saving && <span className="text-sm text-gray-400">Saving...</span>}
      </div>

      <div className="space-y-4 mb-6">
        {sections.map((section) => (
          <SectionEditor key={section.id} section={section} onSave={saveSection} onDelete={deleteSection} />
        ))}
      </div>

      <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
        <p className="text-sm font-medium text-gray-500 mb-3">Add a section:</p>
        <div className="flex flex-wrap gap-2">
          {SECTION_TYPES.map((type) => (
            <Button key={type.value} variant="secondary" size="sm" onClick={() => addSection(type.value)}>
              <Plus className="w-3 h-3 mr-1" /> {type.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
