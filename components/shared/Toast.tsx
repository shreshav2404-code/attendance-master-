import { CheckCircle2, TriangleAlert } from "lucide-react-native";
import { AnimatePresence, MotiView } from "moti";
import { Text, View } from "react-native";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "warning";
}

export const Toast = ({
  visible,
  message,
  type = "success",
}: ToastProps) => (
  <AnimatePresence>
    {visible ? (
      <MotiView
        from={{ opacity: 0, translateY: -24 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: -24 }}
        className="absolute left-4 right-4 top-16 z-50 rounded-2xl border border-white/10 bg-surface px-4 py-3"
      >
        <View className="flex-row items-center gap-3">
          {type === "success" ? (
            <CheckCircle2 color="#10b981" size={18} />
          ) : (
            <TriangleAlert color="#f59e0b" size={18} />
          )}
          <Text className="flex-1 font-inter-medium text-sm text-white">
            {message}
          </Text>
        </View>
      </MotiView>
    ) : null}
  </AnimatePresence>
);
