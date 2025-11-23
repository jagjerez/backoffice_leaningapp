'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiDelete } from '@/lib/api';

interface Phrase {
  id: string;
  nativeText: string;
  learningText: string;
  difficulty: string;
  nativeLanguage: { code: string; name: string };
  learningLanguage: { code: string; name: string };
}

export default function DashboardPage() {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!isAdmin) {
      router.push('/login');
      return;
    }

    loadPhrases();
  }, [user, isAdmin, router]);

  const loadPhrases = async () => {
    try {
      const data = await apiGet<{ phrases: Phrase[] }>('/api/phrases?limit=50');
      setPhrases(data.phrases);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta frase?')) return;

    try {
      await apiDelete(`/api/phrases/${id}`);
      setPhrases(phrases.filter((p) => p.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Dashboard - Learning App</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user?.email}</span>
              <Link
                href="/phrases/generate"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Generar con IA
              </Link>
              <Link
                href="/phrases/new"
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Nueva Frase
              </Link>
              {isAdmin && (
                <Link
                  href="/users"
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Usuarios
                </Link>
              )}
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium mb-4">Frases ({phrases.length})</h2>
              
              {phrases.length === 0 ? (
                <p className="text-gray-500">No hay frases. Crea una nueva frase para comenzar.</p>
              ) : (
                <div className="space-y-4">
                  {phrases.map((phrase) => (
                    <div
                      key={phrase.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {phrase.difficulty}
                            </span>
                            <span className="text-xs text-gray-500">
                              {phrase.nativeLanguage.name} → {phrase.learningLanguage.name}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-1">
                            <strong>Original:</strong> {phrase.nativeText}
                          </p>
                          <p className="text-gray-600">
                            <strong>Traducción:</strong> {phrase.learningText}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Link
                            href={`/phrases/${phrase.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => handleDelete(phrase.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

