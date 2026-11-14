'use client';

// Opens the browser's print dialog, where "Save as PDF" (desktop) or Share > Save (phones) downloads the report.
export function SaveReportButton({ fileName }: { fileName: string }) {
  function save() {
    const before = document.title;
    document.title = fileName; // browsers use the title as the PDF's file name
    window.print();
    setTimeout(() => (document.title = before), 1000);
  }
  return (
    <button type="button" className="btn btn-ghost sm no-print" onClick={save} style={{ alignSelf: 'flex-start' }}>
      Save as PDF
    </button>
  );
}
