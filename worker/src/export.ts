import ExcelJS from "exceljs";
import { PDFDocument, rgb } from "pdf-lib";
import type { CollectedPost, ReportPayload } from "./types";

export async function buildExport(
  format: "xlsx" | "csv" | "pdf" | "txt",
  report: ReportPayload,
): Promise<{ bytes: Uint8Array; filename: string; mime: string }> {
  const mimes = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv; charset=utf-8",
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
  } as const;
  if (format === "xlsx") return { ...(await exportXlsx(report)), mime: mimes.xlsx };
  if (format === "csv") return { ...(await exportCsv(report)), mime: mimes.csv };
  if (format === "pdf") return { ...(await exportPdf(report)), mime: mimes.pdf };
  return { ...exportTxt(report), mime: mimes.txt };
}

async function exportXlsx(report: ReportPayload) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Posts");
  ws.addRow(["published_at", "format", "caption", "views", "likes"]);
  for (const p of report.posts) {
    ws.addRow([p.publishedAt, p.formatType, p.caption.slice(0, 500), p.views, p.likes]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return { bytes: new Uint8Array(buf), filename: "pagezy-report.xlsx" };
}

function exportCsv(report: ReportPayload) {
  const lines = ["published_at,format,views,likes,caption"];
  for (const p of report.posts) {
    const cap = JSON.stringify(p.caption.slice(0, 300));
    lines.push(`${p.publishedAt},${p.formatType},${p.views ?? ""},${p.likes ?? ""},${cap}`);
  }
  const enc = new TextEncoder().encode("\uFEFF" + lines.join("\n"));
  return { bytes: enc, filename: "pagezy-report.csv" };
}

function exportTxt(report: ReportPayload) {
  const body = report.summaryText + "\n\n---\n" + report.posts.map((p) => `- ${p.publishedAt} ${p.formatType}`).join("\n");
  return { bytes: new TextEncoder().encode(body), filename: "pagezy-report.txt" };
}

async function exportPdf(report: ReportPayload) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  // Note: full Persian RTL needs embedded Vazirmatn via font bytes in R2; MVP uses UTF-8 lines (limited shaping)
  const lines = report.summaryText.split("\n").slice(0, 40);
  let y = 800;
  for (const line of lines) {
    page.drawText(line.slice(0, 90), { x: 40, y, size: 10, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }
  const bytes = await doc.save();
  return { bytes, filename: "pagezy-report.pdf" };
}