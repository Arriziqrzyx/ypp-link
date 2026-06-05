import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

export default async function handler(req, res) {
  // Hanya proses method GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil slug dari query (Vercel rewrite biasanya memasukkan path ke query, atau bisa dari req.url)
  // v.vercel.json akan meroute /:slug ke /api/redirect?slug=:slug
  const slug = req.query.slug;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  // Hindari memproses rute internal SPA
  const reservedPaths = ['login', 'register', 'dashboard', 'api'];
  if (reservedPaths.includes(slug.toLowerCase())) {
    return res.redirect(302, '/404');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  // Gunakan Service Role Key agar fungsi serverless bisa membaca slug (bypass RLS)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Service Role Key');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    realtime: {
      transport: WebSocket,
    }
  });

  try {
    // 1. Cari target URL
    const { data: link, error } = await supabase
      .from('links')
      .select('id, target_url, click_count')
      .eq('slug', slug)
      .single();

    if (error || !link) {
      return res.redirect(302, '/404');
    }

    // 2. Tambah click count
    // Edge function / API route should increment the count. 
    // This runs asynchronously so we don't delay the redirect.
    supabase.rpc('increment_click_count', { row_id: link.id }).then(({ error: rpcError }) => {
        if(rpcError) {
             // Fallback if RPC isn't created: normal update (might have race conditions but okay for MVP)
             supabase.from('links').update({ click_count: link.click_count + 1 }).eq('id', link.id).then();
        }
    });

    // 3. Lakukan redirect (302 Found, supaya analytics tetap berjalan tiap kali diakses)
    return res.redirect(302, link.target_url);
    
  } catch (err) {
    console.error('Redirect error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
