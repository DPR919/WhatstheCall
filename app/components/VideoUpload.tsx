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

type ClipResponse = "left" | "no_touch" | "right";

type AggregatedResults = {
  clipId: string;
  total: number;
  counts: Record<ClipResponse, number>;
};

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

export function VideoUpload({ canUpload = false }: { canUpload?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [randomClipUrl, setRandomClipUrl] = useState<string>("");
  const [currentClipId, setCurrentClipId] = useState<string>("");
  const [isLoadingRandomClip, setIsLoadingRandomClip] = useState(false);
  const [randomClipError, setRandomClipError] = useState<string>("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [responseError, setResponseError] = useState<string>("");
  const [hasSubmittedForCurrentClip, setHasSubmittedForCurrentClip] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string>("");
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResults | null>(null);

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
    setResponseMessage("");
    setResponseError("");
    setHasSubmittedForCurrentClip(false);
    setAggregatedResults(null);
    setResultsError("");

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

      setCurrentClipId(payload.clipId ?? "");
      setRandomClipUrl(payload.videoUrl);
    } catch (error) {
      console.error("[VideoUpload] Failed to fetch random clip", error);
      setRandomClipError(error instanceof Error ? error.message : "Unknown error loading clip.");
      setCurrentClipId("");
      setRandomClipUrl("");
      setHasSubmittedForCurrentClip(false);
      setAggregatedResults(null);
    } finally {
      setIsLoadingRandomClip(false);
    }
  }

  async function handleSubmitResponse(responseValue: ClipResponse) {
    if (!currentClipId) {
      setResponseError("No clip is currently selected.");
      return;
    }

    setIsSubmittingResponse(true);
    setResponseMessage("");
    setResponseError("");

    try {
      const response = await fetch("/api/videos/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clipId: currentClipId,
          response: responseValue,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to submit response.");
      }

      setResponseMessage("Response submitted.");
      setHasSubmittedForCurrentClip(true);
    } catch (error) {
      console.error("[VideoUpload] Failed to submit clip response", error);
      setResponseError(error instanceof Error ? error.message : "Unknown response error.");
    } finally {
      setIsSubmittingResponse(false);
    }
  }

  async function handleViewResults() {
    if (!currentClipId) {
      setResultsError("No clip is currently selected.");
      return;
    }

    if (!hasSubmittedForCurrentClip) {
      setResultsError("Submit your response first to view results.");
      return;
    }

    setIsLoadingResults(true);
    setResultsError("");

    try {
      const response = await fetch(
        `/api/videos/results?clipId=${encodeURIComponent(currentClipId)}`,
        {
          method: "GET",
        },
      );

      const payload = (await response.json()) as {
        clipId?: string;
        total?: number;
        counts?: Record<ClipResponse, number>;
        error?: string;
      };

      if (!response.ok || !payload.counts || typeof payload.total !== "number") {
        throw new Error(payload.error ?? "Failed to load results.");
      }

      setAggregatedResults({
        clipId: payload.clipId ?? currentClipId,
        total: payload.total,
        counts: payload.counts,
      });
    } catch (error) {
      console.error("[VideoUpload] Failed to load aggregated results", error);
      setResultsError(error instanceof Error ? error.message : "Unknown results error.");
      setAggregatedResults(null);
    } finally {
      setIsLoadingResults(false);
    }
  }

  return (
    <div className="space-y-8">
      {canUpload ? (
        <div className="space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            Upload a video clip
          </h3>

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
      ) : null}

      <div className="rounded-xl border border-gray-200/90 bg-gray-50/40 p-6 shadow-sm md:p-8">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
          Primary action
        </h3>
        <p className="mb-6 text-2xl text-gray-900">Watch a random clip</p>

        <button
          type="button"
          onClick={handleShowRandomClip}
          disabled={isLoadingRandomClip}
          className="mb-2 w-fit cursor-pointer rounded-full bg-orange-600 px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:scale-105 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingRandomClip ? "Loading..." : "Show me a random clip"}
        </button>

        {randomClipError ? <p className="mt-3 text-sm text-red-600">{randomClipError}</p> : null}

        {randomClipUrl ? (
          <>
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

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmitResponse("left")}
                  disabled={isSubmittingResponse || isLoadingRandomClip || !currentClipId}
                  className="rounded-full bg-gray-900 px-5 py-2 text-white transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitResponse("no_touch")}
                  disabled={isSubmittingResponse || isLoadingRandomClip || !currentClipId}
                  className="rounded-full bg-gray-700 px-5 py-2 text-white transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  No Touch
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitResponse("right")}
                  disabled={isSubmittingResponse || isLoadingRandomClip || !currentClipId}
                  className="rounded-full bg-orange-600 px-5 py-2 text-white transition-all duration-200 hover:scale-105 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Right
                </button>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleViewResults}
                  disabled={
                    isSubmittingResponse ||
                    isLoadingRandomClip ||
                    isLoadingResults ||
                    !currentClipId ||
                    !hasSubmittedForCurrentClip
                  }
                  className="rounded-full bg-blue-600 px-5 py-2 text-white transition-all duration-200 hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingResults ? "Loading results..." : "View response"}
                </button>
              </div>
            </div>

            {isSubmittingResponse ? (
              <p className="mt-3 text-sm text-gray-700">Submitting response...</p>
            ) : null}
            {responseMessage ? <p className="mt-3 text-sm text-green-700">{responseMessage}</p> : null}
            {responseError ? <p className="mt-3 text-sm text-red-600">{responseError}</p> : null}
            {resultsError ? <p className="mt-3 text-sm text-red-600">{resultsError}</p> : null}

            {aggregatedResults ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm text-gray-700">
                  Other users&apos; responses ({aggregatedResults.total} total)
                </p>

                {([
                  ["Left", aggregatedResults.counts.left],
                  ["No Touch", aggregatedResults.counts.no_touch],
                  ["Right", aggregatedResults.counts.right],
                ] as const).map(([label, count]) => {
                  const percent =
                    aggregatedResults.total > 0
                      ? Math.round((count / aggregatedResults.total) * 100)
                      : 0;

                  return (
                    <div key={label} className="mb-3 last:mb-0">
                      <div className="mb-1 flex items-center justify-between text-sm text-gray-800">
                        <span>{label}</span>
                        <span>
                          {count} ({percent}%)
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded bg-gray-200">
                        <div
                          className="h-full rounded bg-orange-500 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
