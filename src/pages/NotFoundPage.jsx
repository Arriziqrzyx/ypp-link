import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center glass-card p-10 rounded-3xl">
        <div className="mb-8">
          <img
            className="mx-auto h-20 w-auto"
            src="/logo.png"
            alt="YPP Logo"
            onError={(e) => {
              e.target.style.display = 'none'; // Sembunyikan jika gagal muat logo
            }}
          />
        </div>
        
        <h1 className="text-9xl font-black text-sky-500 tracking-tighter">404</h1>
        
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Waduh, Nyasar Ya?</h2>
          <p className="text-slate-500 text-lg">
            Tautan pendek yang kamu tuju sepertinya tidak ada, salah ketik, atau sudah dihapus.
          </p>
        </div>

        <div className="pt-8">
          <Link
            to="/"
            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-semibold rounded-xl text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all duration-200 shadow-lg shadow-sky-500/30"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <Home className="h-5 w-5 text-sky-400 group-hover:text-sky-300 transition-colors" />
            </span>
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
