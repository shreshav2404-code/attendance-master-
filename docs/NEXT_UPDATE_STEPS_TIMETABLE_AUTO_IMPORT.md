# AttendX Next Update Plan: Automatic Timetable Detection (Image/PDF)

## Goal
Enable users to import a timetable from an image or PDF, auto-extract subjects and slots, and prefill the timetable builder with a review-first flow.

## Scope
- Input formats:
  - Camera/gallery image (JPG/PNG)
  - PDF timetable file
- Output:
  - `HourSlot[]`
  - `Subject[]` (new and matched)
  - `TimetableSlot[]` with `isDouble` and `isLab`
- UX rule:
  - Never auto-save directly to production data.
  - Always show preview and require user confirmation.

## Recommended Architecture
1. App-side import + preview (Expo)
2. Backend OCR/table parser service
3. Mapping + confidence scoring
4. User correction layer
5. Confirm and persist in MMKV/AsyncStorage

## Why Backend Parsing (Recommended)
- Timetable formats differ heavily across colleges.
- Merged cells and multi-line text are unreliable with pure on-device OCR.
- Backend gives higher accuracy and easier model upgrades without app release.

## Phase Plan

### Phase 1 - Data Contract and Parser Interfaces
Create strict types for parser response and review state.

Deliverables:
- `types/index.ts` additions:
  - `ParsedTimetableCell`
  - `ParsedTimetableResponse`
  - `ImportConfidenceSummary`
  - `ImportIssue`
- `lib/timetableImport.ts` interface layer:
  - `normalizeParsedOutput()`
  - `mapParsedSubjectsToExisting()`
  - `buildDraftTimetableSlots()`
  - `buildDraftHourSlots()`

Acceptance:
- Zero TypeScript errors in strict mode.
- Parser response can be validated with Zod before use.

### Phase 2 - Import UI Flow in Onboarding + Settings
Add an "Import from Image/PDF" path in:
- Onboarding timetable step
- Settings timetable editor

Deliverables:
- New sheet/modal flow:
  - Pick source: Camera / Gallery / PDF
  - Upload progress
  - Parsing status
  - Draft preview
- Add route/screen:
  - `app/onboarding/import-preview.tsx` (or modal segment)
- Add shared components:
  - `components/shared/ConfidenceBadge.tsx`
  - `components/shared/ImportIssueList.tsx`

Acceptance:
- User can enter import flow from both onboarding and settings.
- Back button and cancel states are handled.

### Phase 3 - Backend OCR + Table Extraction Service
Implement a parser service (Node recommended) with one of:
- Google Document AI (best table handling)
- AWS Textract
- Azure Form Recognizer

Deliverables:
- Endpoint `POST /api/timetable/parse`
- Input: multipart file + optional hints (`department`, `term`, `hoursPerDay`)
- Output: normalized JSON response with confidence per cell

Response shape (target):
```json
{
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "hourSlots": [
    { "hour": 1, "startTime": "08:50", "endTime": "09:45", "isBreak": false, "isLunch": false }
  ],
  "cells": [
    {
      "day": "Mon",
      "hour": 1,
      "rawText": "CAI2500 ML",
      "subjectCode": "CAI2500",
      "subjectName": "Machine Learning",
      "isLab": false,
      "isDouble": false,
      "confidence": 0.93
    }
  ],
  "issues": [
    { "type": "LOW_CONFIDENCE", "message": "Wed H4 unclear", "severity": "warning" }
  ]
}
```

Acceptance:
- Returns parse result for sample college timetable images and PDFs.
- Mean parse latency < 6s for common files.

### Phase 4 - Smart Mapping and Validation
Implement mapping heuristics:
- Match by subject code first (exact and case-insensitive)
- Fallback by normalized subject name
- Create new subject drafts if no match

Rules:
- If lab or double detected, create one 2-hour logical slot.
- Detect merged cells and avoid duplicate 1-hour splits.
- Mark uncertain cells as unresolved.

Acceptance:
- All unresolved/low-confidence cells are visually highlighted.
- User can tap any cell and fix subject/hour quickly.

### Phase 5 - Review and Correction UX
Provide a full review screen before save:
- Weekly grid with imported values
- Unresolved items panel
- Inline cell edit
- "Clear cell" action for wrong assignment

Deliverables:
- Cell actions:
  - change subject
  - mark free
  - mark break/lunch
  - toggle double/lab
- Final summary:
  - subjects matched
  - new subjects to create
  - unresolved items count

Acceptance:
- User can fully correct a bad parse without leaving the screen.
- Confirm saves only valid timetable state.

### Phase 6 - Persistence and Backward Safety
When user confirms:
- Write updates via existing storage abstractions
- Preserve previous timetable snapshot for rollback

Deliverables:
- `lib/storage.ts` additions:
  - `saveTimetableSnapshot()`
  - `restoreTimetableSnapshot()`
- One-tap rollback if import result is wrong

Acceptance:
- User can revert to pre-import timetable.
- No data loss during failed save.

### Phase 7 - Testing and Release Hardening
Test layers:
- Unit tests:
  - parsing normalization
  - mapping logic
  - lab/double consolidation
- Integration tests:
  - import -> preview -> edit -> confirm
- Manual QA:
  - low-quality photo
  - rotated image
  - timetable with Saturday optional
  - timetable with merged cells

Deliverables:
- `__tests__/timetableImport.test.ts`
- Updated regression checklist in release notes

Acceptance:
- No console errors.
- Import flow does not block existing manual timetable flow.

## API and Security Notes
- Do not store raw timetable files longer than needed.
- Delete uploaded file after parsing.
- Rate-limit parse endpoint.
- Add request ID logging for debugging parse failures.

## Rollout Strategy
1. Internal beta only (feature flag `timetableImportV1`)
2. Collect parse success and correction rate
3. Improve heuristics on real college samples
4. Roll out to all users once correction rate is low

## Metrics to Track
- Parse success rate
- Average confidence per import
- Manual edits per imported timetable
- Time to complete timetable setup
- Import abandonment rate

## Next Sprint Task Breakdown (Execution Ready)
1. Add new parser/import types and Zod schemas.
2. Add import button and skeleton flow in onboarding + settings.
3. Implement backend parse endpoint and return normalized JSON.
4. Build preview grid with confidence highlights and inline edit.
5. Add confirm + rollback persistence.
6. Write tests and run full regression.

