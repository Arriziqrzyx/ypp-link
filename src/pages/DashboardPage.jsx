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
  const PAGE_SIZE = 10;

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
      alert('Alias sudah digunakan oleh link lain.');
      return;
    }

    const { error } = await supabase
      .from('links')
      .update({ target_url: editTargetUrl, slug: editAlias })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchLinks();
    }
  };

  const copyToClipboard = (slug) => {
    const url = `https://url.yuritechpp.co.id/${slug}`;
    navigator.clipboard.writeText(url);
    alert('Link disalin: ' + url);
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
              <LinkIcon className="h-6 w-6 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">Yuritech URL</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={signOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <LinkIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Link Aktif</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{totalLinks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Klik (Halaman Ini)</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{totalClicksPage}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Form */}
        <div className="bg-white shadow rounded-lg mb-8 border border-gray-100">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Buat Link Baru</h3>
            {formError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 sm:flex sm:space-x-4 sm:space-y-0 items-end">
              <div className="flex-1">
                <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700">Target URL</label>
                <input
                  type="url"
                  id="targetUrl"
                  required
                  placeholder="https://example.com/very-long-url..."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
              <div className="sm:w-64">
                <label htmlFor="alias" className="block text-sm font-medium text-gray-700">Alias (Opsional)</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    url.yuritechpp.co.id/
                  </span>
                  <input
                    type="text"
                    id="alias"
                    placeholder="custom-alias"
                    className="flex-1 block w-full border border-gray-300 rounded-none rounded-r-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Menyimpan...' : 'Buat Link'}
              </button>
            </form>
          </div>
        </div>

        {/* Links Table */}
        <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Daftar Link</h3>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                placeholder="Cari di halaman ini..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0); // Reset page on search
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchLinks();
                }}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alias</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target URL</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klik</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
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
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {editingId === link.id ? (
                          <input 
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                            value={editAlias}
                            onChange={(e) => setEditAlias(e.target.value)}
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <a href={`https://url.yuritechpp.co.id/${link.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              url.yuritechpp.co.id/{link.slug}
                            </a>
                            <button onClick={() => copyToClipboard(link.slug)} className="text-gray-400 hover:text-blue-600" title="Salin URL">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {editingId === link.id ? (
                          <input 
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                            value={editTargetUrl}
                            onChange={(e) => setEditTargetUrl(e.target.value)}
                          />
                        ) : (
                          <a href={link.target_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                            {link.target_url}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {link.click_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(link.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === link.id ? (
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => handleUpdate(link.id)} className="text-green-600 hover:text-green-900">Simpan</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-600 hover:text-gray-900">Batal</button>
                          </div>
                        ) : (
                          <div className="flex justify-end space-x-3">
                            <button onClick={() => startEdit(link)} className="text-blue-600 hover:text-blue-900" title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(link.id)} className="text-red-600 hover:text-red-900" title="Hapus">
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
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Menampilkan <span className="font-medium">{page * PAGE_SIZE + 1}</span> hingga <span className="font-medium">{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> dari <span className="font-medium">{totalCount}</span> hasil
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span>Sebelumnya</span>
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= totalCount}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span>Selanjutnya</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
