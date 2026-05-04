"use client";

import { useState } from "react";

type RecentClipItem = {
  id: string;
  clipId: string;
  response: string;
  createdAt: string;
};

type Props = {
  groupedRecentClips: Record<string, RecentClipItem[]>;
};

export function RecentClipsList({ groupedRecentClips }: Props) {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [modalError, setModalError] = useState("");

  async function handleWatchAgain(clipId: string) {
    setSelectedClipId(clipId);
    setSelectedVideoUrl(null);
    setModalError("");
    setIsLoadingVideo(true);

    try {
      const response = await fetch(`/api/videos/clip?clipId=${encodeURIComponent(clipId)}`);
      const payload = (await response.json()) as { videoUrl?: string; error?: string };

      if (!response.ok || !payload.videoUrl) {
        throw new Error(payload.error ?? "Failed to load clip.");
      }

      setSelectedVideoUrl(payload.videoUrl);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Failed to load clip.");
    } finally {
      setIsLoadingVideo(false);
    }
  }

  function closeModal() {
    setSelectedClipId(null);
    setSelectedVideoUrl(null);
    setModalError("");
    setIsLoadingVideo(false);
  }

  return (
    <>
      {Object.keys(groupedRecentClips).length === 0 ? (
        <p className="text-sm text-gray-600">You have not responded to any clips yet.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecentClips).map(([dateLabel, clips]) => (
            <div key={dateLabel} className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{dateLabel}</p>

              <div className="space-y-2">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm text-gray-700">
                        Submitted at{" "}
                        {new Date(clip.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-sm text-gray-900">Clip title: Placeholder clip title</p>
                      <p className="text-sm text-gray-700">you called {clip.response} to this clip</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleWatchAgain(clip.clipId)}
                      className="inline-flex w-fit items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-50"
                    >
                      Watch this clip again
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedClipId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg text-gray-900">Clip replay</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {isLoadingVideo ? <p className="text-sm text-gray-700">Loading clip...</p> : null}
            {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}

            {selectedVideoUrl ? (
              <video src={selectedVideoUrl} controls autoPlay className="w-full rounded-md border border-gray-200" />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}