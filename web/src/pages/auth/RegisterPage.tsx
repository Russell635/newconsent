import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldCheck } from 'lucide-react';
import type { UserRole } from '../../types/database';

const roleOptions: { value: UserRole; label: string; description: string }[] = [
  { value: 'surgeon', label: 'Surgeon', description: 'Manage procedures & consents' },
  { value: 'manager', label: 'Manager', description: 'Practice administration' },
  { value: 'nurse', label: 'Nurse', description: 'Clinical assistant' },
  { value: 'admin', label: 'Admin', description: 'Platform administrator' },
];

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('surgeon');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signUp(email, password, fullName, role);
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <ShieldCheck className="w-8 h-8 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ConsentMaker</h1>
          <p className="text-gray-500 mt-1">Create your account</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Register</h2>
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-red-200 rounded-lg text-sm text-danger-700">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      role === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" loading={loading} className="w-full">Create Account</Button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-4">
            Already have an account? <Link to="/login" className="text-primary-500 hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
