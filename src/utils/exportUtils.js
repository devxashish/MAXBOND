// Universal Export Utility (React Web + React Native)
let exportToPdf, exportToExcel;

if (typeof document !== 'undefined') {
  // ✅ WEB Implementation
  const downloadOnWeb = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  exportToPdf = async (content, filename = "report") => {
    const fullFilename = `${filename}.pdf`;
    downloadOnWeb(content, fullFilename, "application/pdf");
  };

  exportToExcel = async (content, filename = "data") => {
    const fullFilename = `${filename}.xlsx`;
    downloadOnWeb(content, fullFilename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
} else {
  // ✅ REACT NATIVE Implementation (only works in native mobile environment)
  const RNFS = require("react-native-fs");
  const { Platform, PermissionsAndroid } = require("react-native");

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: "Storage Permission",
          message: "App needs access to save files.",
          buttonPositive: "OK",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn(e);
      return false;
    }
  };

  const saveToFile = async (content, filename, mimeType) => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      alert("Permission denied");
      return;
    }

    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    const encoding = mimeType.includes("base64") ? "base64" : "utf8";
    try {
      await RNFS.writeFile(path, content, encoding);
      alert(`Saved to Documents: ${filename}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save file.");
    }
  };

  exportToPdf = async (content, filename = "report") => {
    await saveToFile(content, `${filename}.pdf`, "application/pdf");
  };

  exportToExcel = async (content, filename = "data") => {
    await saveToFile(content, `${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
}

export { exportToPdf, exportToExcel };
