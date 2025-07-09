// React Native version
import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";

/**
 * Requests storage permission (Android only)
 */
const requestStoragePermission = async () => {
  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

const saveFileToDocuments = async (content, filename, encoding = "utf8") => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    alert("Storage permission denied.");
    return false;
  }

  const path = Platform.select({
    ios: `${RNFS.DocumentDirectoryPath}/${filename}`,
    android: `${RNFS.DownloadDirectoryPath}/${filename}`,
  });

  try {
    await RNFS.writeFile(path, content, encoding);
    alert(`Saved to ${path}`);
    return true;
  } catch (e) {
    console.error("Save failed", e);
    alert("Failed to save file.");
    return false;
  }
};

export const exportToPdf = async (base64Content, filename) => {
  const fullName = `${filename}.pdf`;
  return saveFileToDocuments(base64Content, fullName, "base64");
};

export const exportToExcel = async (rawContent, filename) => {
  const fullName = `${filename}.xlsx`;
  return saveFileToDocuments(rawContent, fullName, "utf8");
};
