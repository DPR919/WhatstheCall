"use client";

import { useMemo, useState } from "react";

type UploadStatus =
  | "idle"
  | "no-file"
  | "creating-upload-url"
  | "uploading"
  | "upload-complete"
  | "upload-failed";

function getStatusMessage(status: UploadStatus) {
  switch (status) {
    case "no-file":
      return "no file selected";
    case "creating-upload-url":
      return "creating upload URL";
    case "uploading":
      return "uploading";
    case "upload-complete":
      return "upload complete";
    case "upload-failed":
      return "upload failed";
    default:
      return "";
  }
}

export function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const statusMessage = useMemo(() => getStatusMessage(status), [status]);

  const isBusy = status === "creating-upload-url" || status === "uploading";

  async function handleUpload() {
    if (!file) {
      setStatus("no-file");
      return;
    }

    setErrorMessage("");

    try {
      setStatus("creating-upload-url");

      const presignResponse = await fetch("/api/videos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignResponse.ok) {
        throw new Error("Failed to create upload URL.");
      }

      const { uploadUrl } = (await presignResponse.json()) as { uploadUrl: string; key: string };

      setStatus("uploading");

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3.");
      }

      setStatus("upload-complete");
    } catch (error) {
      console.error("[VideoUpload] Upload failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown upload error.");
      setStatus("upload-failed");
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-xl text-gray-900">Upload a video clip - manual deploy</h3>

      <div className="flex flex-col gap-4">
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);
            setStatus("idle");
            setErrorMessage("");
          }}
          className="block w-full text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-white hover:file:bg-orange-700"
        />

        <button
          type="button"
          onClick={handleUpload}
          disabled={isBusy}
          className="w-fit cursor-pointer rounded-full bg-gray-900 px-6 py-3 text-white transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? "Working..." : "Upload"}
        </button>

        {statusMessage ? <p className="text-sm text-gray-700">Status: {statusMessage}</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </div>
    </div>
  );
}
