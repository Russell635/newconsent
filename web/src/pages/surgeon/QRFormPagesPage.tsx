import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, FileText, Trash2, Edit2 } from 'lucide-react';

interface QRFormPage {
  id: string;
  title: string;
  procedure_ids: string[];
  created_at: string;
}

export function QRFormPagesPage() {
  const { surgeonProfile } = useAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState<QRFormPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<QRFormPage | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPages = async () => {
    if (!surgeonProfile) return;
    const { data } = await supabase
      .from('qr_form_pages')
      .select('*')
      .eq('surgeon_id', surgeonProfile.id)
      .order('created_at');
    setPages(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPages(); }, [surgeonProfile]);

  const handleSave = async () => {
    if (!surgeonProfile || !title.trim()) return;
    setSaving(true);
    if (editingPage) {
      await supabase.from('qr_form_pages').update({ title: title.trim() }).eq('id', editingPage.id);
    } else {
      await supabase.from('qr_form_pages').insert({
        surgeon_id: surgeonProfile.id,
        title: title.trim(),
        procedure_ids: [],
      });
    }
    setSaving(false);
    setModalOpen(false);
    setEditingPage(null);
    setTitle('');
    loadPages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this QR form page?')) return;
    await supabase.from('qr_form_pages').delete().eq('id', id);
    loadPages();
  };

  const openEdit = (page: QRFormPage) => {
    setEditingPage(page);
    setTitle(page.title);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingPage(null);
    setTitle('');
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QR Form Pages</h1>
          <p className="text-sm text-gray-500 mt-1">Create printable pages with QR codes for your procedures</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New Page</Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : pages.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No QR form pages yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a page to organise your procedures with QR codes for patients to scan</p>
            <Button size="sm" className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Create First Page</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <Card key={page.id} className="cursor-pointer hover:border-primary-200 transition-colors" onClick={() => navigate(`/surgeon/qr-pages/${page.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{page.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{page.procedure_ids.length} procedure{page.procedure_ids.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(page); }} className="p-2 text-gray-400 hover:text-gray-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(page.id); }} className="p-2 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingPage ? 'Edit Page' : 'New QR Form Page'}>
        <div className="space-y-4">
          <Input
            label="Page Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Hip Operations, Knee Procedures"
            required
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!title.trim()}>
              {editingPage ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
