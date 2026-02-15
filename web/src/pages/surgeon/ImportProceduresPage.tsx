import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Specialty, MasterProcedure } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Check, ChevronRight, AlertTriangle } from 'lucide-react';

export function ImportProceduresPage() {
  const { surgeonProfile, user } = useAuth();
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [procedures, setProcedures] = useState<MasterProcedure[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('specialties').select('*').order('sort_order').then(({ data, error: err }) => {
      if (err) {
        setLoadError(`Failed to load specialties: ${err.message}`);
      } else {
        setSpecialties(data || []);
        if (!data || data.length === 0) {
          setLoadError('No specialties found. Has the migration SQL been run?');
        }
      }
    });

    if (surgeonProfile) {
      supabase
        .from('surgeon_procedures')
        .select('master_procedure_id')
        .eq('surgeon_id', surgeonProfile.id)
        .not('master_procedure_id', 'is', null)
        .then(({ data }) => {
          setImportedIds(new Set(data?.map((p) => p.master_procedure_id!).filter(Boolean) || []));
        });
    }
  }, [surgeonProfile]);

  const loadProcedures = async (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    setError(null);
    const { data, error: err } = await supabase
      .from('master_procedures')
      .select('*')
      .eq('specialty_id', specialty.id)
      .order('name');
    if (err) {
      setError(`Failed to load procedures: ${err.message}`);
    }
    setProcedures(data || []);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    const importable = procedures.filter((p) => !importedIds.has(p.id)).map((p) => p.id);
    setSelected(new Set(importable));
  };

  const handleImport = async () => {
    setError(null);

    if (!surgeonProfile) {
      setError('Surgeon profile not found. Please complete onboarding first (Settings > Profile).');
      return;
    }
    if (selected.size === 0) {
      setError('Please select at least one procedure to import.');
      return;
    }

    setImporting(true);

    const toImport = procedures.filter((p) => selected.has(p.id));
    const inserts = toImport.map((p) => ({
      surgeon_id: surgeonProfile.id,
      master_procedure_id: p.id,
      imported_version: p.version,
      name: p.name,
      description: p.description,
      duration_minutes: p.duration_minutes,
      recovery_time: p.recovery_time,
      risks: p.risks,
      benefits: p.benefits,
      alternatives: p.alternatives,
      is_custom: false,
    }));

    const { data: insertData, error: insertError } = await supabase.from('surgeon_procedures').insert(inserts).select();

    if (insertError) {
      setError(`Import failed: ${insertError.message} (Code: ${insertError.code})`);
      setImporting(false);
      return;
    }

    if (!insertData || insertData.length === 0) {
      setError('Import returned no data — RLS policy may be blocking the insert. Check Supabase RLS policies on surgeon_procedures table.');
      setImporting(false);
      return;
    }

    setImporting(false);
    navigate('/surgeon/procedures');
  };

  // Debug info if surgeon profile is missing
  if (!surgeonProfile) {
    return (
      <div>
        <button onClick={() => navigate('/surgeon/procedures')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to My Procedures
        </button>
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Surgeon Profile Not Found</h3>
              <p className="text-sm text-amber-700 mt-1">
                Your surgeon profile hasn't been created yet. This usually means onboarding wasn't completed.
              </p>
              <p className="text-sm text-amber-700 mt-1">
                User ID: <code className="bg-amber-100 px-1 rounded">{user?.id || 'not logged in'}</code>
              </p>
              <Button size="sm" className="mt-3" onClick={() => navigate('/surgeon/onboarding')}>
                Complete Onboarding
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => selectedSpecialty ? setSelectedSpecialty(null) : navigate('/surgeon/procedures')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> {selectedSpecialty ? 'Back to Specialties' : 'Back to My Procedures'}
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import from Master List</h1>

      {(error || loadError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error || loadError}
        </div>
      )}

      {!selectedSpecialty ? (
        <div className="space-y-2">
          {specialties.length === 0 && !loadError && (
            <p className="text-gray-400 text-center py-8">Loading specialties...</p>
          )}
          {specialties.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:border-primary-200 transition-colors" onClick={() => loadProcedures(s)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">{selectedSpecialty.name}</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>Select All Available</Button>
              <Button size="sm" onClick={handleImport} loading={importing} disabled={selected.size === 0}>
                Import Selected ({selected.size})
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {procedures.length === 0 && (
              <p className="text-gray-400 text-center py-8">No procedures found for this specialty.</p>
            )}
            {procedures.map((proc) => {
              const alreadyImported = importedIds.has(proc.id);
              const isSelected = selected.has(proc.id);
              return (
                <Card
                  key={proc.id}
                  className={`cursor-pointer transition-colors ${alreadyImported ? 'opacity-50' : ''} ${
                    isSelected ? 'border-primary-500 bg-primary-50/30' : 'hover:border-gray-300'
                  }`}
                  onClick={() => !alreadyImported && toggleSelect(proc.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-primary-500 border-primary-500' : alreadyImported ? 'bg-gray-200 border-gray-300' : 'border-gray-300'
                    }`}>
                      {(isSelected || alreadyImported) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{proc.name}</h3>
                        <Badge variant="info" size="sm">v{proc.version}</Badge>
                        {alreadyImported && <Badge variant="success" size="sm">Already Imported</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{proc.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
