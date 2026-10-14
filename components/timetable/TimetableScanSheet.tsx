import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Camera, FileText, ImageIcon, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { triggerTapHaptic } from "@/lib/haptics";
import {
  buildTimetableScanPlan,
  getScanCellKey,
  parseTimetableScan,
  type ScanBatchSelection,
  type ScanChoice,
  type ScanOcrResult,
  type TimetableScanResult,
} from "@/lib/timetableScan";
import {
  countPdfPages,
  findSectionPage,
  isPdfImportAvailable,
  isTimetableScanAvailable,
  readPdfPage,
  recognizeImage,
} from "@/lib/timetableScanSource";
import type {
  HourSlot,
  Subject,
  TimetableImportPlan,
  TimetableSlot,
  WorkingDay,
} from "@/types";

const LAST_SECTION_KEY = "attendx.timetable_scan_section";

interface TimetableScanSheetProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  timetable: TimetableSlot[];
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
  onApply: (plan: TimetableImportPlan) => Promise<void>;
}

type Step = "source" | "section" | "working" | "review";

const batchLabel = (family: string, option: number) =>
  family === "B" ? `B${option}` : `${family}${option}`;

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    className="mr-2 rounded-full border px-3 py-1.5"
    style={{
      borderColor: selected ? "#60a5fa" : "rgba(255,255,255,0.12)",
      backgroundColor: selected ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.04)",
    }}
  >
    <Text
      className="font-inter-medium text-xs"
      style={{ color: selected ? "#dbeafe" : "rgba(248,250,252,0.75)" }}
    >
      {label}
    </Text>
  </Pressable>
);

/**
 * Builds the timetable from a college timetable PDF or a photo/screenshot,
 * read on the phone (ML Kit OCR, offline), then lets the student check it.
 */
export const TimetableScanSheet = ({
  visible,
  onClose,
  subjects,
  timetable,
  hourSlots,
  workingDays,
  onApply,
}: TimetableScanSheetProps) => {
  const [step, setStep] = useState<Step>("source");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<{ uri: string; pageCount: number } | null>(null);
  const [section, setSection] = useState("");
  const [pageNumber, setPageNumber] = useState("1");
  const [ocr, setOcr] = useState<ScanOcrResult | null>(null);
  const [batches, setBatches] = useState<ScanBatchSelection>({});
  const [unknownChoices, setUnknownChoices] = useState<Record<string, ScanChoice>>({});
  const [cellChoices, setCellChoices] = useState<Record<string, ScanChoice>>({});
  const [useScannedTimings, setUseScannedTimings] = useState(true);
  const [selectedDay, setSelectedDay] = useState<WorkingDay>("Mon");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_SECTION_KEY)
      .then((saved) => setSection(saved ?? ""))
      .catch(() => undefined);
  }, []);

  const reset = () => {
    cancelled.current = true;
    setStep("source");
    setProgress("");
    setError("");
    setPdf(null);
    setOcr(null);
    setBatches({});
    setUnknownChoices({});
    setCellChoices({});
    setUseScannedTimings(true);
    setEditingKey(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const parsed = useMemo((): { result?: TimetableScanResult; error?: string } => {
    if (!ocr) {
      return {};
    }
    try {
      return { result: parseTimetableScan({ ocr, subjects, hourSlots, batches }) };
    } catch (parseError) {
      return {
        error: parseError instanceof Error ? parseError.message : "Couldn't read a timetable.",
      };
    }
  }, [batches, hourSlots, ocr, subjects]);
  const result = parsed.result;

  const plan = useMemo(
    () =>
      result
        ? buildTimetableScanPlan({
            result,
            subjects,
            timetable,
            hourSlots,
            workingDays,
            unknownChoices,
            cellChoices,
            useScannedTimings,
          })
        : null,
    [cellChoices, hourSlots, result, subjects, timetable, unknownChoices, useScannedTimings, workingDays],
  );

  const showResult = (nextOcr: ScanOcrResult) => {
    setOcr(nextOcr);
    setUnknownChoices({});
    setCellChoices({});
    setEditingKey(null);
    setStep("review");
  };

  // Split cells (B1/B2, Bat1-Bat4): start with each group's first batch picked.
  useEffect(() => {
    if (!result) {
      return;
    }
    const missing = result.batchGroups.filter((group) => batches[group.family] === undefined);
    if (missing.length > 0) {
      setBatches((current) => ({
        ...current,
        ...Object.fromEntries(missing.map((group) => [group.family, group.options[0] ?? 1])),
      }));
    }
    if (!result.days.includes(selectedDay) && result.days[0]) {
      setSelectedDay(result.days[0]);
    }
  }, [batches, result, selectedDay]);

  const runSafely = async (task: () => Promise<void>, fallbackStep: Step) => {
    setError("");
    try {
      await task();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Something went wrong.");
      setStep(fallbackStep);
    }
  };

  const readImage = async (source: "camera" | "library") => {
    void triggerTapHaptic();
    await runSafely(async () => {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error("Allow camera access to take a photo of the timetable.");
        }
      }
      // No crop step: the cropper's default box trims the edges, which cut off
      // the day names; text around the table is ignored anyway.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
      const picked =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) {
        return;
      }
      setStep("working");
      setProgress("Reading the timetable…");
      showResult(await recognizeImage(asset.uri));
    }, "source");
  };

  const readPage = async (uri: string, pageIndex: number) => {
    setStep("working");
    setProgress(`Reading page ${pageIndex + 1}…`);
    showResult(await readPdfPage(uri, pageIndex));
  };

  const pickPdf = async () => {
    void triggerTapHaptic();
    await runSafely(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) {
        return;
      }
      setStep("working");
      setProgress("Opening the PDF…");
      const pageCount = await countPdfPages(asset.uri);
      setPdf({ uri: asset.uri, pageCount });
      if (pageCount === 1) {
        await readPage(asset.uri, 0);
        return;
      }
      setStep("section");
    }, "source");
  };

  const findSection = async () => {
    if (!pdf || !section.trim()) {
      return;
    }
    void triggerTapHaptic();
    cancelled.current = false;
    const wanted = section.trim();
    void AsyncStorage.setItem(LAST_SECTION_KEY, wanted).catch(() => undefined);
    await runSafely(async () => {
      setStep("working");
      const pageIndex = await findSectionPage({
        uri: pdf.uri,
        section: wanted,
        pageCount: pdf.pageCount,
        onProgress: (page) =>
          setProgress(`Looking for ${wanted.toUpperCase()} · page ${page} of ${pdf.pageCount}`),
        isCancelled: () => cancelled.current,
      });
      if (cancelled.current) {
        return;
      }
      if (pageIndex < 0) {
        throw new Error(
          `Couldn't find ${wanted.toUpperCase()} in this PDF. Check the code at the top of your page, or enter its page number.`,
        );
      }
      setPageNumber(String(pageIndex + 1));
      await readPage(pdf.uri, pageIndex);
    }, "section");
  };

  const readPageNumber = async () => {
    const pageIndex = Number(pageNumber) - 1;
    if (!pdf || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pdf.pageCount) {
      setError(`Enter a page from 1 to ${pdf?.pageCount ?? 1}.`);
      return;
    }
    void triggerTapHaptic();
    cancelled.current = false;
    await runSafely(() => readPage(pdf.uri, pageIndex), "section");
  };

  const apply = async () => {
    if (!plan) {
      return;
    }
    void triggerTapHaptic();
    setApplying(true);
    try {
      await onApply(plan);
      close();
    } finally {
      setApplying(false);
    }
  };

  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>();
    [...subjects, ...(plan?.createdSubjects ?? [])].forEach((subject) =>
      map.set(subject.id, subject),
    );
    return map;
  }, [plan?.createdSubjects, subjects]);

  const effectiveHours = plan?.hourSlots ?? hourSlots;
  const daySlots = (plan?.timetable ?? []).filter((slot) => slot.day === selectedDay);
  const classCount = (plan?.timetable ?? []).filter((slot) =>
    result?.days.includes(slot.day),
  ).length;

  const renderReview = () => {
    if (!result || !plan) {
      return (
        <View className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <Text className="font-inter text-sm leading-6 text-red-200">
            {parsed.error ?? "Couldn't read a timetable."}
          </Text>
          <Button mode="outlined" style={{ marginTop: 12 }} onPress={reset}>
            Try again
          </Button>
        </View>
      );
    }

    const timedRange = result.scannedHourSlots
      ? `${result.scannedHourSlots.length} periods · ${result.scannedHourSlots[0]?.startTime}–${
          result.scannedHourSlots[result.scannedHourSlots.length - 1]?.endTime
        }`
      : "";

    return (
      <>
        <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
          Found {result.days.join(", ")} · {classCount} classes. Tap any period to fix it.
        </Text>
        {result.warnings.map((warning) => (
          <Text key={warning} className="mt-2 font-inter text-xs text-amber-200">
            {warning}
          </Text>
        ))}

        {result.batchGroups.map((group) => (
          <View key={group.family} className="mt-5">
            <Text className="font-inter-semibold text-sm text-white">
              {group.family === "B" ? "Your batch" : "Your lab batch"}
            </Text>
            <Text className="mt-1 font-inter text-xs text-white/50">
              Some periods are split by batch; only yours go in the timetable.
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-y-2">
              {group.options.map((option) => (
                <Chip
                  key={option}
                  label={batchLabel(group.family, option)}
                  selected={batches[group.family] === option}
                  onPress={() => setBatches((current) => ({ ...current, [group.family]: option }))}
                />
              ))}
            </View>
          </View>
        ))}

        {result.scannedHourSlots ? (
          <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
            <View className="mr-3 flex-1">
              <Text className="font-inter-semibold text-sm text-white">Use these timings</Text>
              <Text className="mt-0.5 font-inter text-xs text-white/55">{timedRange}</Text>
            </View>
            <Switch value={useScannedTimings} onValueChange={setUseScannedTimings} />
          </View>
        ) : null}

        {result.unknownLabels.length > 0 ? (
          <View className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <Text className="font-inter-semibold text-sm text-white">
              New subjects ({result.unknownLabels.length})
            </Text>
            <Text className="mt-1 font-inter text-xs leading-5 text-white/55">
              These aren't in your subject list yet. Add them as new subjects, or pick the
              subject they are.
            </Text>
            {result.unknownLabels.map((unknown) => {
              const choice = unknownChoices[unknown.key] ?? { kind: "new" };
              const choose = (next: ScanChoice) =>
                setUnknownChoices((current) => ({ ...current, [unknown.key]: next }));
              return (
                <View key={unknown.key} className="mt-3">
                  <Text className="font-inter-medium text-sm text-white/90">
                    {unknown.label}{" "}
                    <Text className="text-white/45">
                      · {unknown.count} {unknown.count === 1 ? "period" : "periods"}
                    </Text>
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                    <Chip
                      label="New subject"
                      selected={choice.kind === "new"}
                      onPress={() => choose({ kind: "new" })}
                    />
                    {subjects.map((subject) => (
                      <Chip
                        key={subject.id}
                        label={subject.shortName}
                        selected={choice.kind === "subject" && choice.subjectId === subject.id}
                        onPress={() => choose({ kind: "subject", subjectId: subject.id })}
                      />
                    ))}
                    <Chip
                      label="Skip"
                      selected={choice.kind === "free"}
                      onPress={() => choose({ kind: "free" })}
                    />
                  </ScrollView>
                </View>
              );
            })}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5">
          {result.days.map((day) => (
            <Chip
              key={day}
              label={day}
              selected={day === selectedDay}
              onPress={() => {
                setSelectedDay(day);
                setEditingKey(null);
              }}
            />
          ))}
        </ScrollView>

        <View className="mt-3 gap-2">
          {effectiveHours.map((hourSlot) => {
            const hour = hourSlot.hour;
            const key = getScanCellKey({ day: selectedDay, hour });
            const slot = daySlots.find((item) => item.hour === hour);
            const coveringSlot = daySlots.find(
              (item) => item.hour === hour - 1 && (item.isDouble || item.isLab),
            );
            const subject = slot ? subjectById.get(slot.subjectId) : undefined;
            const covering = coveringSlot ? subjectById.get(coveringSlot.subjectId) : undefined;
            const cell = result.cells.find(
              (item) => item.day === selectedDay && hour >= item.hour && hour < item.hour + item.span,
            );
            const editing = editingKey === key;

            return (
              <Pressable
                key={key}
                onPress={() => setEditingKey(editing ? null : key)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <View className="flex-row items-center">
                  <View className="w-16">
                    <Text className="font-inter-semibold text-xs text-white/80">H{hour}</Text>
                    <Text className="font-inter text-[11px] text-white/45">
                      {hourSlot.startTime}
                    </Text>
                  </View>
                  <View className="flex-1">
                    {subject ? (
                      <Text className="font-inter-semibold text-sm" style={{ color: subject.color }}>
                        {subject.shortName}
                        <Text className="font-inter text-xs text-white/50">
                          {slot?.isLab ? "  · Lab · 2h" : slot?.isDouble ? "  · Double · 2h" : ""}
                        </Text>
                      </Text>
                    ) : covering ? (
                      <Text className="font-inter text-sm text-white/50">
                        ↳ {covering.shortName} continues
                      </Text>
                    ) : (
                      <Text className="font-inter text-sm text-white/35">Free</Text>
                    )}
                    {cell ? (
                      <Text className="mt-0.5 font-inter text-[11px] text-white/40" numberOfLines={1}>
                        Read: {cell.text}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {editing ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                    <Chip
                      label="Free"
                      selected={!subject && !covering}
                      onPress={() => {
                        setCellChoices((current) => ({ ...current, [key]: { kind: "free" } }));
                        setEditingKey(null);
                      }}
                    />
                    {[...subjectById.values()].map((option) => (
                      <Chip
                        key={option.id}
                        label={option.shortName}
                        selected={subject?.id === option.id}
                        onPress={() => {
                          setCellChoices((current) => ({
                            ...current,
                            [key]: { kind: "subject", subjectId: option.id },
                          }));
                          setEditingKey(null);
                        }}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {plan.droppedSlotCount > 0 ? (
          <Text className="mt-3 font-inter text-xs leading-5 text-amber-200">
            {plan.droppedSlotCount} periods are past your last hour and were left out. Turn on
            the timings above, or add hours in Edit timetable.
          </Text>
        ) : null}
        <Text className="mt-3 font-inter text-xs leading-5 text-white/45">
          Applying replaces the classes on {result.days.join(", ")}. Other days stay as they are.
        </Text>

        <Button
          mode="contained"
          style={{ marginTop: 16 }}
          loading={applying}
          disabled={applying || classCount === 0}
          onPress={() => void apply()}
        >
          Apply to timetable
        </Button>
        <Button mode="text" style={{ marginTop: 6 }} onPress={reset}>
          Start over
        </Button>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
          <Text className="font-inter-bold text-xl text-white">
            {step === "review" ? "Check your timetable" : "Build timetable automatically"}
          </Text>
          <Pressable
            accessibilityLabel="Close"
            onPress={close}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
          >
            <X color="#f8fafc" size={18} />
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {error ? (
            <View className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3">
              <Text className="font-inter text-sm leading-6 text-red-200">{error}</Text>
            </View>
          ) : null}

          {!isTimetableScanAvailable ? (
            <Text className="mt-4 font-inter text-sm leading-6 text-white/65">
              Reading timetables works in the Android app (it uses the phone's on-device text
              recognition).
            </Text>
          ) : step === "source" ? (
            <>
              <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
                Everything is read on this phone, offline. You'll check the result before
                anything changes.
              </Text>
              <View className="mt-5 rounded-[24px] border border-[#60a5fa]/40 bg-[#1d4ed8]/10 p-4">
                <View className="flex-row items-center">
                  <FileText color="#93c5fd" size={20} />
                  <Text className="ml-2 font-inter-bold text-base text-white">Timetable PDF</Text>
                  <Text className="ml-2 font-inter-semibold text-[11px] text-[#93c5fd]">
                    MOST ACCURATE
                  </Text>
                </View>
                <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
                  The college PDF with one page per section (like 1CHE01). Pick it, type your
                  section, done.
                </Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 12 }}
                  disabled={!isPdfImportAvailable}
                  onPress={() => void pickPdf()}
                >
                  Choose PDF
                </Button>
              </View>
              <View className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <View className="flex-row items-center">
                  <Camera color="#f8fafc" size={20} />
                  <Text className="ml-2 font-inter-bold text-base text-white">
                    Photo or screenshot
                  </Text>
                </View>
                <Text className="mt-2 font-inter text-sm leading-6 text-white/65">
                  For a printed or notice-board timetable. Hold the phone straight, use good
                  light, and fill the photo with the table so the day names show.
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-3">
                  <Button mode="contained-tonal" icon="camera" onPress={() => void readImage("camera")}>
                    Take photo
                  </Button>
                  <Button
                    mode="outlined"
                    icon={({ color, size }) => <ImageIcon color={color} size={size} />}
                    onPress={() => void readImage("library")}
                  >
                    Choose image
                  </Button>
                </View>
              </View>
            </>
          ) : step === "section" && pdf ? (
            <View className="mt-4">
              <Text className="font-inter text-sm leading-6 text-white/65">
                This PDF has {pdf.pageCount} pages. Type your section code as printed at the top
                of your page.
              </Text>
              <TextInput
                mode="outlined"
                label="Section (e.g. 1CHE01)"
                value={section}
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setSection}
                onSubmitEditing={() => void findSection()}
                style={{ marginTop: 14, backgroundColor: "transparent" }}
              />
              <Button
                mode="contained"
                style={{ marginTop: 12 }}
                disabled={!section.trim()}
                onPress={() => void findSection()}
              >
                Find my page
              </Button>
              <Text className="mt-6 font-inter text-xs text-white/50">
                Or read a page by number:
              </Text>
              <View className="mt-2 flex-row items-center gap-3">
                <TextInput
                  mode="outlined"
                  label="Page"
                  value={pageNumber}
                  keyboardType="number-pad"
                  onChangeText={setPageNumber}
                  style={{ flex: 1, backgroundColor: "transparent" }}
                />
                <Button mode="outlined" onPress={() => void readPageNumber()}>
                  Read page
                </Button>
              </View>
            </View>
          ) : step === "working" ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color="#60a5fa" size="large" />
              <Text className="mt-4 text-center font-inter text-sm text-white/70">{progress}</Text>
              {pdf ? (
                <Button
                  mode="text"
                  style={{ marginTop: 12 }}
                  onPress={() => {
                    cancelled.current = true;
                    setStep("section");
                  }}
                >
                  Stop
                </Button>
              ) : null}
            </View>
          ) : (
            renderReview()
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
