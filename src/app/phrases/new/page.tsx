'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';

interface Language {
  id: string;
  code: string;
  name: string;
}

export default function NewPhrasePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nativeLanguageId: '',
    learningLanguageId: '',
    situationText: '',
    expectedAnswer: '',
    situationExplanation: '',
    difficulty: 'BEGINNER',
    cefrLevel: 'A1',
    category: '',
  });

  useEffect(() => {
    // Esperar a que termine de cargar la autenticación
    if (authLoading) {
      return;
    }

    if (!user || !isAdmin) {
      router.push('/login');
      return;
    }

    loadLanguages();
  }, [user, isAdmin, authLoading, router]);

  const loadLanguages = async () => {
    try {
      const data = await apiGet<Language[]>('/api/languages');
      setLanguages(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiPost('/api/phrases', formData);
      router.push('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Nueva Frase</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma Nativo
                  </label>
                  <select
                    required
                    value={formData.nativeLanguageId}
                    onChange={(e) =>
                      setFormData({ ...formData, nativeLanguageId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Seleccionar...</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma a Aprender
                  </label>
                  <select
                    required
                    value={formData.learningLanguageId}
                    onChange={(e) =>
                      setFormData({ ...formData, learningLanguageId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Seleccionar...</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Dificultad
                  </label>
                  <select
                    required
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="BEGINNER">Principiante</option>
                    <option value="INTERMEDIATE">Intermedio</option>
                    <option value="ADVANCED">Avanzado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel CEFR *
                  </label>
                  <select
                    required
                    value={formData.cefrLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, cefrLevel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="A1">A1 - Principiante</option>
                    <option value="A2">A2 - Básico</option>
                    <option value="B1">B1 - Intermedio</option>
                    <option value="B2">B2 - Intermedio-Alto</option>
                    <option value="C1">C1 - Avanzado</option>
                    <option value="C2">C2 - Maestría</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: Saludos, Comida, Viajes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Situación/Pregunta en Idioma a Aprender *
                </label>
                <textarea
                  required
                  value={formData.situationText}
                  onChange={(e) =>
                    setFormData({ ...formData, situationText: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: Wie würden Sie einen Kaffee bestellen?"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Escribe la situación o pregunta en el idioma que se está aprendiendo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Respuesta Esperada en Idioma a Aprender *
                </label>
                <textarea
                  required
                  value={formData.expectedAnswer}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedAnswer: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: Hallo, ich möchte bitte einen Kaffee."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Escribe la respuesta esperada en el idioma que se está aprendiendo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explicación de la Situación (Opcional)
                </label>
                <textarea
                  value={formData.situationExplanation}
                  onChange={(e) =>
                    setFormData({ ...formData, situationExplanation: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Explicación en idioma nativo del contexto de la situación..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Breve explicación en el idioma nativo para dar contexto
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Frase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

