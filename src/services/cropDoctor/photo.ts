import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { PickedPhoto } from "./types";

// The API takes JPEG, PNG or WebP up to 10 MB. Phone cameras can produce HEIC
// and files above that, so every photo is re-encoded as a bounded JPEG.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;
const MAX_BYTES = 10 * 1024 * 1024;

export type PhotoResult =
  | { status: "picked"; photo: PickedPhoto }
  | { status: "cancelled" }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "failed" }
  | { status: "tooLarge" };

type PhotoSourceAsset = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

async function shrink(asset: PhotoSourceAsset): Promise<PickedPhoto> {
  const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  if (longEdge > MAX_EDGE_PX) {
    context.resize(landscape ? { width: MAX_EDGE_PX } : { height: MAX_EDGE_PX });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  console.log("[CropDoctor] photo shrunk", {
    from: { w: asset.width, h: asset.height, bytes: asset.fileSize },
    to: { w: saved.width, h: saved.height },
    uri: saved.uri,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Re-encodes a captured or chosen photo as a bounded JPEG. Falls back to the
 * original when re-encoding fails and it is small enough to upload as is.
 */
export async function preparePhoto(asset: PhotoSourceAsset): Promise<PhotoResult> {
  console.log("[CropDoctor] preparePhoto start", { uri: asset.uri, w: asset.width, h: asset.height });
  try {
    return { status: "picked", photo: await shrink(asset) };
  } catch (error) {
    console.warn("[CropDoctor] photo re-encode failed, using original if small enough", error);
    if (asset.fileSize !== undefined && asset.fileSize > MAX_BYTES) {
      return { status: "tooLarge" };
    }
    return {
      status: "picked",
      photo: { uri: asset.uri, width: asset.width, height: asset.height },
    };
  }
}

/**
 * Gallery picker. The camera is captured in-app (CameraCapture) rather than via
 * the system camera intent, which can kill and restart the app on Android.
 */
export async function pickFromLibrary(): Promise<PhotoResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("[CropDoctor] gallery permission", {
      granted: permission.granted,
      canAskAgain: permission.canAskAgain,
    });
    if (!permission.granted) {
      return { status: "denied", canAskAgain: permission.canAskAgain };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    console.log("[CropDoctor] gallery result", {
      canceled: result.canceled,
      count: result.assets?.length ?? 0,
    });
    if (result.canceled || !result.assets?.[0]) return { status: "cancelled" };
    return await preparePhoto(result.assets[0]);
  } catch (error) {
    console.error("[CropDoctor] gallery pick failed", error);
    return { status: "failed" };
  }
}
