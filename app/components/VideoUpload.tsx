"use client";

import { useMemo, useState } from "react";

type UploadStatus =
  | "idle"
  | "no-file"
  | "creating-upload-url"
  | "uploading"
  | "registering-clip"
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
    case "registering-clip":
      return "registering uploaded clip";
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
  const [randomClipUrl, setRandomClipUrl] = useState<string>("");
  const [isLoadingRandomClip, setIsLoadingRandomClip] = useState(false);
  const [randomClipError, setRandomClipError] = useState<string>("");

  const statusMessage = useMemo(() => getStatusMessage(status), [status]);

  const isBusy =
    status === "creating-upload-url" ||
    status === "uploading" ||
    status === "registering-clip";

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

      const { uploadUrl, key } = (await presignResponse.json()) as {
        uploadUrl: string;
        key: string;
      };

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

      setStatus("registering-clip");

      const registerResponse = await fetch("/api/videos/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ s3Key: key }),
      });

      const registerPayload = (await registerResponse.json()) as {
        clip?: { id: string };
        error?: string;
      };

      if (!registerResponse.ok || !registerPayload.clip?.id) {
        throw new Error(registerPayload.error ?? "Failed to register uploaded clip.");
      }

      setStatus("upload-complete");
    } catch (error) {
      console.error("[VideoUpload] Upload failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown upload error.");
      setStatus("upload-failed");
    }
  }

  async function handleShowRandomClip() {
    setIsLoadingRandomClip(true);
    setRandomClipError("");

    try {
      const response = await fetch("/api/videos/getvideo", {
        method: "GET",
      });

      const payload = (await response.json()) as {
        clipId?: string;
        s3Key?: string;
        videoUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.videoUrl) {
        throw new Error(payload.error ?? "Could not load a clip.");
      }

      setRandomClipUrl(payload.videoUrl);
    } catch (error) {
      console.error("[VideoUpload] Failed to fetch random clip", error);
      setRandomClipError(error instanceof Error ? error.message : "Unknown error loading clip.");
      setRandomClipUrl("");
    } finally {
      setIsLoadingRandomClip(false);
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

      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="mb-4 text-xl text-gray-900">Watch a random clip</h3>

        <button
          type="button"
          onClick={handleShowRandomClip}
          disabled={isLoadingRandomClip}
          className="w-fit cursor-pointer rounded-full bg-orange-600 px-6 py-3 text-white transition-all duration-200 hover:scale-105 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingRandomClip ? "Loading..." : "Show me a random clip"}
        </button>

        {randomClipError ? <p className="mt-3 text-sm text-red-600">{randomClipError}</p> : null}

        {randomClipUrl ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-black">
            <video
              key={randomClipUrl}
              controls
              className="h-auto w-full"
              src={randomClipUrl}
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : null}
      </div>
    </div>
  );
}
