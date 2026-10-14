import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

interface ProfileAvatarProps {
  name: string;
  photoUri?: string;
  size: number;
}

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** The student's photo, or their initials when there's none (or the file is gone). */
export const ProfileAvatar = ({ name, photoUri, size }: ProfileAvatarProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoUri]);

  if (photoUri && !failed) {
    return (
      <Image
        source={{ uri: photoUri }}
        accessibilityLabel={`${name}'s photo`}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-[#1d4ed8]"
      style={{ width: size, height: size }}
    >
      <Text className="font-inter-bold text-white" style={{ fontSize: size * 0.36 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
};
