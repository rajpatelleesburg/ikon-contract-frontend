
"use client";

export default function DeleteModal({ target, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-lg">
        <h2 className="text-lg font-bold text-red-700">
          Move file to Trash?
        </h2>
        <p className="text-sm text-slate-700">
          File:{" "}
          <span className="font-mono">{target.file.filename}</span>
          <br />
          Agent:{" "}
          <span className="font-semibold">{target.agentName}</span>
        </p>
        <p className="text-xs text-slate-500">
          The file will be moved to{" "}
          <code>trash/agentName/filename</code> and automatically
          deleted after 15 days.
        </p>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}
