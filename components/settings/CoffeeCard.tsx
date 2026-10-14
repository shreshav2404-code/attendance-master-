import * as Clipboard from "expo-clipboard";
import { Coffee } from "lucide-react-native";
import { useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import { Button } from "react-native-paper";

import { BottomSheet } from "@/components/shared/BottomSheet";
import type { ToastController } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";

const CREATOR_UPI_CONFIG = {
  upiId: "kkjha537428-1@okaxis",
  payeeName: "Keshav Jha",
  note: "AttendX support",
  amountInr: "49",
} as const;

const buildCreatorUpiPayUrl = (): string => {
  const query = [
    `pa=${encodeURIComponent(CREATOR_UPI_CONFIG.upiId)}`,
    `pn=${encodeURIComponent(CREATOR_UPI_CONFIG.payeeName)}`,
    `tn=${encodeURIComponent(CREATOR_UPI_CONFIG.note)}`,
    `am=${encodeURIComponent(CREATOR_UPI_CONFIG.amountInr)}`,
    "cu=INR",
  ].join("&");
  return `upi://pay?${query}`;
};

interface CoffeeCardProps {
  toast: ToastController;
}

/** "Buy me a coffee" UPI card shown at the bottom of every Settings page. */
export const CoffeeCard = ({ toast }: CoffeeCardProps) => {
  const [qrVisible, setQrVisible] = useState(false);

  const openUpiPayment = async (): Promise<void> => {
    await triggerTapHaptic();
    const upiUrl = buildCreatorUpiPayUrl();

    try {
      if (!(await Linking.canOpenURL(upiUrl))) {
        throw new Error("UPI app unavailable");
      }

      await Linking.openURL(upiUrl);
      await toast.success("Opened UPI app");
    } catch {
      setQrVisible(true);
      await toast.warn("UPI app not available. Showing QR.");
    }
  };

  return (
    <>
      <View
        className="mt-8 rounded-2xl border p-4"
        style={{
          borderColor: "rgba(245, 158, 11, 0.35)",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
        }}
      >
        <View className="flex-row items-center">
          <Coffee color="#f59e0b" size={20} />
          <Text className="ml-2 font-inter-bold text-base text-[#fde68a]">
            Buy Me A Coffee
          </Text>
        </View>
        <Text className="mt-2 font-inter text-sm leading-6 text-white/80">
          If AttendX is saving your attendance, fuel the developer once in a while.
        </Text>
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Button
            mode="contained"
            icon="coffee"
            buttonColor="#f59e0b"
            textColor="#0a0f1e"
            onPress={() => {
              void openUpiPayment();
            }}
          >
            Send coffee via UPI
          </Button>
          <Button
            mode="text"
            icon="qrcode"
            textColor="#fde68a"
            onPress={() => {
              void triggerTapHaptic();
              setQrVisible(true);
            }}
          >
            Show UPI QR
          </Button>
        </View>
      </View>

      <BottomSheet visible={qrVisible} title="UPI QR" onClose={() => setQrVisible(false)}>
        <View className="items-center">
          <Text className="mb-3 text-center font-inter text-sm text-white/70">
            Scan this QR to pay with any UPI app.
          </Text>
          <Image
            source={require("../../assets/images/upi-keshav-qr.jpeg")}
            resizeMode="contain"
            style={{ width: 260, height: 320, borderRadius: 18 }}
          />
          <Text className="mt-2 font-inter text-sm text-white/70">
            UPI ID: {CREATOR_UPI_CONFIG.upiId}
          </Text>
          <View className="mt-4 w-full flex-row gap-3">
            <Button
              mode="contained-tonal"
              style={{ flex: 1 }}
              onPress={async () => {
                await triggerTapHaptic();
                await Clipboard.setStringAsync(CREATOR_UPI_CONFIG.upiId);
                await toast.success("UPI ID copied");
              }}
            >
              Copy UPI ID
            </Button>
            <Button
              mode="outlined"
              style={{ flex: 1 }}
              onPress={() => {
                setQrVisible(false);
                void triggerTapHaptic();
              }}
            >
              Close
            </Button>
          </View>
        </View>
      </BottomSheet>
    </>
  );
};
