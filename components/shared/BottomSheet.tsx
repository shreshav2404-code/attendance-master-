import { X } from "lucide-react-native";
import { MotiView } from "moti";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { IconButton } from "react-native-paper";

interface BottomSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet = ({
  visible,
  title,
  onClose,
  children,
}: BottomSheetProps) => {
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.max(420, Math.floor(height * 0.88));

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <MotiView
          from={{ translateY: 360, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: 360, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 180 }}
          className="rounded-t-[32px] border-t border-white/10 bg-surface px-5 pb-10 pt-4"
          style={{ maxHeight: maxSheetHeight }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="h-1.5 w-12 rounded-full bg-white/15" />
            {title ? (
              <Text className="font-inter-semibold text-base text-white">
                {title}
              </Text>
            ) : (
              <View />
            )}
            <IconButton icon={() => <X color="#f8fafc" size={18} />} onPress={onClose} />
          </View>
          {children}
        </MotiView>
      </View>
    </Modal>
  );
};
