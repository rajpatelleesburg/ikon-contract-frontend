export default function Button({ children, className = "", disabled, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`rounded-xl px-4 py-2 font-medium transition shadow-sm ${
        disabled ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
