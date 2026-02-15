import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Plus, X, Printer, GripVertical } from 'lucide-react';
import QRCode from 'react-qr-code';

interface SurgeonProcedure {
  id: string;
  name: string;
  description: string;
}

export function QRFormPageEditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { surgeonProfile } = useAuth();
  const navigate = useNavigate();
  const [pageTitle, setPageTitle] = useState('');
  const [allProcedures, setAllProcedures] = useState<SurgeonProcedure[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!surgeonProfile || !pageId) return;
    loadData();
  }, [surgeonProfile, pageId]);

  const loadData = async () => {
    const [pageRes, procsRes] = await Promise.all([
      supabase.from('qr_form_pages').select('*').eq('id', pageId!).single(),
      supabase.from('surgeon_procedures').select('id, name, description').eq('surgeon_id', surgeonProfile!.id).order('name'),
    ]);
    if (pageRes.data) {
      setPageTitle(pageRes.data.title);
      setSelectedIds(pageRes.data.procedure_ids || []);
    }
    setAllProcedures(procsRes.data || []);
    setLoading(false);
  };

  const addProcedure = (id: string) => {
    if (selectedIds.includes(id)) return;
    const updated = [...selectedIds, id];
    setSelectedIds(updated);
    saveSelection(updated);
  };

  const removeProcedure = (id: string) => {
    const updated = selectedIds.filter(i => i !== id);
    setSelectedIds(updated);
    saveSelection(updated);
  };

  const saveSelection = async (ids: string[]) => {
    await supabase.from('qr_form_pages').update({ procedure_ids: ids }).eq('id', pageId!);
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedProcedures = selectedIds
    .map(id => allProcedures.find(p => p.id === id))
    .filter(Boolean) as SurgeonProcedure[];

  const availableProcedures = allProcedures.filter(p => !selectedIds.includes(p.id));

  const qrBaseUrl = 'https://app.consentmaker.com/consent';

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <div className="no-print">
        <button onClick={() => navigate('/surgeon/qr-pages')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to QR Form Pages
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <Button size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> Print Page</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:grid-cols-1">
        {/* Available procedures (left panel) */}
        <div className="no-print">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Available Procedures</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {availableProcedures.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">All procedures have been added</p>
            ) : (
              availableProcedures.map(proc => (
                <Card key={proc.id} className="cursor-pointer hover:border-primary-200 transition-colors" onClick={() => addProcedure(proc.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{proc.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{proc.description}</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Selected procedures with QR codes (right panel — printable) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 no-print">Page Content</h2>

          {/* Print header */}
          <div className="print-only mb-8">
            <h1 className="text-xl font-bold text-gray-900">{surgeonProfile?.practice_name || 'Medical Practice'}</h1>
            <h2 className="text-lg text-gray-700">{pageTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">Scan a QR code with the ConsentMaker app to begin your consent process</p>
          </div>

          {selectedProcedures.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-8">Add procedures from the left panel</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedProcedures.map(proc => (
                <Card key={proc.id}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <QRCode value={`${qrBaseUrl}/${proc.id}`} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{proc.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{proc.description}</p>
                    </div>
                    <button onClick={() => removeProcedure(proc.id)} className="text-gray-400 hover:text-red-500 no-print flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          /* Remove background colours and shadows for clean print */
          * { box-shadow: none !important; }
          body { background: white !important; }
          main { background: white !important; padding: 0 !important; }
          /* Ensure the printable content fills the page */
          .print-content { width: 100%; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}
