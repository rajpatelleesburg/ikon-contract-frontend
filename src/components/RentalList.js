"use client";

export default function RentalList({ rentals, displayCount }) {
  return (
    <>
      {rentals.slice(0, displayCount).map((f) => (
        <div
          key={f.contractId}
          className="flex justify-between items-center bg-slate-50 p-3 rounded border"
        >
          <div>
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              {f.fileName}
            </a>
            <div className="text-xs text-slate-500">
              {f.lastModified
                ? new Date(f.lastModified).toLocaleDateString()
                : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
