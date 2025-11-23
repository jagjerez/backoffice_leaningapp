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

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 - Principiante' },
  { value: 'A2', label: 'A2 - Básico' },
  { value: 'B1', label: 'B1 - Intermedio' },
  { value: 'B2', label: 'B2 - Intermedio-Alto' },
  { value: 'C1', label: 'C1 - Avanzado' },
  { value: 'C2', label: 'C2 - Maestría' },
];

const CATEGORIES = [
  'Saludos y presentaciones',
  'Comida y restaurantes',
  'Viajes y transporte',
  'Compras y tiendas',
  'Trabajo y profesiones',
  'Familia y relaciones',
  'Salud y medicina',
  'Educación y estudios',
  'Tiempo y clima',
  'Deportes y ocio',
  'Tecnología',
  'Cultura y entretenimiento',
  'Negocios',
  'Emociones y sentimientos',
  'Direcciones y lugares',
  'Otros',
];

export default function GeneratePhrasesPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    nativeLanguageCode: '',
    learningLanguageCode: '',
    cefrLevel: 'A1',
    category: '',
    quantity: 10,
  });

  useEffect(() => {
    if (!user || !isAdmin) {
      router.push('/login');
      return;
    }

    loadLanguages();
  }, [user, isAdmin, router]);

  const loadLanguages = async () => {
    try {
      const data = await apiGet<Language[]>('/api/languages');
      setLanguages(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await apiPost('/api/phrases/generate', {
        nativeLanguageCode: formData.nativeLanguageCode,
        learningLanguageCode: formData.learningLanguageCode,
        cefrLevel: formData.cefrLevel,
        category: formData.category,
        quantity: formData.quantity,
      });

      setSuccess(
        `✅ ${result.message}\n` +
        `Solicitadas: ${result.requested}\n` +
        `Creadas: ${result.created}\n` +
        `Duplicadas evitadas: ${result.duplicates || 0}`
      );
      
      // Reset form
      setFormData({
        ...formData,
        quantity: 10,
      });
    } catch (err: any) {
      setError(err.message);
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
              <h1 className="text-xl font-bold">Generar Frases con IA</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Volver al Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 whitespace-pre-line">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 whitespace-pre-line">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma Nativo *
                  </label>
                  <select
                    required
                    value={formData.nativeLanguageCode}
                    onChange={(e) =>
                      setFormData({ ...formData, nativeLanguageCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Seleccionar...</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma a Aprender *
                  </label>
                  <select
                    required
                    value={formData.learningLanguageCode}
                    onChange={(e) =>
                      setFormData({ ...formData, learningLanguageCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Seleccionar...</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nivel CEFR (Marco Común Europeo) *
                </label>
                <select
                  required
                  value={formData.cefrLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, cefrLevel: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {CEFR_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría Temática *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Seleccionar categoría...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad de Frases a Generar *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="50"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseInt(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Entre 1 y 50 frases. El sistema verificará automáticamente que no haya duplicados.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Las frases se generarán usando ChatGPT. 
                  El sistema verificará automáticamente que no se repitan frases ya existentes 
                  en la base de datos para esta combinación de idiomas, nivel y categoría.
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
                  {loading ? 'Generando...' : 'Generar Frases'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

