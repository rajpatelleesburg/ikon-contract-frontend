"use client";

export default function HeaderTile({ signOut }) {
  return (
    <div className="relative flex items-center mb-2">
      {/* Logo (unchanged) */}
      <div className="flex items-center gap-2">
        <img
          src="/IkonLogo.png"
          alt="IKON Realty Logo"
          className="h-14 w-auto object-contain"
        />
      </div>

      {/* Centered Admin text — hidden on mobile, visible from sm+ */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center hidden sm:block">
        <h1 className="text-2xl font-bold text-slate-800 tracking-wide">
          Admin
        </h1>
      </div>

      {/* Sign Out (unchanged) */}
      <div className="ml-auto">
        <button
          onClick={signOut}
          className="bg-slate-800 text-white px-5 py-2 rounded-lg hover:bg-slate-900 shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}