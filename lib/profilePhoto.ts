import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

const isOwnFile = (uri?: string) =>
  Boolean(uri && FileSystem.documentDirectory && uri.startsWith(FileSystem.documentDirectory));

/**
 * Lets the student take or choose a square profile photo and keeps a copy in the
 * app's documents folder (picker files live in a cache Android may clear).
 * Returns the new file's uri, or undefined when cancelled.
 */
export const pickProfilePhoto = async (
  source: "camera" | "library",
  previousUri?: string,
): Promise<string | undefined> => {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Allow camera access in Settings ☰ › Permissions to take a photo.");
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset || !FileSystem.documentDirectory) {
    return undefined;
  }

  // A new name each time so the image cache doesn't keep showing the old photo.
  const target = `${FileSystem.documentDirectory}profile-photo-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });
  await removeProfilePhoto(previousUri);
  return target;
};

export const removeProfilePhoto = async (uri?: string): Promise<void> => {
  if (uri && isOwnFile(uri)) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
};
