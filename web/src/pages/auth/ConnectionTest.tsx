import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
}

export function ConnectionTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const runTests = async () => {
    setResults([]);
    setRunning(true);

    // Test 1: Check env vars
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    addResult({
      name: 'Environment Variables',
      status: url && key ? 'pass' : 'fail',
      message: url && key
        ? `URL: ${url.substring(0, 30)}... | Key: ${key.substring(0, 20)}...`
        : `Missing: ${!url ? 'VITE_SUPABASE_URL ' : ''}${!key ? 'VITE_SUPABASE_ANON_KEY' : ''}`,
    });

    // Test 2: Basic connection - try to reach Supabase
    try {
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      addResult({
        name: 'Supabase REST API Connection',
        status: response.ok ? 'pass' : 'fail',
        message: response.ok ? `Connected (HTTP ${response.status})` : `HTTP ${response.status}: ${response.statusText}`,
      });
    } catch (err: any) {
      addResult({
        name: 'Supabase REST API Connection',
        status: 'fail',
        message: `Network error: ${err.message}`,
      });
    }

    // Test 3: Auth health check
    try {
      const response = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
      });
      const data = await response.json().catch(() => null);
      addResult({
        name: 'Supabase Auth Service',
        status: response.ok ? 'pass' : 'fail',
        message: response.ok ? `Auth healthy: ${JSON.stringify(data)}` : `HTTP ${response.status}: ${JSON.stringify(data)}`,
      });
    } catch (err: any) {
      addResult({
        name: 'Supabase Auth Service',
        status: 'fail',
        message: `Error: ${err.message}`,
      });
    }

    // Test 4: Check if specialties table exists (migration check)
    try {
      const { data, error } = await supabase.from('specialties').select('id', { count: 'exact', head: true });
      if (error) {
        addResult({
          name: 'Migration Check (specialties table)',
          status: 'fail',
          message: `Error: ${error.message} | Code: ${error.code} — You need to run the migration SQL in Supabase SQL Editor`,
        });
      } else {
        addResult({
          name: 'Migration Check (specialties table)',
          status: 'pass',
          message: `Table exists`,
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Migration Check (specialties table)',
        status: 'fail',
        message: `Error: ${err.message}`,
      });
    }

    // Test 5: Check if user_profiles table exists
    try {
      const { data, error } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true });
      if (error) {
        addResult({
          name: 'Migration Check (user_profiles table)',
          status: 'fail',
          message: `Error: ${error.message} — This table is required for registration to work`,
        });
      } else {
        addResult({
          name: 'Migration Check (user_profiles table)',
          status: 'pass',
          message: `Table exists`,
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Migration Check (user_profiles table)',
        status: 'fail',
        message: `Error: ${err.message}`,
      });
    }

    // Test 6: Try a test signup (won't actually create if email confirmation is on)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: `test-${Date.now()}@connection-test.local`,
        password: 'test-password-123',
        options: { data: { full_name: 'Connection Test', role: 'surgeon' } },
      });
      if (error) {
        addResult({
          name: 'Auth Signup Test',
          status: 'fail',
          message: `Error: ${error.message} | Status: ${error.status}`,
        });
      } else {
        addResult({
          name: 'Auth Signup Test',
          status: data.user ? 'pass' : 'fail',
          message: data.user
            ? `Signup works! User ID: ${data.user.id} (you can delete this test user from Supabase dashboard)`
            : `Signup returned no user. Confirm email may be required. Session: ${data.session ? 'yes' : 'no'}`,
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Auth Signup Test',
        status: 'fail',
        message: `Error: ${err.message}`,
      });
    }

    setRunning(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Supabase Connection Test</h1>
        <p className="text-gray-500 mb-6">Diagnose database connectivity issues</p>

        <Button onClick={runTests} loading={running} className="mb-6">Run Connection Tests</Button>

        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                  r.status === 'pass' ? 'bg-green-500' : r.status === 'fail' ? 'bg-red-500' : 'bg-gray-300'
                }`}>
                  {r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className={`text-sm mt-0.5 ${r.status === 'fail' ? 'text-red-600' : 'text-gray-500'}`}>{r.message}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {results.length > 0 && results.some((r) => r.status === 'fail') && (
          <Card className="mt-6 bg-amber-50 border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-2">Common Fixes:</h3>
            <ul className="text-sm text-amber-700 space-y-1 list-disc pl-5">
              <li>If tables are missing: run <code className="bg-amber-100 px-1 rounded">src/sql/migration.sql</code> in the Supabase SQL Editor</li>
              <li>If auth fails: check Supabase Dashboard → Authentication → Settings → enable email provider</li>
              <li>If "Database error saving new user": the <code className="bg-amber-100 px-1 rounded">handle_new_user</code> trigger may have failed — check the migration ran fully</li>
              <li>Check Supabase Dashboard → Database → Logs for detailed error messages</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
