import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, Copy, Edit2, Trash2, Link as LinkIcon, BarChart3, Search } from 'lucide-react';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [toast, setToast] = useState(null);
  const PAGE_SIZE = 10;

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Form states
  const [targetUrl, setTargetUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editTargetUrl, setEditTargetUrl] = useState('');
  const [editAlias, setEditAlias] = useState('');

  useEffect(() => {
    if (user) {
      fetchLinks();
    }
  }, [user, page]);

  const fetchLinks = async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch total stats for this user
    const { count } = await supabase
      .from('links')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user.id);
    
    setTotalCount(count || 0);

    // Fetch paginated links
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('links')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);
      
    // Apply search if exists (client side search will be limited to current page, 
    // but for MVP we'll just filter the fetched page data below, or we can use ilike)
    if (searchTerm) {
      query = query.or(`slug.ilike.%${searchTerm}%,target_url.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      setLinks(data);
    }
    setLoading(false);
  };

  const generateRandomSlug = () => {
    return Math.random().toString(36).substring(2, 8);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    let finalSlug = alias.trim() || generateRandomSlug();
    
    // Check if slug exists
    const { data: existing } = await supabase
      .from('links')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existing) {
      setFormError('Alias sudah digunakan. Silakan pilih alias lain.');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.from('links').insert([
      {
        target_url: targetUrl,
        slug: finalSlug,
        created_by: user.id
      }
    ]).select();

    if (error) {
      setFormError(error.message);
    } else {
      setTargetUrl('');
      setAlias('');
      fetchLinks();
      showToast('Tautan berhasil disulap! ✨');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus link ini?')) return;
    
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setLinks(links.filter(l => l.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
      showToast('Tautan berhasil dihapus! 🗑️');
    }
  };

  const startEdit = (link) => {
    setEditingId(link.id);
    setEditTargetUrl(link.target_url);
    setEditAlias(link.slug);
  };

  const handleUpdate = async (id) => {
    // Check if new alias is taken by another link
    const { data: existing } = await supabase
      .from('links')
      .select('id')
      .eq('slug', editAlias)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      setFormError('Alias sudah digunakan oleh link lain.');
      return;
    }

    const { error } = await supabase
      .from('links')
      .update({ target_url: editTargetUrl, slug: editAlias })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchLinks();
      showToast('Tautan berhasil diperbarui! ✏️');
    }
  };

  const copyToClipboard = (slug) => {
    const url = `https://url.yuritechpp.co.id/${slug}`;
    navigator.clipboard.writeText(url);
    showToast('Tautan disalin ke clipboard! 📋');
  };

  // Note: For accurate total clicks across all pages, we should use a separate aggregation query or RPC.
  // For MVP, we'll display the count of links, and total clicks from the currently viewed page.
  const totalLinks = totalCount;
  const totalClicksPage = links.reduce((sum, link) => sum + (link.click_count || 0), 0);

  const filteredLinks = links.filter(l => 
    l.slug.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.target_url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img src="/logo.png" alt="YPP Logo" className="h-8 w-auto mr-3" onError={(e) => e.target.style.display='none'} />
              <span className="text-2xl font-black text-sky-500 tracking-tight">YPP LINK</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={signOut}
                className="inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all shadow-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Background blobs for dashboard */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0 pointer-events-none"></div>

        <div className="relative z-10">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-8">
          <div className="glass-card overflow-hidden rounded-2xl border border-white/60 hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-sky-100 p-3 rounded-xl text-sky-500">
                  <LinkIcon className="h-7 w-7" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Koleksi Tautan</dt>
                    <dd className="text-3xl font-black text-slate-800">{totalLinks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-card overflow-hidden rounded-2xl border border-white/60 hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 p-3 rounded-xl text-red-500">
                  <BarChart3 className="h-7 w-7" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Jejak Klik (Halaman Ini)</dt>
                    <dd className="text-3xl font-black text-slate-800">{totalClicksPage}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Form */}
        <div className="glass-card rounded-3xl mb-10 border border-white/60 shadow-xl shadow-sky-900/5">
          <div className="px-6 py-8 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
              <span className="bg-sky-500 text-white p-2 rounded-lg mr-3 shadow-md shadow-sky-500/20">
                <Plus className="h-5 w-5" />
              </span>
              Bikin Tautan Baru
            </h3>
            {formError && (
              <div className="mb-6 bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 p-4 rounded-r-md text-sm text-red-700 font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-5 lg:flex lg:space-x-5 lg:space-y-0 items-end">
              <div className="flex-1">
                <label htmlFor="targetUrl" className="block text-sm font-semibold text-slate-700 mb-1">Tautan Panjangmu</label>
                <input
                  type="url"
                  id="targetUrl"
                  required
                  placeholder="https://example.com/dokumen-sangat-penting-sekali..."
                  className="block w-full border border-slate-200 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent sm:text-sm bg-white/60 focus:bg-white transition-colors"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
              <div className="lg:w-80">
                <label htmlFor="alias" className="block text-sm font-semibold text-slate-700 mb-1">Tautan Pendekmu (Opsional)</label>
                <div className="flex rounded-xl shadow-sm overflow-hidden border border-slate-200 bg-white/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent transition-all">
                  <span className="inline-flex items-center px-4 bg-slate-50 text-slate-500 sm:text-sm font-medium border-r border-slate-200">
                    url.yuritechpp.co.id/
                  </span>
                  <input
                    type="text"
                    id="alias"
                    placeholder="nama-keren"
                    className="flex-1 block w-full py-3 px-4 focus:outline-none sm:text-sm bg-transparent"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full lg:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl shadow-lg shadow-sky-500/30 text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Menyulap...' : 'Sulap Tautan!'}
              </button>
            </form>
          </div>
        </div>

        {/* Links Table */}
        <div className="glass-card rounded-3xl border border-white/60 overflow-hidden shadow-xl shadow-slate-200/50">
          <div className="px-6 py-6 sm:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 bg-white/40">
            <h3 className="text-xl font-bold text-slate-800 mb-4 sm:mb-0">Daftar Tautanmu</h3>
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white/60 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent sm:text-sm transition-colors"
                placeholder="Cari tautan..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchLinks();
                }}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tautan Pendek</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tujuan</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Klik</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dibuat</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white/40 divide-y divide-slate-100 backdrop-blur-sm">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Memuat data...</td>
                  </tr>
                ) : filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Tidak ada link ditemukan.</td>
                  </tr>
                ) : (
                  filteredLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-900">
                        {editingId === link.id ? (
                          <input 
                            className="border border-sky-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                            value={editAlias}
                            onChange={(e) => setEditAlias(e.target.value)}
                          />
                        ) : (
                          <div className="flex items-center space-x-2 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg border border-sky-100 inline-flex">
                            <a href={`https://url.yuritechpp.co.id/${link.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold">
                              yuritechpp.co.id/{link.slug}
                            </a>
                            <button onClick={() => copyToClipboard(link.slug)} className="text-sky-500 hover:text-sky-700 transition-colors" title="Salin URL">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500 max-w-xs truncate">
                        {editingId === link.id ? (
                          <input 
                            className="border border-sky-300 rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-sky-500 focus:outline-none"
                            value={editTargetUrl}
                            onChange={(e) => setEditTargetUrl(e.target.value)}
                          />
                        ) : (
                          <a href={link.target_url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-600 hover:underline">
                            {link.target_url}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-500">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {link.click_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {new Date(link.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === link.id ? (
                          <div className="flex justify-end space-x-3">
                            <button onClick={() => handleUpdate(link.id)} className="text-green-600 hover:text-green-700 bg-green-50 px-3 py-1 rounded-md">Simpan</button>
                            <button onClick={() => setEditingId(null)} className="text-slate-600 hover:text-slate-800 bg-slate-100 px-3 py-1 rounded-md">Batal</button>
                          </div>
                        ) : (
                          <div className="flex justify-end space-x-3">
                            <button onClick={() => startEdit(link)} className="text-sky-500 hover:text-sky-700 p-1.5 hover:bg-sky-50 rounded-lg transition-colors" title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(link.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalCount > PAGE_SIZE && (
            <div className="bg-slate-50/80 px-6 py-4 flex items-center justify-between border-t border-slate-100">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Mundur
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Maju
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    Nampilin <span className="font-bold text-slate-800">{page * PAGE_SIZE + 1}</span> sampai <span className="font-bold text-slate-800">{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> dari <span className="font-bold text-slate-800">{totalCount}</span> tautan
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px overflow-hidden" aria-label="Pagination">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="relative inline-flex items-center px-3 py-2 border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <span>Mundur</span>
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= totalCount}
                      className="relative inline-flex items-center px-3 py-2 border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <span>Maju</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 z-50 animate-bounce">
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        )}
      </main>
    </div>
  );
}
