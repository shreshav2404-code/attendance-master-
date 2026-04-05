import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";

import type {
  AttendanceSummary,
  OverallAttendanceMetrics,
  Student,
  Subject,
} from "@/types";

export const buildShareSummary = ({
  student,
  overall,
  summaries,
  subjects,
  date,
}: {
  student: Student;
  overall: OverallAttendanceMetrics;
  summaries: AttendanceSummary[];
  subjects: Subject[];
  date: string;
}): string => {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const subjectStatusText = summaries
    .map((summary) => {
      const subject = subjectLookup.get(summary.subjectId);
      const subjectName = subject?.shortName ?? subject?.name ?? "Subject";

      if (summary.status === "excellent" || summary.status === "safe") {
        return `✅ ${subjectName}: ${summary.percentProjected.toFixed(2)}% — Safe`;
      }

      if (summary.status === "warning" || summary.status === "exact") {
        return `⚠️ ${subjectName}: ${summary.percentProjected.toFixed(
          2,
        )}% — Need ${summary.hoursNeeded} more classes`;
      }

      return `🔴 ${subjectName}: ${summary.percentProjected.toFixed(2)}% — Critical`;
    })
    .join("\n");

  return `📊 AttendX Report — ${date}
👤 ${student.name} | ${student.rollNo} | ${student.term}

Overall: ${overall.percentBefore.toFixed(2)}% → ${overall.percentAfterDL.toFixed(
    2,
  )}% → ${overall.percentProjected.toFixed(2)}%
(Physical | +OD | Projected)

Subject Status:
${subjectStatusText}

Total: ${overall.TH} hrs | Present: ${overall.AH} | OD: ${overall.DL}`;
};

export const shareAttendanceSummary = async (summaryText: string): Promise<void> => {
  await Clipboard.setStringAsync(summaryText);
  await Share.share({
    message: summaryText,
  });
};
