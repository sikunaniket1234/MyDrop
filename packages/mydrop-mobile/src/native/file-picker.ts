import { NativeModules, Platform } from "react-native";

interface FilePickerResult {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly base64: string;
}

interface FilePickerInterface {
  pickFile(): Promise<FilePickerResult | null>;
}

let picker: FilePickerInterface | null = null;

if (Platform.OS === "android") {
  const mod = NativeModules.MyDropFilePicker as FilePickerInterface | undefined;
  if (mod) picker = mod;
}

export interface PickedFile {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly base64: string;
}

export async function pickAnyFile(): Promise<PickedFile | null> {
  if (!picker) return null;

  try {
    const result = await picker.pickFile();
    if (!result) return null;
    return {
      uri: String(result.uri ?? ""),
      fileName: String(result.fileName ?? "file"),
      mimeType: String(result.mimeType ?? "application/octet-stream"),
      fileSize: Number(result.fileSize ?? 0),
      base64: String(result.base64 ?? ""),
    };
  } catch {
    return null;
  }
}
