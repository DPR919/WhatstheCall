"use client";

import { useState } from "react";
import Link from "next/link";

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
        <div className="empty-state"><p className="panel-title">Your call history starts here.</p><p className="quiet mt-2 mb-5">Make your first call, then return to replay it.</p><Link href="/main" className="primary-btn">Call a clip ↗</Link></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecentClips).map(([dateLabel, clips]) => (
            <div key={dateLabel}>
              <p className="collection-date">{dateLabel}</p>

              <div>
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="collection-row"
                  >
                    <div>
                      <p className="collection-row-meta">
                        Called at{" "}
                        {new Date(clip.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <h2 className="collection-row-title">Action replay</h2>
                      <span className="tag">Your call: {clip.response === "no_touch" ? "No touch" : `Touch for ${clip.response}`}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleWatchAgain(clip.clipId)}
                      className="ghost-btn"
                    >
                      Watch again →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedClipId ? (
        <div className="replay-backdrop" role="dialog" aria-modal="true" aria-label="Clip replay">
          <div className="replay-modal">
            <div className="replay-modal-head">
              <h2>Watch again.</h2>
              <button
                type="button"
                onClick={closeModal}
                className="ghost-btn"
              >
                Close
              </button>
            </div>

            {isLoadingVideo ? <p className="status-note" role="status">Loading clip...</p> : null}
            {modalError ? <p className="status-note" data-error="true" role="alert">{modalError}</p> : null}

            {selectedVideoUrl ? (
              <video src={selectedVideoUrl} controls autoPlay className="w-full" aria-label="Replay of a previously called fencing clip" />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
