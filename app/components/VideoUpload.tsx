"use client";

import { useMemo, useRef, useState } from "react";

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

type ClipMetadataForm = {
  title: string;
  eventName: string;
  leftFencer: string;
  rightFencer: string;
  weapon: string;
  sourceUrl: string;
  notes: string;
  scoreAtTouch: string;
};

type SharedBatchMetadata = {
  eventName: string;
  leftFencer: string;
  rightFencer: string;
  weapon: string;
  sourceUrl: string;
};

type BatchClipRow = {
  id: string;
  file: File;
  title: string;
  scoreAtTouch: string;
  notes: string;
};

type BatchRowStatus = "queued" | "creating-upload-url" | "uploading" | "registering" | "success" | "failed";

type BatchRowResult = {
  id: string;
  fileName: string;
  status: BatchRowStatus;
  error?: string;
};

const INITIAL_CLIP_METADATA: ClipMetadataForm = {
  title: "",
  eventName: "",
  leftFencer: "",
  rightFencer: "",
  weapon: "",
  sourceUrl: "",
  notes: "",
  scoreAtTouch: "",
};

const INITIAL_BATCH_SHARED_METADATA: SharedBatchMetadata = {
  eventName: "",
  leftFencer: "",
  rightFencer: "",
  weapon: "",
  sourceUrl: "",
};

function createBatchClipRow(file: File): BatchClipRow {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    title: "",
    scoreAtTouch: "",
    notes: "",
  };
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchClipRows, setBatchClipRows] = useState<BatchClipRow[]>([]);
  const [batchSharedMetadata, setBatchSharedMetadata] = useState<SharedBatchMetadata>(
    INITIAL_BATCH_SHARED_METADATA,
  );
  const [batchResults, setBatchResults] = useState<BatchRowResult[]>([]);
  const [batchCompletedCount, setBatchCompletedCount] = useState(0);
  const [clipMetadata, setClipMetadata] = useState<ClipMetadataForm>(INITIAL_CLIP_METADATA);
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

  const setClipMetadataField = <K extends keyof ClipMetadataForm>(key: K, value: ClipMetadataForm[K]) => {
    setClipMetadata((prev) => ({ ...prev, [key]: value }));
  };

  const setBatchSharedMetadataField = <K extends keyof SharedBatchMetadata>(
    key: K,
    value: SharedBatchMetadata[K],
  ) => {
    setBatchSharedMetadata((prev) => ({ ...prev, [key]: value }));
  };

  const updateBatchClipRow = <K extends keyof Omit<BatchClipRow, "id" | "file">>(
    id: string,
    key: K,
    value: BatchClipRow[K],
  ) => {
    setBatchClipRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const removeBatchClipRow = (id: string) => {
    setBatchClipRows((prev) => prev.filter((row) => row.id !== id));
    setBatchResults((prev) => prev.filter((row) => row.id !== id));
  };

  const updateBatchRowResult = (id: string, update: Partial<BatchRowResult>) => {
    setBatchResults((prev) =>
      prev.map((result) => (result.id === id ? { ...result, ...update } : result)),
    );
  };

  async function uploadAndRegisterClip(payload: {
    fileToUpload: File;
    title: string;
    eventName: string;
    leftFencer: string;
    rightFencer: string;
    weapon: string;
    sourceUrl: string;
    notes: string;
    scoreAtTouch: string;
  }) {
    const presignResponse = await fetch("/api/videos/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: payload.fileToUpload.name,
        fileType: payload.fileToUpload.type,
      }),
    });

    if (!presignResponse.ok) {
      throw new Error("Failed to create upload URL.");
    }

    const { uploadUrl, key } = (await presignResponse.json()) as {
      uploadUrl: string;
      key: string;
    };

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": payload.fileToUpload.type,
      },
      body: payload.fileToUpload,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to S3.");
    }

    const registerResponse = await fetch("/api/videos/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        s3Key: key,
        title: payload.title,
        eventName: payload.eventName,
        leftFencer: payload.leftFencer,
        rightFencer: payload.rightFencer,
        weapon: payload.weapon,
        sourceUrl: payload.sourceUrl,
        notes: payload.notes,
        scoreAtTouch: payload.scoreAtTouch,
      }),
    });

    const registerPayload = (await registerResponse.json()) as {
      clip?: { id: string };
      error?: string;
    };

    if (!registerResponse.ok || !registerPayload.clip?.id) {
      throw new Error(registerPayload.error ?? "Failed to register uploaded clip.");
    }
  }

  async function handleUpload() {
    if (isBatchMode) {
      if (batchClipRows.length === 0) {
        setErrorMessage("Select at least one video file for batch upload.");
        setStatus("upload-failed");
        return;
      }

      const sharedRequiredChecks: Array<[label: string, value: string]> = [
        ["Event name", batchSharedMetadata.eventName],
        ["Left fencer", batchSharedMetadata.leftFencer],
        ["Right fencer", batchSharedMetadata.rightFencer],
        ["Weapon", batchSharedMetadata.weapon],
        ["Source URL", batchSharedMetadata.sourceUrl],
      ];

      const firstMissingShared = sharedRequiredChecks.find(([, value]) => value.trim().length === 0);
      if (firstMissingShared) {
        setErrorMessage(`${firstMissingShared[0]} is required for batch upload.`);
        setStatus("upload-failed");
        return;
      }

      const invalidRow = batchClipRows.find(
        (row) => row.title.trim().length === 0 || row.scoreAtTouch.trim().length === 0,
      );

      if (invalidRow) {
        setErrorMessage(
          `Title and score at touch are required for each clip. Missing values for ${invalidRow.file.name}.`,
        );
        setStatus("upload-failed");
        return;
      }

      setErrorMessage("");
      setStatus("uploading");
      setBatchCompletedCount(0);
      const initialBatchResults: BatchRowResult[] = batchClipRows.map((row) => ({
        id: row.id,
        fileName: row.file.name,
        status: "queued",
      }));
      setBatchResults(initialBatchResults);
      const finalResults: BatchRowResult[] = [...initialBatchResults];

      let completed = 0;

      for (const row of batchClipRows) {
        try {
          updateBatchRowResult(row.id, { status: "creating-upload-url", error: undefined });

          const presignResponse = await fetch("/api/videos/presign", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: row.file.name,
              fileType: row.file.type,
            }),
          });

          if (!presignResponse.ok) {
            throw new Error("Failed to create upload URL.");
          }

          const { uploadUrl, key } = (await presignResponse.json()) as {
            uploadUrl: string;
            key: string;
          };

          updateBatchRowResult(row.id, { status: "uploading" });

          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": row.file.type,
            },
            body: row.file,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload file to S3.");
          }

          updateBatchRowResult(row.id, { status: "registering" });

          const registerResponse = await fetch("/api/videos/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              s3Key: key,
              title: row.title,
              eventName: batchSharedMetadata.eventName,
              leftFencer: batchSharedMetadata.leftFencer,
              rightFencer: batchSharedMetadata.rightFencer,
              weapon: batchSharedMetadata.weapon,
              sourceUrl: batchSharedMetadata.sourceUrl,
              notes: row.notes,
              scoreAtTouch: row.scoreAtTouch,
            }),
          });

          const registerPayload = (await registerResponse.json()) as {
            clip?: { id: string };
            error?: string;
          };

          if (!registerResponse.ok || !registerPayload.clip?.id) {
            throw new Error(registerPayload.error ?? "Failed to register uploaded clip.");
          }

          updateBatchRowResult(row.id, { status: "success", error: undefined });
          const resultIndex = finalResults.findIndex((result) => result.id === row.id);
          if (resultIndex >= 0) {
            finalResults[resultIndex] = {
              ...finalResults[resultIndex],
              status: "success",
              error: undefined,
            };
          }
        } catch (error) {
          console.error("[VideoUpload] Batch upload item failed", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown upload error.";
          updateBatchRowResult(row.id, {
            status: "failed",
            error: errorMessage,
          });
          const resultIndex = finalResults.findIndex((result) => result.id === row.id);
          if (resultIndex >= 0) {
            finalResults[resultIndex] = {
              ...finalResults[resultIndex],
              status: "failed",
              error: errorMessage,
            };
          }
        } finally {
          completed += 1;
          setBatchCompletedCount(completed);
        }
      }

      const hadFailures = finalResults.some((result) => result.status === "failed");
      setStatus(hadFailures ? "upload-failed" : "upload-complete");
      if (!hadFailures) {
        setBatchClipRows([]);
        setBatchSharedMetadata(INITIAL_BATCH_SHARED_METADATA);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
      return;
    }

    if (!file) {
      setStatus("no-file");
      return;
    }

    const requiredMetadataChecks: Array<[label: string, value: string]> = [
      ["Title", clipMetadata.title],
      ["Event name", clipMetadata.eventName],
      ["Left fencer", clipMetadata.leftFencer],
      ["Right fencer", clipMetadata.rightFencer],
      ["Weapon", clipMetadata.weapon],
      ["Source URL", clipMetadata.sourceUrl],
      ["Score at touch", clipMetadata.scoreAtTouch],
    ];

    const firstMissingField = requiredMetadataChecks.find(([, value]) => value.trim().length === 0);

    if (firstMissingField) {
      setErrorMessage(`${firstMissingField[0]} is required.`);
      setStatus("upload-failed");
      return;
    }

    setErrorMessage("");

    try {
      setStatus("creating-upload-url");
      await uploadAndRegisterClip({
        fileToUpload: file,
        title: clipMetadata.title,
        eventName: clipMetadata.eventName,
        leftFencer: clipMetadata.leftFencer,
        rightFencer: clipMetadata.rightFencer,
        weapon: clipMetadata.weapon,
        sourceUrl: clipMetadata.sourceUrl,
        notes: clipMetadata.notes,
        scoreAtTouch: clipMetadata.scoreAtTouch,
      });

      setFile(null);
      setClipMetadata(INITIAL_CLIP_METADATA);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Batch mode</span>
            <button
              type="button"
              onClick={() => {
                setIsBatchMode((prev) => !prev);
                setStatus("idle");
                setErrorMessage("");
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                setFile(null);
                setBatchClipRows([]);
                setBatchResults([]);
                setBatchCompletedCount(0);
              }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                isBatchMode ? "bg-orange-600" : "bg-gray-300"
              }`}
              aria-pressed={isBatchMode}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  isBatchMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-xs text-gray-500">{isBatchMode ? "On" : "Off"}</span>
          </div>

          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple={isBatchMode}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (isBatchMode) {
                  setBatchClipRows(files.map(createBatchClipRow));
                } else {
                  const nextFile = files[0] ?? null;
                  setFile(nextFile);
                }
                setStatus("idle");
                setErrorMessage("");
                setBatchResults([]);
                setBatchCompletedCount(0);
              }}
              className="block w-full text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-white hover:file:bg-orange-700"
            />

            {isBatchMode ? (
              <>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Shared match metadata
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={batchSharedMetadata.eventName}
                      onChange={(event) =>
                        setBatchSharedMetadataField("eventName", event.target.value)
                      }
                      placeholder="Event name *"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <input
                      type="text"
                      value={batchSharedMetadata.leftFencer}
                      onChange={(event) =>
                        setBatchSharedMetadataField("leftFencer", event.target.value)
                      }
                      placeholder="Left fencer *"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <input
                      type="text"
                      value={batchSharedMetadata.rightFencer}
                      onChange={(event) =>
                        setBatchSharedMetadataField("rightFencer", event.target.value)
                      }
                      placeholder="Right fencer *"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <input
                      type="text"
                      value={batchSharedMetadata.weapon}
                      onChange={(event) => setBatchSharedMetadataField("weapon", event.target.value)}
                      placeholder="Weapon *"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <input
                      type="url"
                      value={batchSharedMetadata.sourceUrl}
                      onChange={(event) =>
                        setBatchSharedMetadataField("sourceUrl", event.target.value)
                      }
                      placeholder="Source URL *"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 md:col-span-2"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                      Per-clip details
                    </p>
                    {batchClipRows.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchClipRows([]);
                          setBatchResults([]);
                          setBatchCompletedCount(0);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>

                  {batchClipRows.length === 0 ? (
                    <p className="text-sm text-gray-600">Select multiple files to start batch upload.</p>
                  ) : (
                    <div className="space-y-3">
                      {batchClipRows.map((row, index) => {
                        const rowResult = batchResults.find((result) => result.id === row.id);
                        return (
                          <div key={row.id} className="rounded-md border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {index + 1}. {row.file.name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeBatchClipRow(row.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input
                                type="text"
                                value={row.title}
                                onChange={(event) =>
                                  updateBatchClipRow(row.id, "title", event.target.value)
                                }
                                placeholder="Clip title *"
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                              />
                              <input
                                type="text"
                                value={row.scoreAtTouch}
                                onChange={(event) =>
                                  updateBatchClipRow(row.id, "scoreAtTouch", event.target.value)
                                }
                                placeholder="Score at touch *"
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                              />
                              <textarea
                                value={row.notes}
                                onChange={(event) =>
                                  updateBatchClipRow(row.id, "notes", event.target.value)
                                }
                                placeholder="Notes (optional)"
                                rows={2}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 md:col-span-2"
                              />
                            </div>
                            {rowResult ? (
                              <p className="mt-2 text-xs text-gray-600">
                                Status: {rowResult.status}
                                {rowResult.error ? ` — ${rowResult.error}` : ""}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={clipMetadata.title}
                    onChange={(event) => setClipMetadataField("title", event.target.value)}
                    placeholder="Clip title *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={clipMetadata.eventName}
                    onChange={(event) => setClipMetadataField("eventName", event.target.value)}
                    placeholder="Event name *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={clipMetadata.leftFencer}
                    onChange={(event) => setClipMetadataField("leftFencer", event.target.value)}
                    placeholder="Left fencer *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={clipMetadata.rightFencer}
                    onChange={(event) => setClipMetadataField("rightFencer", event.target.value)}
                    placeholder="Right fencer *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={clipMetadata.weapon}
                    onChange={(event) => setClipMetadataField("weapon", event.target.value)}
                    placeholder="Weapon *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="url"
                    value={clipMetadata.sourceUrl}
                    onChange={(event) => setClipMetadataField("sourceUrl", event.target.value)}
                    placeholder="Source URL *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <input
                    type="text"
                    value={clipMetadata.scoreAtTouch}
                    onChange={(event) => setClipMetadataField("scoreAtTouch", event.target.value)}
                    placeholder="Score at touch *"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <textarea
                  value={clipMetadata.notes}
                  onChange={(event) => setClipMetadataField("notes", event.target.value)}
                  placeholder="Notes (optional)"
                  rows={3}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={isBusy}
              className="w-fit cursor-pointer rounded-full bg-gray-900 px-6 py-3 text-white transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? "Working..." : "Upload"}
            </button>

            {statusMessage ? <p className="text-sm text-gray-700">Status: {statusMessage}</p> : null}
            {isBatchMode && batchClipRows.length > 0 ? (
              <p className="text-sm text-gray-700">
                Batch progress: {batchCompletedCount}/{batchClipRows.length}
              </p>
            ) : null}
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
