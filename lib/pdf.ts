import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { COLORS } from "@/lib/constants";
import { formatDateLabel } from "@/lib/utils";
import type {
  AttendanceSummary,
  ODEvent,
  OverallAttendanceMetrics,
  Student,
  Subject,
} from "@/types";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const buildAttendanceReportHtml = ({
  student,
  subjects,
  summaries,
  overall,
  odEvents,
  startDate,
  endDate,
}: {
  student: Student;
  subjects: Subject[];
  summaries: AttendanceSummary[];
  overall: OverallAttendanceMetrics;
  odEvents: ODEvent[];
  startDate: string;
  endDate: string;
}): string => {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const odBreakdown = odEvents
    .map((event) => {
      const registeredHours = event.subjects
        .filter((subject) => subject.registered)
        .reduce((sum, subject) => sum + subject.hours, 0);
      const pendingHours = event.subjects
        .filter((subject) => !subject.registered)
        .reduce((sum, subject) => sum + subject.hours, 0);

      return `<tr>
        <td>${escapeHtml(event.name)}</td>
        <td>${escapeHtml(event.type)}</td>
        <td>${formatDateLabel(event.date)}${
          event.endDate ? ` - ${formatDateLabel(event.endDate)}` : ""
        }</td>
        <td>${registeredHours}</td>
        <td>${pendingHours}</td>
      </tr>`;
    })
    .join("");

  const summaryRows = summaries
    .map((summary) => {
      const subject = subjectLookup.get(summary.subjectId);

      return `<tr>
        <td>${escapeHtml(subject?.name ?? "Subject")}</td>
        <td>${summary.TH}</td>
        <td>${summary.AH}</td>
        <td>${summary.DL}</td>
        <td>${summary.pendingOD}</td>
        <td>${summary.AH_DL}</td>
        <td>${summary.percentBefore.toFixed(2)}%</td>
        <td>${summary.percentAfterDL.toFixed(2)}%</td>
        <td>${summary.percentProjected.toFixed(2)}%</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>AttendX Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: ${COLORS.background}; }
          .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
          .title { color: ${COLORS.primary}; font-size: 28px; font-weight: 700; }
          .meta { color: #475569; line-height: 1.6; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .card { padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background: #eff6ff; color: ${COLORS.primary}; }
          h2 { margin-top: 28px; color: ${COLORS.primary}; }
          footer { margin-top: 28px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">AttendX Report</div>
            <div class="meta">
              ${escapeHtml(student.collegeName)}<br />
              ${escapeHtml(student.name)} | ${escapeHtml(student.rollNo)}<br />
              ${escapeHtml(student.batch)} | ${escapeHtml(student.department)} | ${escapeHtml(student.term)}
            </div>
          </div>
          <div class="meta">
            Range: ${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}<br />
            Generated: ${formatDateLabel(new Date())}
          </div>
        </div>

        <div class="grid">
          <div class="card"><strong>TH</strong><div>${overall.TH}</div></div>
          <div class="card"><strong>AH</strong><div>${overall.AH}</div></div>
          <div class="card"><strong>DL</strong><div>${overall.DL}</div></div>
          <div class="card"><strong>Overall %</strong><div>${overall.percentProjected.toFixed(2)}%</div></div>
        </div>

        <h2>Subject Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>TH</th>
              <th>AH</th>
              <th>DL</th>
              <th>Pending</th>
              <th>AH+DL</th>
              <th>%Before</th>
              <th>%AfterDL</th>
              <th>%Projected</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>

        <h2>OD Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Date</th>
              <th>Registered</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>${odBreakdown}</tbody>
        </table>

        <footer>Generated by AttendX</footer>
      </body>
    </html>`;
};

export const generateAttendancePdf = async ({
  student,
  subjects,
  summaries,
  overall,
  odEvents,
  startDate,
  endDate,
}: {
  student: Student;
  subjects: Subject[];
  summaries: AttendanceSummary[];
  overall: OverallAttendanceMetrics;
  odEvents: ODEvent[];
  startDate: string;
  endDate: string;
}): Promise<string> => {
  const html = buildAttendanceReportHtml({
    student,
    subjects,
    summaries,
    overall,
    odEvents,
    startDate,
    endDate,
  });
  const file = await Print.printToFileAsync({ html });
  return file.uri;
};

export const shareAttendancePdf = async (uri: string): Promise<void> => {
  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    return;
  }

  await Sharing.shareAsync(uri);
};
